# Perf Harness

URL-flag-driven performance harness that runs scripted scenarios inside the R3F
canvas and emits a JSON report. Inert unless `?perf=` is set — no runtime cost
in production.

## Running

Append flags to any URL:

```
?perf=idle-rack             single scenario
?perf=all                   all five scenarios
?perf=all&download=1        auto-download JSON when finished
```

Results are logged via `console.table(...)` and stashed on `window.__perfReport`
for DevTools poking. `download=1` also saves `perf-<timestamp>.json`.

### Scenarios

| Name | What it stresses |
| --- | --- |
| `idle-rack` | Full rack, no interaction. Baseline. |
| `showcase-rack` | Full rack + continuous rotation. Hits `CameraControls.rotate`. |
| `drilled-sled` | Camera inside a compute sled. Many small meshes, close camera. |
| `rapid-selection` | Toggles selection between two sleds every 6 frames. Exercises the outline render path. |
| `orbit-stress` | Full rack, camera rotating 0.02 rad/frame. CPU-light orbit baseline. |

### Ablation flags

| Flag | Purpose |
| --- | --- |
| `frames=<n>` | Measurement frames per scenario (default 300). |
| `warmup=<n>` | Discarded warmup frames (default 60). |
| `dpr=<n>` | Override devicePixelRatio (e.g. `1`, `2`, `4`). Bypasses GPU-tier config. |
| `canvas=<px>` | Pin canvas to a fixed square size. |
| `post=<mode>` | `none`, `outline`, `ao`, `outline+ao`. Isolates post-processing passes. |
| `instancing=<mode>` | `instanced` (default) or `cloned` — unrolls instances into individual meshes. |

## How it measures

- **GPU time:** `EXT_disjoint_timer_query_webgl2` wrapped in `GPUTimer`. Chrome/Edge only; Firefox/Safari report `gpuMs: null`.
- **CPU time:** `performance.now()` delta between a `useFrame(-Infinity)` (before R3F render) and a `useFrame(+Infinity)` (after EffectComposer's priority-1 pass). Covers the full R3F render including post.
- **Frame time:** Wall-clock delta between successive priority-`+Infinity` callbacks. V-syncs to 60Hz in most browsers — use `gpuMs`/`cpuMs` for real signal.
- **Memory:** `gl.info.{memory,programs}` for geometry/texture/shader counts; `performance.memory.usedJSHeapSize` for JS heap (Chrome-only). Snapshots taken at start, end, and every 60 frames — flat lines mean no leak.
- **Draw calls / triangles:** `gl.info.render.{calls,triangles}` with `gl.info.autoReset = false`.

### R3F gotchas baked into the harness

The `useFrame(-Infinity)` + `useFrame(+Infinity)` pattern disables R3F's auto-render
(any non-zero-priority frame subscriber does). This is fine in normal operation
because `EffectComposer` runs at priority 1 and does its own `gl.render`. But
with `post=none` there's no composer — so the harness mounts a `ManualRenderer`
that explicitly calls `gl.render(scene, camera)` at priority 0 to keep things
rendering.

The `FirstRenderMarker` is gated behind `perfFlags.enabled` — without it, the
production build pays zero per-frame cost for the harness.

## Production cost when disabled

- `parsePerfFlags()` runs once at module load (reads `location.search`).
- `markInit(...)` fires three times at startup (gpuTier start/end, canvas created). Each writes a single field.
- `PerfHarness`, `ManualRenderer`, `FirstRenderMarker` — none mounted.
- `frameloop` stays `demand`; no forced continuous rendering.
- `PerfHarness.tsx` and `gpuTimer.ts` code-split into a ~5kB chunk that never loads without `?perf=`.

Bundle footprint when `?perf=` is absent: ~3kB for `harness.ts` (flag parser + types + metric scaffolding). The `PerfHarness` chunk does not load.

---

# Findings (April 2026, M4 Max / Chrome 147)

GPU vendor: `Google Inc. (Apple)` / renderer: `ANGLE Metal Renderer: Apple M4 Max`.

## TL;DR

The app is **GPU-bound**, specifically **fragment/fillrate-bound at high DPR**.
CPU is comfortable (<3ms p99 everywhere). Post-processing is the dominant GPU
cost and the most actionable lever. Instancing is earning its keep.

## Cost breakdown

Baseline scenarios at the default config (tier-3 GPU, `dpr=[1,2]`, outline+AO):

| Scenario | gpuMs p50 | cpuMs p50 | calls | tris | programs |
| --- | --- | --- | --- | --- | --- |
| idle-rack | ~3–5 | 2.5 | 239 | 1.69M | 24 |
| drilled-sled | ~3–5 | 2.7 | 225 | 355k | 30 |
| rapid-selection | ~4–5 | 2.1 | 179 | 882k | 24 |

## Ablations run (historical — before halfRes AO)

### Post-processing cost

`post=none` vs default, at `dpr=1`:

| | post=none | post=default |
| --- | --- | --- |
| calls | 93 | 239 (+146) |
| tris | 717k | 1.69M (+977k fullscreen quads) |
| programs | 9 | 24 (+15) |
| gpuMs p50 (idle) | 1.66 | 4.54 (+2.9ms) |

Post-processing adds **~3ms GPU at dpr=1** and 15 extra shader programs.

### DPR / fillrate scaling

Going from `dpr=1` to `dpr=4` (16× pixels):

| Scenario | gpuMs @ dpr=1 | gpuMs @ dpr=4 | ratio |
| --- | --- | --- | --- |
| idle-rack | 4.54 | 42.76 | 9.4× |
| drilled-sled | 4.05 | 52.35 | **12.9×** |
| rapid-selection | 5.34 | 66.99 | **12.5×** |

Modeling: ~2ms fixed cost (vertex/program/draw-call) + fillrate. Most scenarios
show ~10× scaling for 16× pixels — sub-linear, fillrate dominates the delta.
Drilled-sled and rapid-selection scale *faster* than linear on pixels, meaning
they pick up per-pixel cost on top of normal fillrate.

### rapid-selection @ dpr=4 is the danger zone

frameMs p95 = 83ms, p99 = 87ms — drops to ~12fps. Outline pass re-rendering the
selected object's silhouette + blur is the prime suspect.

### instancing=cloned

Unrolling 32 compute-sled instances into individual meshes costs **+868 draw
calls**, **+1.8ms CPU**, **+1.5ms GPU** on M4 Max. Invisible to a desktop user.
On a low-tier GPU where per-draw-call overhead is 10–50µs, those extra 868
calls would cost 9–43ms — so `InstancedMesh2` is explicitly protecting the
low-tier path. Don't remove it.

### No memory leak

Rapid-selection run over 1800 frames: geometries=120, textures=67, programs=24
completely flat. JS heap sawtoothed 29–56MB with normal GC drops. The manual
disposal logic in `InstancedGLBModel.tsx` and `SelectableGLBModel.tsx` works.

## Open diagnostic

Drilled-sled at `dpr=4` with post costs **+10ms vs idle-rack** despite fewer
triangles and fewer draw calls. Root cause hypotheses:

1. **Outline blur:** silhouette of `compute-inner` covers a larger screen
   fraction than the full rack, so the Gaussian blur kernel hits more pixels.
2. **N8AO depth complexity:** stacked PCB + heatsink + shroud geometry means
   more occlusion samples hit real geometry per fragment.

The `post=ao` flag (added to isolate AO-only) lets us disambiguate: compare
`post=outline&dpr=4` vs `post=ao&dpr=4` for drilled-sled and read off each
pass's fillrate.

---

# Interventions shipped

## `halfRes` on N8AO

`src/components/PostProcessing.tsx` — AO now samples at half resolution and
upsamples. Typical savings: 3–4× on the AO-specific GPU portion with slight
edge softening. Safe default because AO is already a blurred, low-frequency
effect.

## Tier-2 DPR cap lowered 2.0 → 1.75

`src/Scene.tsx` `getGPUConfig`:

| Tier | Old | New |
| --- | --- | --- |
| 3 (high) | `[1, 2]` | `[1, 2]` (unchanged) |
| 2 (mid) | `[1, 2]` | `[1, 1.75]` |
| 0–1 (low) | `1` | `1` (unchanged) |

Tier-2 devices (mid-range integrated / older discrete) now render ~23% fewer
fragments. Visually nearly imperceptible, materially cheaper.

## `enableOutline` / `post=ao` for diagnostics

`PostProcessing` gained an `enableOutline` prop so we can mount AO without the
outline pass. The harness exposes it via `post=ao`, completing the 2×2 matrix
of post-processing ablations.

## Rejected: adaptive AO during user interaction

Prototype that toggled AO off during `controlstart` and back on 200ms after
`controlend` was visually distracting — the AO popping in on release was too
noticeable to justify the fillrate savings. Reverted.

Lesson: for a static hardware visualizer, the eye tracks the shading
continuity even during motion. Adaptive DPR is the same shape of idea and
would likely have the same problem. If we revisit, cross-fade via tweened
`N8AO.intensity` rather than a hard toggle.

---

# Priority of follow-ups

1. **Confirm outline-blur hypothesis** with `post=outline&dpr=4` and
   `post=ao&dpr=4` comparisons. If outline dominates drilled-sled's +10ms,
   consider reducing `edgeStrength` or gating `blur` on high-tier GPUs.
2. **Consider tier-3 DPR cap at 1.75 too** if halfRes AO isn't enough on
   Retina. The quality loss is small and fillrate scales with pixel count.
3. **Do not** spend time on draw-call count or scene graph traversal — CPU is
   not the bottleneck on any measured configuration.
4. **Do not** merge instanced geometry back into monolithic meshes — the
   cloned ablation proves instancing saves ~3ms on the low-tier path.
