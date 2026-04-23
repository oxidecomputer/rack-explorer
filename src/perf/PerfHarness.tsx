// Runs scripted scenarios inside the R3F canvas and emits a JSON perf report.
// The harness is inert unless `?perf=<scenario|all>` is set.

import { useFrame, useThree } from '@react-three/fiber'
import type { CameraControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'

import { selectedId, showcaseMode } from '../atoms'
import { GPUTimer } from './gpuTimer'
import {
  ALL_SCENARIOS,
  downloadJson,
  initMetrics,
  logReport,
  summarize,
  type FrameSample,
  type MemorySnapshot,
  type PerfFlags,
  type PerfReport,
  type ScenarioName,
  type ScenarioResult,
} from './harness'

const MEMORY_SNAPSHOT_INTERVAL = 60 // frames between memory snapshots

function readHeapMB(): number | null {
  // @ts-expect-error — non-standard, Chrome-only
  const mem = typeof performance.memory !== 'undefined' ? performance.memory : null
  if (!mem) return null
  return mem.usedJSHeapSize / (1024 * 1024)
}

type Phase = 'pending' | 'warmup' | 'measure' | 'done'

interface RunState {
  scenarioIdx: number
  phase: Phase
  frameCount: number
  samples: FrameSample[]
  memoryTrajectory: MemorySnapshot[]
  programs: number
  results: ScenarioResult[]
}

// Pick a deep ID so we exercise the "drilled-sled" render path
// (SelectableGLBModel per descendant model, no top-level InstancedGLBModels).
const DRILLED_ID = 'compute-inner:0'
const RAPID_IDS = ['compute-sled:0', 'compute-sled:15']

export function PerfHarness({
  cameraControlsRef,
  flags,
}: {
  cameraControlsRef: React.RefObject<CameraControls | null>
  flags: PerfFlags
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)

  const timerRef = useRef<GPUTimer | null>(null)
  const cpuStartRef = useRef(0)
  const lastFrameStartRef = useRef<number | null>(null)
  const frameIdxRef = useRef(0)
  const rapidPrevSel = useRef<string | null>(null)
  const runRef = useRef<RunState>({
    scenarioIdx: 0,
    phase: 'pending',
    frameCount: 0,
    samples: [],
    memoryTrajectory: [],
    programs: 0,
    results: [],
  })

  // Lazy-init GPU timer once the renderer exists.
  useEffect(() => {
    if (!gl) return
    const rawGl = gl.getContext() as WebGL2RenderingContext
    timerRef.current = new GPUTimer(rawGl)
    gl.info.autoReset = false
    return () => {
      timerRef.current?.dispose()
      timerRef.current = null
      gl.info.autoReset = true
    }
  }, [gl])

  // Kick off the first scenario once the canvas exists.
  useEffect(() => {
    if (!flags.enabled || flags.scenarios.length === 0) return
    startScenario(flags.scenarios[0])
    runRef.current.phase = 'warmup'
    runRef.current.frameCount = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.enabled])

  function startScenario(name: ScenarioName) {
    // Reset state between scenarios.
    showcaseMode.set(false)
    switch (name) {
      case 'idle-rack':
        selectedId.set('oxide-rack')
        break
      case 'showcase-rack':
        selectedId.set('oxide-rack')
        showcaseMode.set(true)
        break
      case 'drilled-sled':
        selectedId.set(DRILLED_ID)
        break
      case 'rapid-selection':
        selectedId.set(RAPID_IDS[0])
        rapidPrevSel.current = RAPID_IDS[0]
        break
      case 'orbit-stress':
        selectedId.set('oxide-rack')
        break
    }
    // Reset counters.
    gl.info.reset()
    runRef.current.samples = []
    runRef.current.memoryTrajectory = []
    runRef.current.frameCount = 0
    runRef.current.phase = 'warmup'
    frameIdxRef.current = 0
    lastFrameStartRef.current = null
  }

  function finishScenario(): ScenarioResult {
    const state = runRef.current
    const name = flags.scenarios[state.scenarioIdx]
    const samples = state.samples
    const gpuTimes = timerRef.current?.getAllResolved() ?? []
    timerRef.current?.dispose()
    // Rebuild for next scenario.
    const rawGl = gl.getContext() as WebGL2RenderingContext
    timerRef.current = new GPUTimer(rawGl)

    const frameMsArr = samples.map((s) => s.frameMs).filter((v) => Number.isFinite(v))
    const cpuMsArr = samples.map((s) => s.cpuMs).filter((v) => Number.isFinite(v))

    const heapUsedMB = readHeapMB()

    const avgCalls =
      samples.length > 0 ? samples.reduce((s, v) => s + v.calls, 0) / samples.length : 0
    const avgTris =
      samples.length > 0 ? samples.reduce((s, v) => s + v.triangles, 0) / samples.length : 0

    return {
      name,
      config: {
        dpr: flags.dprOverride,
        canvas: flags.canvasSize,
        post: flags.postOverride,
        instancing: flags.instancing,
      },
      framesMeasured: samples.length,
      frameMs: summarize(frameMsArr),
      cpuMs: summarize(cpuMsArr),
      gpuMs: gpuTimes.length > 0 ? summarize(gpuTimes) : null,
      avgCalls,
      avgTriangles: avgTris,
      programs: gl.info.programs?.length ?? 0,
      memory: {
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        heapUsedMB,
      },
      memoryTrajectory: state.memoryTrajectory,
    }
  }

  function finishAll() {
    const gpuInfo = readGpuInfo(gl.getContext() as WebGL2RenderingContext)
    const report: PerfReport = {
      flags,
      userAgent: navigator.userAgent,
      gpu: {
        vendor: gpuInfo.vendor,
        renderer: gpuInfo.renderer,
        gpuTimerSupported: !!timerRef.current?.supported,
      },
      init: { ...initMetrics },
      scenarios: runRef.current.results,
      timestamp: new Date().toISOString(),
    }
    logReport(report)
    if (flags.download) {
      const ts = report.timestamp.replace(/[:.]/g, '-')
      downloadJson(`perf-${ts}.json`, report)
    }
    // Also expose on window for easy poking in DevTools.
    ;(window as unknown as { __perfReport?: PerfReport }).__perfReport = report
  }

  // ————— per-frame driving —————

  // Run BEFORE the R3F render so we can start CPU+GPU timers.
  useFrame(() => {
    if (!flags.enabled || runRef.current.phase === 'pending' || runRef.current.phase === 'done') {
      return
    }
    const now = performance.now()
    cpuStartRef.current = now
    gl.info.reset()
    timerRef.current?.begin()

    // Force continuous rendering — many scenarios need demand-mode frames.
    invalidate()

    // Scenario-specific per-frame side effects.
    const name = flags.scenarios[runRef.current.scenarioIdx]
    frameIdxRef.current += 1

    if (name === 'rapid-selection' && frameIdxRef.current % 6 === 0) {
      const next = rapidPrevSel.current === RAPID_IDS[0] ? RAPID_IDS[1] : RAPID_IDS[0]
      rapidPrevSel.current = next
      selectedId.set(next)
    } else if (name === 'orbit-stress' && cameraControlsRef.current) {
      cameraControlsRef.current.rotate(0.02, 0, false)
    }
  }, -Infinity)

  // Run AFTER the R3F render (and EffectComposer pass, which sits at priority 1
  // in react-three/postprocessing) to capture the full frame cost.
  useFrame(() => {
    if (!flags.enabled || runRef.current.phase === 'pending' || runRef.current.phase === 'done') {
      return
    }
    timerRef.current?.end()
    timerRef.current?.poll()

    const now = performance.now()
    const cpuMs = now - cpuStartRef.current
    const frameMs =
      lastFrameStartRef.current != null ? now - lastFrameStartRef.current : NaN
    lastFrameStartRef.current = now

    const info = gl.info.render
    const sample: FrameSample = {
      frameMs,
      cpuMs,
      calls: info.calls,
      triangles: info.triangles,
      programs: gl.info.programs?.length ?? 0,
    }

    const state = runRef.current
    state.frameCount += 1

    if (state.phase === 'warmup') {
      if (state.frameCount >= flags.warmup) {
        state.phase = 'measure'
        state.frameCount = 0
        state.samples = []
      }
      return
    }

    if (state.phase === 'measure') {
      state.samples.push(sample)
      // Take a memory snapshot at start, end, and every interval in between.
      const isFirst = state.samples.length === 1
      const isInterval = state.samples.length % MEMORY_SNAPSHOT_INTERVAL === 0
      if (isFirst || isInterval) {
        state.memoryTrajectory.push({
          frame: state.samples.length,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          heapUsedMB: readHeapMB(),
        })
      }
      if (state.samples.length >= flags.frames) {
        // Final snapshot at scenario end.
        state.memoryTrajectory.push({
          frame: state.samples.length,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          heapUsedMB: readHeapMB(),
        })
        state.results.push(finishScenario())
        // Move to next scenario.
        if (state.scenarioIdx + 1 < flags.scenarios.length) {
          state.scenarioIdx += 1
          startScenario(flags.scenarios[state.scenarioIdx])
        } else {
          state.phase = 'done'
          finishAll()
        }
      }
    }
  }, Infinity)

  // Expose scene for debugging if needed.
  useEffect(() => {
    if (!flags.enabled) return
    ;(window as unknown as { __scene?: unknown }).__scene = scene
  }, [flags.enabled, scene])

  return null
}

function readGpuInfo(gl: WebGL2RenderingContext | WebGLRenderingContext): {
  vendor: string | null
  renderer: string | null
} {
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  if (!ext) return { vendor: null, renderer: null }
  return {
    vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string,
    renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string,
  }
}

// Re-export ALL_SCENARIOS so Scene / other callers don't need to import two modules.
export { ALL_SCENARIOS }
