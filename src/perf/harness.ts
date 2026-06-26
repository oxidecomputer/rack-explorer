/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// Perf harness: URL-flag-driven scenario runner.
//
// Flags:
//   ?perf=<scenario|all>   — which scenario to run (idle-rack, showcase-rack,
//                             drilled-sled, rapid-selection, orbit-stress, all)
//   ?frames=<n>            — frames to measure per scenario (default 300)
//   ?warmup=<n>            — warmup frames to discard before measurement (default 60)
//   ?dpr=<n>               — override DPR (e.g. 0.25, 0.5, 1, 2)
//   ?canvas=<px|full>      — square canvas size (e.g. 256, 512, 1024) or full
//   ?post=<mode>           — none | outline | outline+ao
//   ?msaa=<n>              — force EffectComposer MSAA samples (0, 2, 4, 8),
//                            bypassing the probe — for sample-count ablation
//   ?instancing=<mode>     — instanced (default) | cloned (for ablation)
//   ?perforations=<mode>   — on (default) | off — strips alpha-tested perforation
//                            geometry to measure its overdraw cost
//   ?download=1            — auto-download results JSON when the run finishes

export type ScenarioName =
  | 'idle-rack'
  | 'showcase-rack'
  | 'drilled-sled'
  | 'rapid-selection'
  | 'orbit-stress'

export const ALL_SCENARIOS: ScenarioName[] = [
  'idle-rack',
  'showcase-rack',
  'drilled-sled',
  'rapid-selection',
  'orbit-stress',
]

export type PostMode = 'none' | 'outline' | 'ao' | 'outline+ao'
export type InstancingMode = 'instanced' | 'cloned'
export type PerforationsMode = 'on' | 'off'

export interface PerfFlags {
  enabled: boolean
  scenarios: ScenarioName[]
  frames: number
  warmup: number
  dprOverride: number | [number, number] | null
  canvasSize: number | 'full'
  postOverride: PostMode | null
  msaaOverride: number | null
  instancing: InstancingMode
  perforations: PerforationsMode
  download: boolean
}

export function parsePerfFlags(search: string = window.location.search): PerfFlags {
  const params = new URLSearchParams(search)
  const perf = params.get('perf')
  const enabled = perf !== null

  let scenarios: ScenarioName[] = []
  if (perf === 'all') {
    scenarios = [...ALL_SCENARIOS]
  } else if (perf && (ALL_SCENARIOS as string[]).includes(perf)) {
    scenarios = [perf as ScenarioName]
  }

  const frames = clampInt(params.get('frames'), 300, 30, 10_000)
  const warmup = clampInt(params.get('warmup'), 60, 0, 10_000)

  let dprOverride: number | [number, number] | null = null
  const dpr = params.get('dpr')
  if (dpr) {
    const n = Number(dpr)
    if (!Number.isNaN(n) && n > 0) dprOverride = n
  }

  let canvasSize: number | 'full' = 'full'
  const canvas = params.get('canvas')
  if (canvas && canvas !== 'full') {
    const n = Number(canvas)
    if (!Number.isNaN(n) && n > 0) canvasSize = Math.floor(n)
  }

  let postOverride: PostMode | null = null
  const post = params.get('post')
  if (post === 'none' || post === 'outline' || post === 'ao' || post === 'outline+ao') {
    postOverride = post
  }

  let msaaOverride: number | null = null
  const msaa = params.get('msaa')
  if (msaa !== null) {
    const n = Number(msaa)
    if (Number.isFinite(n) && n >= 0) msaaOverride = Math.floor(n)
  }

  const instancingRaw = params.get('instancing')
  const instancing: InstancingMode = instancingRaw === 'cloned' ? 'cloned' : 'instanced'

  const perforationsRaw = params.get('perforations')
  const perforations: PerforationsMode = perforationsRaw === 'off' ? 'off' : 'on'

  const download = params.get('download') === '1'

  return {
    enabled,
    scenarios,
    frames,
    warmup,
    dprOverride,
    canvasSize,
    postOverride,
    msaaOverride,
    instancing,
    perforations,
    download,
  }
}

function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

// ————————————————————————————————————————————————————————————————
// Metric aggregation
// ————————————————————————————————————————————————————————————————

export interface FrameSample {
  frameMs: number // wall-clock between frame start callbacks
  cpuMs: number // time between priority=-∞ and priority=+∞ (covers R3F render)
  calls: number // gl.info.render.calls
  triangles: number // gl.info.render.triangles
  programs: number
}

export interface MemorySnapshot {
  frame: number
  geometries: number
  textures: number
  programs: number
  heapUsedMB: number | null
}

export interface ScenarioResult {
  name: ScenarioName
  config: {
    dpr: number | [number, number] | null
    canvas: number | 'full'
    post: PostMode | null
    msaa: number | null
    instancing: InstancingMode
    perforations: PerforationsMode
  }
  framesMeasured: number
  frameMs: { median: number; p95: number; p99: number; mean: number }
  cpuMs: { median: number; p95: number; p99: number; mean: number }
  gpuMs: { median: number; p95: number; p99: number; mean: number } | null
  avgCalls: number
  avgTriangles: number
  programs: number
  memory: {
    geometries: number
    textures: number
    heapUsedMB: number | null
  }
  // Periodic snapshots throughout the measurement window — watch these for leaks.
  memoryTrajectory: MemorySnapshot[]
  notes?: string
}

export interface InitMetrics {
  navigationStart: number
  gpuTierStartMs: number | null
  gpuTierEndMs: number | null
  canvasCreatedMs: number | null
  firstRenderMs: number | null
  firstFullRenderMs: number | null // first frame where a model GLB is drawn
}

export interface PerfReport {
  flags: PerfFlags
  userAgent: string
  gpu: { vendor: string | null; renderer: string | null; gpuTimerSupported: boolean }
  init: InitMetrics
  scenarios: ScenarioResult[]
  timestamp: string
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

export function summarize(values: number[]): {
  median: number
  p95: number
  p99: number
  mean: number
} {
  if (values.length === 0) return { median: NaN, p95: NaN, p99: NaN, mean: NaN }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return {
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean,
  }
}

// ————————————————————————————————————————————————————————————————
// Init metric globals — mutated from Scene/App, read by the harness
// ————————————————————————————————————————————————————————————————

export const initMetrics: InitMetrics = {
  navigationStart:
    typeof performance !== 'undefined' && performance.timeOrigin
      ? performance.timeOrigin
      : 0,
  gpuTierStartMs: null,
  gpuTierEndMs: null,
  canvasCreatedMs: null,
  firstRenderMs: null,
  firstFullRenderMs: null,
}

export function markInit<K extends keyof InitMetrics>(key: K, value: number) {
  if (initMetrics[key] == null) {
    ;(initMetrics as unknown as Record<string, number | null>)[key] = value
  }
}

// ————————————————————————————————————————————————————————————————
// Report emission
// ————————————————————————————————————————————————————————————————

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function logReport(report: PerfReport) {
  console.log('[perf] report', report)
  const rows = report.scenarios.map((s) => ({
    scenario: s.name,
    'frame (ms p50)': s.frameMs.median.toFixed(2),
    'frame (ms p99)': s.frameMs.p99.toFixed(2),
    'cpu (ms p50)': s.cpuMs.median.toFixed(2),
    'gpu (ms p50)': s.gpuMs ? s.gpuMs.median.toFixed(2) : 'n/a',
    calls: Math.round(s.avgCalls),
    'tris (k)': (s.avgTriangles / 1000).toFixed(1),
    programs: s.programs,
    geom: s.memory.geometries,
    tex: s.memory.textures,
    heapMB: s.memory.heapUsedMB?.toFixed(1) ?? 'n/a',
  }))

  console.table(rows)
}
