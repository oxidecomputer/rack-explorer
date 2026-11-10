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
| `msaa=<n>`            | Force EffectComposer MSAA samples (`0`, `2`, `4`, `8`), bypassing the probe. For sample-count ablation.                      |
| `instancing=<mode>`   | `instanced` (default) or `cloned` — unrolls instances into individual meshes.                                                |
| `perforations=<mode>` | `on` (default) or `off` — strips alpha-tested perforation GLBs (sled / switch / power-shelf) to isolate their fillrate cost. |
| `canvasaa=<mode>`     | `off` (default) or `on` — restores the canvas's own MSAA + depth buffer alongside the composer's.                            |

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

**Correction (Nov 2026):** the normal pass named above as the dominant AO cost was never
used by N8AO at all — it has been removed. See _Unused normal pass and N8AO transparency
mode_ below.

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

## MSAA sample-count cap: 8× → 4× (probed, never hardcoded)

EffectComposer defaulted to 8× MSAA. On large displays the 8× multisampled renderbuffer
(`w×h×samples×bytesPerPixel`) overflowed ANGLE/Metal's per-resource allocation limit →
zero-size incomplete framebuffer → black scene. Fix: `probeMaxSamples()` (src/gpuProbe.ts)
empirically picks the highest count that allocates (4→2→0), and we capped the ceiling at 4×.
`?msaa=<n>` forces a count for ablation.

Ran `?perf=all&msaa={8,4,2}` on M4 Max / Chrome 149, default tier-3 config (DPR `[1,2]`,
post=auto). Frame time is v-sync-locked at 16.6ms — median gpuMs is the signal:

| Scenario        | gpu p50 @8× | @4×   | @2×   | 8→4   | 4→2  |
| --------------- | ----------- | ----- | ----- | ----- | ---- |
| idle-rack       | 10.43       | 10.29 | 8.65  | −1.3% | −16% |
| showcase-rack   | 10.49       | 9.98  | 8.14  | −4.9% | −18% |
| drilled-sled    | 10.20       | 10.05 | 8.23  | −1.5% | −18% |
| rapid-selection | 10.98       | 10.85 | 10.05 | −1.2% | −7%  |
| orbit-stress    | 10.10       | 10.27 | 8.86  | noise | −14% |

p99 mirrors it; rapid-selection p99 is the extreme: 20.2 → 20.4 → **13.4**.

- **8→4 is free** (within ±2% noise everywhere) and visually indistinguishable on edges. The
  8× default was pure waste — hence the cap.
- **4→2 is a real ~15–18% GPU win** (~2ms p50) but a genuine quality regression: 2×
  under-resolves the near-axis-aligned edges this app is full of. Not taken — GPU budget is
  comfortable (~10ms p50 vs 16.6ms at the shipping max DPR of 2), so there's no frame-rate
  to buy at this resolution. Weaker-GPU / huge-display cases are already covered by adaptive
  DPR and the probe's own 4→2→0 fallback.

Caveat: default-DPR runs (not the `dpr=4` danger zone), and M4 Max is best-case — the
relative MSAA cost grows with pixel count, but production caps DPR at 2.

---

# November 2026 pass (M4 Max / Chrome 157)

Method for everything in this section: production builds served with `vite preview`, driven
by headless Chrome via puppeteer (it reports `ANGLE Metal Renderer: Apple M4 Max`, i.e. the
real GPU, not SwiftShader), 1440×900 viewport. Render numbers are `?perf=all` with `dpr`
pinned, averaged over 3 runs (`dpr=2`) or 2 runs (`dpr=4`). Before = `main` at `22057ae`.

## Unused normal pass and N8AO transparency mode

Two post-processing passes were rendering the scene again every frame for no visual benefit:

1. **`enableNormalPass` on `EffectComposer`.** Adds a `NormalPass` that re-renders the whole
   scene with a normal override material. Only `SSAO` reads it.
   `@react-three/postprocessing`'s `N8AO` builds `new N8AOPostPass(scene, camera)` and takes
   depth from the composer's depth texture (`needsDepthTexture`), reconstructing normals
   itself. Removed.
2. **N8AO "transparency aware" mode.** `N8AOPostPass.detectTransparency()` walks the scene
   every frame and, if any material is `transparent`, sets `transparencyAware = true`
   permanently. The floor `Grid`, `RackShadow` and `Hitbox` all are. That mode costs two
   extra scene renders into full-res half-float targets, two depth-copy quads, four scene
   traversals and a `Map` of every object, per frame. Turned off via
   `pass.autoDetectTransparency = false` (setting `configuration.transparencyAware = false`
   is a no-op: it already starts false and the setter only reacts to changes).

GPU p50 (ms), before → after:

| Scenario        | dpr=2              | dpr=4                |
| --------------- | ------------------ | -------------------- |
| idle-rack       | 4.53 → 2.20 (−51%) | 28.79 → 12.80 (−56%) |
| showcase-rack   | 4.70 → 2.18 (−54%) | 29.09 → 13.07 (−55%) |
| drilled-sled    | 4.29 → 1.81 (−58%) | 28.14 → 12.15 (−57%) |
| rapid-selection | 4.78 → 2.46 (−49%) | 29.56 → 13.71 (−54%) |
| orbit-stress    | 4.77 → 2.52 (−47%) | 29.01 → 12.64 (−56%) |

- Draw calls (rack level) 235 → 137; triangles 1,279k → 738k — the normal pass was a full
  second copy of the scene.
- GPU p95 at `dpr=2`: ~7.9 → ~3.7ms. At `dpr=4`: 31–34 → 13–15ms.
- CPU p50 at `dpr=4`: ~9.2 → ~7.2ms (fewer scene traversals). `dpr=2` CPU is too noisy to
  call.

Visual check: canvas-only screenshots at identical harness poses are pixel-identical for
`idle-rack` (max channel delta 7/255). The only diff in `rapid-selection` is the sled
slide-out animation captured at a different phase. Outline and the AO contact shadow under
the rack are unchanged.

## Bundle split

The `PostProcessing` lazy chunk was 0.77kB because `Selection.tsx` imported
`selectionContext` from `@react-three/postprocessing` — a single-module package that also
imports `postprocessing` and `n8ao` — and `composerRef.ts` value-imported `postprocessing`.
Selection now uses its own context (`selectedObjects.ts`) and `PostProcessing` passes the
list to `<Outline selection>`. `DebugPanel` (tweakpane) is lazy and only mounts in debug
mode.

|                        | before                 | after                  |
| ---------------------- | ---------------------- | ---------------------- |
| main chunk             | 2,009 kB (599 kB gzip) | 1,648 kB (475 kB gzip) |
| `PostProcessing` chunk | 0.77 kB                | 212 kB                 |
| `DebugPanel` chunk     | —                      | 150 kB (debug only)    |

## Adaptive quality: evidence-based monitor for `frameloop="demand"`

drei's `<PerformanceMonitor>` assumes continuous rendering. Its sample window stays open
across idle gaps, so in demand mode a burst of frames followed by idle reads as a very low
fps. Two consequences:

- **Spurious degradation** when render bursts are shorter than the 500ms sample window. Real
  bursts are mostly longer than that — a drag renders for ~1.2s because camera-controls
  keeps easing after release — so in practice this rarely triggered. Simulated with drei's
  algorithm on synthetic timelines (fast GPU, moves 2.5s apart, 5 min):

  | Burst length | drei factor | new factor |
  | ------------ | ----------- | ---------- |
  | 1.2s         | 1.0         | 1.0        |
  | 0.6s         | 1.0         | 1.0        |
  | 0.5s         | 0.1         | 1.0        |
  | 0.4s         | 0.2         | 1.0        |

- **Tier promotion without evidence.** `perfFactor` starts at 1 and only changes on a
  monitor decision, and an idle page produces no samples. The 10s promotion timer therefore
  promoted every tier-0/1 device to tier 2 after 10s and tier 3 after 20s, idle or not. The
  demotion check (factor < 0.5 within 5s of promotion) was unreachable: the monitor moves at
  most 0.1 per ≥5s of samples. Reproduced in the browser by spoofing the GPU renderer string
  to `Intel(R) HD Graphics 4000`:

  |                                   | old                      | new                     |
  | --------------------------------- | ------------------------ | ----------------------- |
  | after load                        | tier 1, dpr 1, AO off    | tier 1, dpr 1, AO off   |
  | after 25s idle                    | **tier 3, dpr 2, AO on** | tier 1, dpr 1, AO off   |
  | after ~20s of continuous dragging | tier 3                   | tier 2, dpr 1.75, AO on |

  (Old: `tierBump` also never reset `detectedTier` on demotion.)

`FrameRateMonitor` (`frameRateMonitor.ts`) keeps drei's decision rule (10 samples × 500ms,
75% threshold, ±0.1 steps, refresh-rate-derived bounds) but is fed only real frame
intervals: `AdaptivePerformanceMonitor` records after every loop tick whether R3F already
has the next frame queued (`frameloop === 'always'` or `internal.frames > 0`), and only then
counts the gap to the next frame. Short bursts accumulate into one sample; idle time never
counts. Promotion now needs `PROMOTION_RENDER_MS` (10s) of measured full-rate rendering, and
a decline within `DEMOTION_WINDOW_MS` (10s) of measured rendering after a promotion demotes
and locks. The monitor resets its samples on tier change.

## Preloading and deferred BVH builds

- Rack-level GLBs, the Draco decoder and the `PostProcessing` chunk start loading when
  `Scene.tsx` evaluates, overlapping GPU tier detection instead of waiting for the Canvas to
  mount and suspend (`preload.ts`). `useLoader.preload` shares the `[GLTFLoader, path]`
  cache key with the components' `useLoader`, so nothing is fetched or decoded twice.
- Once the rack scene has committed, drill-in models (sled and switch internals) are
  prefetched in an idle callback, so the first drill-in no longer suspends the scene on a
  network fetch + decode.
- `ensureBoundsTree` now schedules the BVH build in idle time instead of running it during
  render. Raycasts only happen on click, and `acceleratedRaycast` falls back to the standard
  path for geometry without a BVH.

Cold load (fresh browser context each run), median of 5:

| Profile                                     | tier detected | first frame with models  |
| ------------------------------------------- | ------------- | ------------------------ |
| unthrottled (localhost), before → after     | 225 → 232ms   | 630 → 638ms (no change)  |
| 10 Mbps / 60ms RTT / 4× CPU, before → after | 806 → 1188ms  | **1845 → 1666ms (−10%)** |

Tier detection itself gets slower (it shares bandwidth and main thread with the preloads),
but nothing is visible until the models arrive, so first model frame is the metric that
matters. Variant tried and rejected: starting preloads only after tier detection requested
its benchmark chunk — tier detection was still slower (1271ms) and the first model frame
improved less (1755ms).

Drill-in: both `cosmo/lod1/interior.glb` and `sidecar/lod1/interior.glb` are fetched before
any interaction on every run of the new build, and on none of the old. Drill-in latency
itself was not timed.

## Canvas MSAA and depth buffer off when the composer owns the frame

With post-processing on, the scene renders into `EffectComposer`'s own multisampled target
and the canvas only receives one fullscreen triangle. The canvas was still created with
`antialias: true` (tier ≥ 2) and the default depth buffer, so the browser allocated a
full-resolution multisampled backbuffer plus depth and resolved it every frame for nothing.
Now `antialias` and `depth` are off unless `?post=none` (which renders straight to the
canvas). `?canvasaa=on` restores them for ablation.

GPU p50 (ms), before → after (baseline: `307042f`):

| Scenario        | dpr=2              | dpr=4                |
| --------------- | ------------------ | -------------------- |
| idle-rack       | 2.17 → 1.81 (−17%) | 12.24 → 9.23 (−25%)  |
| showcase-rack   | 2.17 → 1.81 (−17%) | 12.40 → 9.23 (−26%)  |
| drilled-sled    | 1.71 → 1.59 (−7%)  | 11.83 → 8.61 (−27%)  |
| rapid-selection | 2.54 → 2.14 (−16%) | 13.15 → 10.15 (−23%) |
| orbit-stress    | 2.40 → 1.93 (−20%) | 12.87 → 9.59 (−25%)  |

p95 follows (`dpr=4`: 12.9–15.4 → 9.8–11.9ms). The same build with `?canvasaa=on` lands
within 2–6% of baseline, so the gain is this change. Canvas-only screenshots across 34 poses
(rack, sled, switch, shelf, patch panel, several orbits each) match within the run noise
floor. Antialiasing is now the composer's MSAA on every tier; tier 0–1 previously had none
on the canvas either, so they only lose the unused depth buffer.

## Rejected: backface culling and draw-order tiers

Measured with the same harness, behind temporary flags:

- **Backface culling.** Every material in the GLBs is exported double-sided. Switching
  opaque materials to `FrontSide` saved only 3–5% GPU at `dpr=4` and was within noise at
  `dpr=2`. Winding is consistent in every GLB (no flipped neighbours), but several meshes
  are single-walled sheet (a rack column return, a switch heatsink cover, a switch front
  bracket, some sled/shelf parts) and open visible holes when culled.
- **Draw-order tiers** (`renderOrder` so rack skin and enclosures draw before internals, for
  early-z): no measurable change.

Both likely read as small here because Apple GPUs are tile-based with hidden-surface
removal: hidden fragments are rejected regardless of draw order. Immediate-mode desktop GPUs
(NVIDIA/AMD/Intel) may gain more from either; not measured.

## Not done yet (found in this pass)

- **Kiosk precache carries ~4.8MB of unused files:** every `lod0` model (~3MB,
  unreferenced), `images/og.png` (1MB; only the `.webp` is referenced) and
  `draco/draco_decoder.js` (0.7MB; only the fallback for browsers without WebAssembly).
- `DebugStats` is always mounted: a `getElementById` and `gl.info.reset()` every frame, and
  `gl.info.autoReset = false` permanently, even with debug off.
- `App` re-renders on every selection and tour-step change, and `Scene` isn't memoized, so
  each re-render reaches the R3F root.
- Meshopt (`EXT_meshopt_compression`) instead of Draco would mean a much smaller decoder and
  faster decode, at the cost of a pipeline change.

---

# Priority of follow-ups

1. ~~**Confirm outline-blur hypothesis**~~ — no longer reproduces. In the Nov 2026 runs
   drilled-sled at `dpr=4` costs the same as idle-rack (before: 28.1 vs 28.8ms; after: 12.2
   vs 12.8ms). Outline `blur` is off by default anyway.
2. **Tier-3 DPR cap at 1.75** — much less pressing now GPU time has halved (~2.2ms p50 at
   `dpr=2` on M4 Max).
3. **Do not** spend time on draw-call count or scene graph traversal — CPU is not the
   bottleneck on any measured configuration.
4. **Do not** merge instanced geometry back into monolithic meshes — the cloned ablation
   proves instancing saves ~3ms on the low-tier path.
5. **Clean the kiosk precache** (see _Not done yet_ above).
