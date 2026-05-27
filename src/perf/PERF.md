# Perf Harness

URL-flag-driven performance harness that runs scripted scenarios inside the R3F canvas and
emits a JSON report. Inert unless `?perf=` is set — no runtime cost in production.

## Running

Append flags to any URL:

```
?perf=idle-rack             single scenario
?perf=all                   all five scenarios
?perf=all&download=1        auto-download JSON when finished
```

Results are logged via `console.table(...)` and stashed on `window.__perfReport` for
DevTools poking. `download=1` also saves `perf-<timestamp>.json`.

### Scenarios

| Name              | What it stresses                                                                       |
| ----------------- | -------------------------------------------------------------------------------------- |
| `idle-rack`       | Full rack, no interaction. Baseline.                                                   |
| `showcase-rack`   | Full rack + continuous rotation. Hits `CameraControls.rotate`.                         |
| `drilled-sled`    | Camera inside a compute sled. Many small meshes, close camera.                         |
| `rapid-selection` | Toggles selection between two sleds every 6 frames. Exercises the outline render path. |
| `orbit-stress`    | Full rack, camera rotating 0.02 rad/frame. CPU-light orbit baseline.                   |

### Ablation flags

| Flag                  | Purpose                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `frames=<n>`          | Measurement frames per scenario (default 300).                                                                               |
| `warmup=<n>`          | Discarded warmup frames (default 60).                                                                                        |
| `dpr=<n>`             | Override devicePixelRatio (e.g. `1`, `2`, `4`). Bypasses GPU-tier config.                                                    |
| `canvas=<px>`         | Pin canvas to a fixed square size.                                                                                           |
| `post=<mode>`         | `none`, `outline`, `ao`, `outline+ao`. Isolates post-processing passes.                                                      |
| `instancing=<mode>`   | `instanced` (default) or `cloned` — unrolls instances into individual meshes.                                                |
| `perforations=<mode>` | `on` (default) or `off` — strips alpha-tested perforation GLBs (sled / switch / power-shelf) to isolate their fillrate cost. |

## How it measures

- **GPU time:** `EXT_disjoint_timer_query_webgl2` wrapped in `GPUTimer`. Chrome/Edge only;
  Firefox/Safari report `gpuMs: null`.
- **CPU time:** `performance.now()` delta between a `useFrame(-Infinity)` (before R3F
  render) and a `useFrame(+Infinity)` (after EffectComposer's priority-1 pass). Covers the
  full R3F render including post.
- **Frame time:** Wall-clock delta between successive priority-`+Infinity` callbacks.
  V-syncs to 60Hz in most browsers — use `gpuMs`/`cpuMs` for real signal.
- **Memory:** `gl.info.{memory,programs}` for geometry/texture/shader counts;
  `performance.memory.usedJSHeapSize` for JS heap (Chrome-only). Snapshots taken at start,
  end, and every 60 frames — flat lines mean no leak.
- **Draw calls / triangles:** `gl.info.render.{calls,triangles}` with
  `gl.info.autoReset = false`.

### R3F gotchas baked into the harness

The `useFrame(-Infinity)` + `useFrame(+Infinity)` pattern disables R3F's auto-render (any
non-zero-priority frame subscriber does). This is fine in normal operation because
`EffectComposer` runs at priority 1 and does its own `gl.render`. But with `post=none`
there's no composer — so the harness mounts a `ManualRenderer` that explicitly calls
`gl.render(scene, camera)` at priority 0 to keep things rendering.

The `FirstRenderMarker` is gated behind `perfFlags.enabled` — without it, the production
build pays zero per-frame cost for the harness.

## Production cost when disabled

- `parsePerfFlags()` runs once at module load (reads `location.search`).
- `markInit(...)` fires three times at startup (gpuTier start/end, canvas created). Each
  writes a single field.
- `PerfHarness`, `ManualRenderer`, `FirstRenderMarker` — none mounted.
- `frameloop` stays `demand`; no forced continuous rendering.
- `PerfHarness.tsx` and `gpuTimer.ts` code-split into a ~5kB chunk that never loads without
  `?perf=`.

Bundle footprint when `?perf=` is absent: ~3kB for `harness.ts` (flag parser + types +
metric scaffolding). The `PerfHarness` chunk does not load.

---

# Findings (April 2026, M4 Max / Chrome 147)

GPU vendor: `Google Inc. (Apple)` / renderer: `ANGLE Metal Renderer: Apple M4 Max`.

## TL;DR

The app is **GPU-bound**, specifically **fragment/fillrate-bound at high DPR**. CPU is
comfortable (<3ms p99 everywhere). Post-processing is the dominant GPU cost and the most
actionable lever. Instancing is earning its keep.

## Cost breakdown

Baseline scenarios at the default config (tier-3 GPU, `dpr=[1,2]`, outline+AO):

| Scenario        | gpuMs p50 | cpuMs p50 | calls | tris  | programs |
| --------------- | --------- | --------- | ----- | ----- | -------- |
| idle-rack       | ~3–5      | 2.5       | 239   | 1.69M | 24       |
| drilled-sled    | ~3–5      | 2.7       | 225   | 355k  | 30       |
| rapid-selection | ~4–5      | 2.1       | 179   | 882k  | 24       |

## Ablations run (historical — before halfRes AO)

### Post-processing cost

`post=none` vs default, at `dpr=1`:

|                  | post=none | post=default                   |
| ---------------- | --------- | ------------------------------ |
| calls            | 93        | 239 (+146)                     |
| tris             | 717k      | 1.69M (+977k fullscreen quads) |
| programs         | 9         | 24 (+15)                       |
| gpuMs p50 (idle) | 1.66      | 4.54 (+2.9ms)                  |

Post-processing adds **~3ms GPU at dpr=1** and 15 extra shader programs.

### DPR / fillrate scaling

Going from `dpr=1` to `dpr=4` (16× pixels):

| Scenario        | gpuMs @ dpr=1 | gpuMs @ dpr=4 | ratio     |
| --------------- | ------------- | ------------- | --------- |
| idle-rack       | 4.54          | 42.76         | 9.4×      |
| drilled-sled    | 4.05          | 52.35         | **12.9×** |
| rapid-selection | 5.34          | 66.99         | **12.5×** |

Modeling: ~2ms fixed cost (vertex/program/draw-call) + fillrate. Most scenarios show ~10×
scaling for 16× pixels — sub-linear, fillrate dominates the delta. Drilled-sled and
rapid-selection scale _faster_ than linear on pixels, meaning they pick up per-pixel cost on
top of normal fillrate.

### rapid-selection @ dpr=4 is the danger zone

frameMs p95 = 83ms, p99 = 87ms — drops to ~12fps. Outline pass re-rendering the selected
object's silhouette + blur is the prime suspect.

### instancing=cloned

Unrolling 32 compute-sled instances into individual meshes costs **+868 draw calls**,
**+1.8ms CPU**, **+1.5ms GPU** on M4 Max. Invisible to a desktop user. On a low-tier GPU
where per-draw-call overhead is 10–50µs, those extra 868 calls would cost 9–43ms — so
`InstancedMesh2` is explicitly protecting the low-tier path. Don't remove it.

### No memory leak

Rapid-selection run over 1800 frames: geometries=120, textures=67, programs=24 completely
flat. JS heap sawtoothed 29–56MB with normal GC drops. The manual disposal logic in
`InstancedGLBModel.tsx` and `SelectableGLBModel.tsx` works.

## Open diagnostic

Drilled-sled at `dpr=4` with post costs **+10ms vs idle-rack** despite fewer triangles and
fewer draw calls. Root cause hypotheses:

1. **Outline blur:** silhouette of `compute-inner` covers a larger screen fraction than the
   full rack, so the Gaussian blur kernel hits more pixels.
2. **N8AO depth complexity:** stacked PCB + heatsink + shroud geometry means more occlusion
   samples hit real geometry per fragment.

The `post=ao` flag (added to isolate AO-only) lets us disambiguate: compare
`post=outline&dpr=4` vs `post=ao&dpr=4` for drilled-sled and read off each pass's fillrate.

---

# Interventions shipped

## `halfRes` on N8AO

`src/components/PostProcessing.tsx` — AO now samples at half resolution and upsamples.
Typical savings: 3–4× on the AO-specific GPU portion with slight edge softening. Safe
default because AO is already a blurred, low-frequency effect.

## Tier-2 DPR cap lowered 2.0 → 1.75

`src/Scene.tsx` `getGPUConfig`:

| Tier      | Old      | New                  |
| --------- | -------- | -------------------- |
| 3 (high)  | `[1, 2]` | `[1, 2]` (unchanged) |
| 2 (mid)   | `[1, 2]` | `[1, 1.75]`          |
| 0–1 (low) | `1`      | `1` (unchanged)      |

Tier-2 devices (mid-range integrated / older discrete) now render ~23% fewer fragments.
Visually nearly imperceptible, materially cheaper.

## `enableOutline` / `post=ao` for diagnostics

`PostProcessing` gained an `enableOutline` prop so we can mount AO without the outline pass.
The harness exposes it via `post=ao`, completing the 2×2 matrix of post-processing
ablations.

## Reverted: temporal AO amortization

A patch monkey-patched N8AO's `effectShaderQuad` / `poissonBlurQuad` / `accumulationQuad` to
noop on alternate frames, leaving the composite running every frame against the cached
accumulation target. Theory: halve the AO compute cost; only the AO mask is one frame stale.

Measured at dpr=4 on M4 Max (post=ao, 300 frames, mean gpuMs):

| Scenario        | temporal on | temporal off | Δ     |
| --------------- | ----------- | ------------ | ----- |
| idle-rack       | 17.94       | 17.62        | −0.32 |
| showcase-rack   | 16.25       | 17.10        | +0.85 |
| drilled-sled    | 16.17       | 16.99        | +0.81 |
| rapid-selection | 22.10       | 22.07        | −0.03 |
| orbit-stress    | 15.86       | 14.57        | −1.30 |

Deltas are within noise floor and split in sign — no real signal. The reason:
post-`halfRes`, the AO compute is small relative to the **normal pass** (full- res geometry
repass, owned by `EffectComposer` via `enableNormalPass`) and the **composite quad** —
neither of which the temporal patch touches. Halving an already-small slice yielded
~nothing. AO is also disabled on tier 0–1 (`enableAO: tierLevel >= 2`), so the only
candidate tiers are 2 and 3, both of which carry the same shape of cost breakdown.

Lesson: stack ablations carefully. `halfRes` collapsed the budget that temporal was sized to
amortize. Once `halfRes` shipped, temporal's premise no longer held, but we hadn't
re-measured.

## Perforation ablation (May 2026)

Question: do the alpha-tested perforation GLBs (sled / switch / power-shelf, `Perforations`
material with `alphaMap` + `alphaTest=0.5` + `DoubleSide`) cost meaningful GPU time, given
they're essentially everywhere in the rack views?

Added `?perforations=off` to strip them at render time, ran `?perf=all` and
`?perf=drilled-sled&dpr=4` both ways on M4 Max / Chrome 147.

### Median: free.

Default tier-3 config (DPR `[1,2]`, post=`outline+ao`):

| Scenario        | gpu p50 on | gpu p50 off | Δ     |
| --------------- | ---------- | ----------- | ----- |
| idle-rack       | 9.19       | 9.11        | -0.08 |
| showcase-rack   | 9.18       | 9.13        | -0.05 |
| drilled-sled    | 8.91       | 8.88        | -0.03 |
| rapid-selection | 10.07      | 9.66        | -0.41 |
| orbit-stress    | 9.10       | 9.11        | +0.01 |

Confirmed at `dpr=4` for drilled-sled across two independent runs: medians clustered 41–42ms
regardless of perforations. The perforation pass adds no measurable median GPU cost on this
GPU.

### Tail: ~40ms p99 spikes, reproducible.

| Scenario                      | gpu p99 on | gpu p99 off | Δ      |
| ----------------------------- | ---------- | ----------- | ------ |
| idle-rack (dpr default)       | 17.60      | 10.85       | -6.75  |
| drilled-sled (dpr default)    | 17.51      | 10.36       | -7.15  |
| rapid-selection (dpr default) | 21.33      | 18.49       | -2.84  |
| drilled-sled (dpr=4, run 1)   | 90.20      | 49.96       | -40.24 |
| drilled-sled (dpr=4, run 2)   | 90.28      | 49.81       | -40.47 |

The two `dpr=4` p99 measurements landing at `90.20` / `90.28` confirm this is a
deterministic stall, not measurement noise. Likely cause: Metal pipeline state change for
the alpha-test pass, or a composite swap that re-touches alpha-test fragments. Manifests as
occasional dropped frames during interaction — invisible at p50 dashboards, visible to a
user.

### Resource diff (rack-level scenarios, perforations on → off)

- draw calls: 257 → 217 (**-40, -16%**)
- programs: 27 → 23 (-4)
- geometries: 107 → 99 (-8)
- textures: 76 → 67 (-9; ~3 baked PBR maps per perforation GLB plus the shared
  `perforations.jpg` from the texture cache)
- triangles: 1.32M → 1.29M (-25k, -1.9%)

The 40-draw-call delta is invisible on M4 Max but would matter on a tier-1 mobile/integrated
GPU at 10–50µs per call (0.4–2ms total).

### Verdict: keep them on by default, watch the tail.

Perforations are visually load-bearing for hardware fidelity and cost nothing at the median.
The p99 spike is the only real cost, and it's worth attention only if low-tier hardware
reports stutter. Mitigations in priority order if it ever bites:

1. Bake the perforation pattern into the cosmo-ext shell as a single alphaMap'd material —
   eliminates the separate mesh + draw call + pipeline state change without changing the
   visual.
2. On detected tier 0–1 GPUs, swap the perforation mesh for a darker non-perforated panel
   (visual fidelity loss, eliminates the alpha-test path entirely).
3. Move perforations to a dedicated render pass with explicit depth pre-pass to stabilize
   alpha-test fragment cost. Most invasive; only warranted if 1–2 don't suffice.

**Update (May 2026):** the p99 stall was closed by a much simpler fix — switching
`SHARED_PERF_MATERIAL` to Lambert. See _Perforation material → Lambert_ below. None of the
three mitigations above were needed.

## Perforation material → Lambert (May 2026)

`SHARED_PERF_MATERIAL` switched from `MeshStandardMaterial` to `MeshLambertMaterial`. The
surface is fully diffuse black (`color=0x000000, metalness=0, roughness=1`), so PBR's
IBL/specular contribution to it is negligible — Lambert just skips the GGX path on every
alpha-test fragment and renders identically.

Re-ran `?perf=drilled-sled&dpr=4` on M4 Max, perforations on:

|             | Standard  | Lambert   | Δ                 |
| ----------- | --------- | --------- | ----------------- |
| gpuMs p50   | 42.12     | 35.77     | **-6.35 (-15%)**  |
| gpuMs p95   | 48.60     | 37.76     | -10.83 (-22%)     |
| gpuMs p99   | **90.28** | **38.08** | **-52.20 (-58%)** |
| frameMs p99 | 55.90     | 24.40     | -31.50 (-56%)     |
| draw calls  | 234       | 222       | -12               |
| programs    | 28        | 26        | -2                |

The 90ms p99 spike documented in the perforation ablation section is gone — p99 now sits
~0.3ms above p95, indistinguishable from frame noise. The original hypothesis was a Metal
pipeline state change for the alpha-test pass; removing PBR's uniform set, env-map binding,
and unused texture slots apparently collapsed enough of that state diff to eliminate the
stall. Median GPU also down ~15%, which suggests the StandardMaterial GGX evaluation was
non-trivial even on a tier-3 GPU once you multiply it by the alpha-test fragment count.

Net: closes the _watch the tail_ item from the perforation ablation.

## Per-instance frustum culling re-enabled (May 2026)

`InstancedMesh2.perObjectFrustumCulled` flipped from `false` to `true` in
`src/components/InstancedGLBModel.tsx`. The original `false` setting short-circuited
per-instance BVH culling entirely; the bet was that at rack-overview the whole batch is in
frustum so culling never engages and would only add traversal cost. Worth re-testing because
during close camera work (drilled-sled, rapid-selection) 31 of 32 sleds are outside the
frustum and could be skipped.

Re-ran `?perf=all` on M4 Max / Chrome 148, default tier-3 config (DPR `[1,2]`,
post=`outline+ao`):

| Scenario        | gpu p50 off→on | gpu p95           | gpu p99           | mean              |
| --------------- | -------------- | ----------------- | ----------------- | ----------------- |
| idle-rack       | 9.11 → 9.13    | 10.08 → 9.53      | 12.78 → 15.21     | 9.31 → 9.31       |
| showcase-rack   | 9.06 → 9.01    | 9.55 → 9.54       | 9.84 → 9.70       | 9.10 → 8.96       |
| drilled-sled    | 8.93 → 8.94    | 9.28 → 9.30       | 13.98 → **10.29** | 8.86 → 8.84       |
| rapid-selection | 9.70 → 9.53    | 18.34 → **16.64** | 19.38 → **17.10** | 11.49 → **10.38** |
| orbit-stress    | 9.05 → 9.01    | 9.63 → 9.64       | 10.27 → 10.02     | 9.00 → 8.95       |

Median is a wash on M4 Max, as expected: whole-rack scenarios have everything in frustum so
there's nothing to cull, and M4 Max has fillrate to spare for close-up scenarios. Tail
improves where it should: drilled-sled p99 −3.7ms, rapid-selection p95 −1.7ms / p99 −2.3ms /
mean −1.1ms. Triangle count during rapid-selection drops 28% (1.08M → 771k) — that's the
actual signal. The lone p99 regression (idle-rack +2.4ms) is one frame in 300 with p50 and
p95 flat; tail noise, not real cost.

CPU unchanged across all scenarios (BVH-traversal overhead invisible). Draw calls unchanged
(still one per InstancedMesh2 batch) — the saving is in skipped vertex shading on culled
instances, not in fewer calls.

Net: free win on M4 Max, more meaningful on tier-1 GPUs where vertex shading isn't free. The
28% triangle reduction during selection should translate proportionally on weaker hardware.

## Rejected: adaptive AO during user interaction

Prototype that toggled AO off during `controlstart` and back on 200ms after `controlend` was
visually distracting — the AO popping in on release was too noticeable to justify the
fillrate savings. Reverted.

Lesson: for a static hardware visualizer, the eye tracks the shading continuity even during
motion. Adaptive DPR is the same shape of idea and would likely have the same problem. If we
revisit, cross-fade via tweened `N8AO.intensity` rather than a hard toggle.

---

# Priority of follow-ups

1. **Confirm outline-blur hypothesis** with `post=outline&dpr=4` and `post=ao&dpr=4`
   comparisons. If outline dominates drilled-sled's +10ms, consider reducing `edgeStrength`
   or gating `blur` on high-tier GPUs.
2. **Consider tier-3 DPR cap at 1.75 too** if halfRes AO isn't enough on Retina. The quality
   loss is small and fillrate scales with pixel count.
3. **Do not** spend time on draw-call count or scene graph traversal — CPU is not the
   bottleneck on any measured configuration.
4. **Do not** merge instanced geometry back into monolithic meshes — the cloned ablation
   proves instancing saves ~3ms on the low-tier path.
