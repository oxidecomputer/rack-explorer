import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import {
  CameraControls,
  Environment,
  Grid,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  debugMode,
  isVideoTour,
  lowQuality,
  navigationMode,
  sceneReady,
  selectedId,
  showcaseMode,
  specificationsOpen,
  tourStartScreen,
} from './atoms'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
import { TourAnnotations } from './components/TourAnnotations'
import { WireframeCube } from './components/WireframeCube'
import {
  componentTree,
  getDescendantModels,
  getInstanceContext,
  getInstances,
  getNode,
  getNodeModels,
  inheritInstanceIndex,
  isDescendantOf,
  resolveWaypoint,
} from './data/componentTree'
import { markInit, parsePerfFlags, type PerfFlags } from './perf/harness'

const perfFlags = parsePerfFlags()

const PostProcessing = lazy(() =>
  import('./components/PostProcessing').then((m) => ({ default: m.PostProcessing })),
)

type AOQuality = 'full' | 'low' | 'off'

// Harness is only referenced behind perfFlags.enabled; lazy-import keeps it out
// of the production bundle when ?perf= is not set.
const PerfHarness = lazy(() =>
  import('./perf/PerfHarness').then((m) => ({ default: m.PerfHarness })),
)

const { ACTION } = CameraControlsImpl

function RackShadow() {
  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
    const texture = new THREE.CanvasTexture(canvas)
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  }, [])

  useEffect(() => {
    return () => {
      material.map?.dispose()
      material.dispose()
    }
  }, [material])

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, 0.001, 0]}
      material={material}
    >
      <planeGeometry args={[1, 1.75]} />
    </mesh>
  )
}

function RackWireframe() {
  return (
    <WireframeCube size={[0.64, 2.28, 1.07]} position={[0, 1.205, 0]} color="#5D5E61" />
  )
}

function ShowcaseRotation({
  cameraControlsRef,
}: {
  cameraControlsRef: React.RefObject<CameraControls | null>
}) {
  const isShowcase = useValue(showcaseMode)

  useFrame((_state, delta) => {
    if (!isShowcase || !cameraControlsRef.current) return
    cameraControlsRef.current.rotate(delta * 0.15, 0, false)
  })

  return null
}

function CameraOffset() {
  const specsOpen = useValue(specificationsOpen)
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const isGuided = useValue(navigationMode) === 'guided'
  const currentOffset = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  const prevAppliedOffset = useRef(0)

  useFrame(({ camera, size }) => {
    const sidebarVisible = specsOpen && !isVideo && !(isGuided && isStartScreen)
    const target = sidebarVisible ? 0 : 128
    const diff = target - currentOffset.current

    if (Math.abs(diff) < 0.5) {
      currentOffset.current = target
    } else {
      currentOffset.current += diff * 0.12
      invalidate()
    }

    // Only update projection matrix when offset actually changed
    if (Math.abs(currentOffset.current - prevAppliedOffset.current) < 0.01) return
    prevAppliedOffset.current = currentOffset.current

    const cam = camera as THREE.PerspectiveCamera
    if (currentOffset.current < 0.5) {
      if (cam.view) cam.clearViewOffset()
    } else {
      cam.setViewOffset(
        size.width,
        size.height,
        -currentOffset.current,
        0,
        size.width,
        size.height,
      )
    }
    cam.updateProjectionMatrix()
  })

  useEffect(() => {
    invalidate()
  }, [specsOpen, isVideo, isGuided, isStartScreen, invalidate])

  return null
}

const BASE_FOV = 15
const REFERENCE_ASPECT = 16 / 9
// 0 = no zoom-out on narrow windows, 1 = constant horizontal FOV. Tweak here.
const NARROW_ZOOM_STRENGTH = 0.5

function AspectRatioFov() {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = width / height
    if (aspect < REFERENCE_ASPECT) {
      // Interpolate between BASE_FOV and constant-horizontal-FOV based on strength.
      const hFov = 2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * REFERENCE_ASPECT)
      const fullVFov = (2 * Math.atan(Math.tan(hFov / 2) / aspect) * 180) / Math.PI
      cam.fov = BASE_FOV + (fullVFov - BASE_FOV) * NARROW_ZOOM_STRENGTH
    } else {
      cam.fov = BASE_FOV
    }
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, width, height, invalidate])

  return null
}

function FirstRenderMarker() {
  useFrame(() => {
    markInit('firstRenderMs', performance.now())
  }, -Infinity)
  return null
}

// R3F disables auto-render whenever any useFrame has non-zero priority. When
// the perf harness is active (priority ±Infinity) AND post-processing is off
// (no EffectComposer at priority 1), nothing ends up calling gl.render().
// This fills that gap. Only mounted in perf+post=none mode.
function ManualRenderer() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    gl.render(scene, camera)
  }, 0)
  return null
}

function DebugStats({
  aoQuality,
  gpuTier,
  perfFactor,
}: {
  aoQuality: AOQuality
  gpuTier: number | undefined
  perfFactor: number
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  // Negative priority runs before the render/post-processing passes,
  // so we read the accumulated stats from the previous frame then reset.
  useFrame(() => {
    const el = document.getElementById('debug-stats')
    if (el) {
      const { triangles, calls } = gl.info.render
      let batches = 0
      let instances = 0
      scene.traverse((obj) => {
        const o = obj as {
          isInstancedMesh?: boolean
          isInstancedMesh2?: boolean
          count?: number
          instancesCount?: number
        }
        if (o.isInstancedMesh2) {
          batches++
          instances += o.instancesCount ?? 0
        } else if (o.isInstancedMesh) {
          batches++
          instances += o.count ?? 0
        }
      })
      const dpr = gl.getPixelRatio()
      const tierLabel = gpuTier ?? '?'
      el.textContent = `${(triangles / 1000).toFixed(1)}k tris · ${calls} calls · ${batches} batches / ${instances} instances · dpr ${dpr.toFixed(2)} · ao ${aoQuality} · factor ${perfFactor.toFixed(2)} · tier ${tierLabel}`
    }
    gl.info.reset()
  }, -Infinity)

  return null
}

function DebugOverlay() {
  const isDebug = useValue(debugMode)
  if (!isDebug) return null

  return (
    <>
      <div
        id="debug-stats"
        className="pointer-events-none absolute bottom-3 left-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white"
      />
      <Stats showPanel={0} className="" />
      <Stats showPanel={1} className="ml-20" />
      <Stats showPanel={2} className="ml-40" />
    </>
  )
}

function SceneContent({
  aoQuality,
  postMode,
  instancing,
  gpuTier,
  perfFactor,
}: {
  aoQuality: AOQuality
  postMode: PerfFlags['postOverride']
  instancing: PerfFlags['instancing']
  gpuTier: number | undefined
  perfFactor: number
}) {
  const cameraControlsRef = useRef<CameraControls>(null)
  const currentSelectedId = useValue(selectedId)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  const baseId = currentSelectedId.split(':')[0]

  // Find which top-level component we're viewing children of (if any)
  const viewingChildOfId = useMemo(() => {
    for (const child of componentTree.children ?? []) {
      if (child.children && isDescendantOf(baseId, child.id)) {
        return child.id
      }
    }
    return null
  }, [baseId])

  const instanceCtx = viewingChildOfId ? getInstanceContext(currentSelectedId) : null

  // Collect descendant models for the active parent (e.g. cosmo-lod0 when inside compute-sled)
  const descendantModels = useMemo(
    () => (viewingChildOfId ? getDescendantModels(viewingChildOfId) : []),
    [viewingChildOfId],
  )

  // Stable instance arrays for instanced components (avoids re-render cycles in ModifiedSelect)
  const instancesById = useMemo(() => {
    const map: Record<string, ReturnType<typeof getInstances>> = {}
    for (const child of componentTree.children ?? []) {
      if (child.instances && getNodeModels(child).length > 0) {
        map[child.id] = getInstances(child.id)
      }
    }
    return map
  }, [])

  const isFirstRender = useRef(true)
  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'

  useEffect(() => {
    if (!cameraControlsRef.current || !currentSelectedId) return

    const waypoint = resolveWaypoint(currentSelectedId)
    if (waypoint) {
      const animate = !isFirstRender.current
      isFirstRender.current = false
      if (animate) cameraControlsRef.current.normalizeRotations()
      cameraControlsRef.current.setLookAt(...waypoint.position, ...waypoint.target, animate)
    }
  }, [currentSelectedId, currentNavigationMode])

  return (
    <>
      <Environment files="./common/hdri.jpg" environmentIntensity={2} />
      <Grid
        cellSize={0.025}
        sectionSize={0.025}
        sectionColor="#373F41"
        cellColor="#373F41"
        scale={15}
        position={[0, 0, 0]}
        fadeDistance={25}
        fadeStrength={0.5}
      />
      <RackShadow />
      <ModifiedSelection>
        {postMode !== 'none' && (
          <PostProcessing
            aoQuality={
              postMode === 'outline+ao' || postMode === 'ao'
                ? 'full'
                : postMode === 'outline'
                  ? 'off'
                  : aoQuality
            }
            enableOutline={postMode !== 'ao'}
          />
        )}
        {postMode === 'none' && perfFlags.enabled && <ManualRenderer />}
        <group
          onPointerDown={(e) => {
            pointerDownPos.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isGuidedMode) return

            if (pointerDownPos.current) {
              const dx = e.clientX - pointerDownPos.current.x
              const dy = e.clientY - pointerDownPos.current.y
              if (dx * dx + dy * dy > 5 * 5) return
            }
            // Pick the deepest (most specific) component among all intersections
            // so child meshes win over overlapping parent meshes
            let bestId: string | null = null
            let bestDepth = -1
            for (const intersection of e.intersections) {
              const id = intersection.object?.userData?.id
              if (id) {
                const entry = getNode(id)
                if (entry && entry.depth > bestDepth) {
                  bestDepth = entry.depth
                  bestId = id
                }
              }
            }
            if (bestId) {
              selectedId.set(inheritInstanceIndex(currentSelectedId, bestId))
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (isGuidedMode) return
            const current = selectedId.get()
            if (!current) return
            const base = current.split(':')[0]
            const entry = getNode(base)
            const firstChild = entry?.node.children?.[0]
            if (firstChild) {
              selectedId.set(inheritInstanceIndex(current, firstChild.id))
            }
          }}
        >
          {/* Rack model — only at rack level */}
          {!viewingChildOfId &&
            getNodeModels(componentTree).map((model, i) => (
              <SelectableGLBModel
                key={`${componentTree.id}-${i}`}
                id={componentTree.id}
                path={model.path}
                clickable={model.clickable ?? true}
              />
            ))}

          {/* Wireframe rack outline when drilled in */}
          {viewingChildOfId && <RackWireframe />}

          {/* Top-level components from tree */}
          {componentTree.children?.map((node) => {
            const models = getNodeModels(node)
            if (models.length === 0) return null

            // Hide non-active siblings when drilled in
            if (viewingChildOfId && viewingChildOfId !== node.id) return null

            // When drilled into this component, render its descendant models
            if (viewingChildOfId === node.id && instanceCtx) {
              return (
                <group key={node.id} position={instanceCtx.instancePosition}>
                  {models
                    .filter((m) => m.showModelInChildView)
                    .map((model, i) => (
                      <SelectableGLBModel
                        key={`${node.id}-parent-${i}`}
                        id={node.id}
                        path={model.path}
                        clickable={false}
                        textures={model.textures}
                      />
                    ))}
                  {descendantModels
                    .filter(({ node: d }) => !d.hiddenWhenSelected?.includes(baseId))
                    .map(({ node: d, model }, i) => (
                      <SelectableGLBModel
                        key={`${d.id}-${i}`}
                        id={d.id}
                        path={model.path}
                        clickable={model.clickable ?? true}
                        textures={model.textures}
                        selectionOffset={d.selectionOffset}
                      />
                    ))}
                </group>
              )
            }

            // Instanced rendering — one InstancedGLBModel per model
            if (node.instances) {
              if (instancing === 'cloned') {
                // Ablation: render each instance as its own SelectableGLBModel
                // (cloned geometry + material per instance). Direct comparison
                // against the InstancedMesh2 path.
                return (
                  <group key={node.id}>
                    {instancesById[node.id].map((inst, instIdx) => (
                      <group key={instIdx} position={inst.position}>
                        {models.map((model, i) => (
                          <SelectableGLBModel
                            key={`${node.id}-${instIdx}-${i}`}
                            id={inst.id}
                            path={model.path}
                          />
                        ))}
                      </group>
                    ))}
                  </group>
                )
              }
              return (
                <group key={node.id}>
                  {models.map((model, i) => (
                    <InstancedGLBModel
                      key={`${node.id}-${i}`}
                      path={model.path}
                      instances={instancesById[node.id]}
                      selectionOffset={node.selectionOffset}
                    />
                  ))}
                </group>
              )
            }

            // Single positioned model(s)
            return (
              <group key={node.id}>
                {models.map((model, i) => (
                  <SelectableGLBModel
                    key={`${node.id}-${i}`}
                    id={node.id}
                    path={model.path}
                    position={model.position}
                  />
                ))}
              </group>
            )
          })}
        </group>
      </ModifiedSelection>
      {isGuidedMode && <TourAnnotations />}
      <CameraControls
        ref={cameraControlsRef}
        maxPolarAngle={Math.PI / 2}
        mouseButtons={{
          left: ACTION.ROTATE,
          middle: ACTION.NONE,
          right: ACTION.TRUCK,
          wheel: ACTION.NONE,
        }}
        touches={{
          one: ACTION.TOUCH_ROTATE,
          two: ACTION.NONE,
          three: ACTION.NONE,
        }}
      />
      <ShowcaseRotation cameraControlsRef={cameraControlsRef} />
      <AspectRatioFov />
      <CameraOffset />
      <DebugStats aoQuality={aoQuality} gpuTier={gpuTier} perfFactor={perfFactor} />
      {perfFlags.enabled && (
        <>
          <FirstRenderMarker />
          <PerfHarness cameraControlsRef={cameraControlsRef} flags={perfFlags} />
        </>
      )}
    </>
  )
}

type GPUConfig = {
  dpr: number | [number, number]
  enableAO: boolean
  tier?: number
}

const getGPUConfig = (tier: TierResult | null): GPUConfig => {
  // tier.tier: 0 (low) to 3 (high)
  const tierLevel = tier?.tier ?? 1
  return {
    dpr: tierLevel >= 3 ? [1, 2] : tierLevel >= 2 ? [1, 1.75] : 1,
    enableAO: tierLevel >= 2,
    tier: tierLevel,
  }
}

export const Scene = () => {
  const [detectedConfig, setDetectedConfig] = useState<GPUConfig>({
    dpr: 1,
    enableAO: false,
  })
  const isLowQuality = useValue(lowQuality)
  const lastMissTime = useRef(0)

  useEffect(() => {
    let cancelled = false
    markInit('gpuTierStartMs', performance.now())
    getGPUTier().then((tier) => {
      markInit('gpuTierEndMs', performance.now())
      if (!cancelled) setDetectedConfig(getGPUConfig(tier))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const baseGpuConfig: GPUConfig = isLowQuality
    ? { dpr: 1, enableAO: false }
    : detectedConfig
  const gpuConfig: GPUConfig = {
    dpr: perfFlags.dprOverride ?? baseGpuConfig.dpr,
    enableAO:
      perfFlags.postOverride === 'outline+ao' || perfFlags.postOverride === 'ao'
        ? true
        : perfFlags.postOverride === 'outline' || perfFlags.postOverride === 'none'
          ? false
          : baseGpuConfig.enableAO,
  }

  // Max DPR the GPU tier / override allows. Adaptive DPR scales in [1, maxDpr].
  const maxDpr = Array.isArray(gpuConfig.dpr) ? gpuConfig.dpr[1] : gpuConfig.dpr
  const [dpr, setDpr] = useState(maxDpr)
  useEffect(() => {
    setDpr(maxDpr)
  }, [maxDpr])

  // Adaptive AO quality: 'full' → 'low' → 'off' as perf factor drops.
  // Hysteresis prevents flicker around thresholds. Final value is gated by
  // gpuConfig.enableAO — low-tier GPUs that start with AO off stay off.
  const [adaptiveAO, setAdaptiveAO] = useState<'full' | 'low' | 'off'>('full')
  const [perfFactor, setPerfFactor] = useState(1)

  const initialWaypoint = resolveWaypoint('oxide-rack')
  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'
  const isShowcase = useValue(showcaseMode)

  // Perf mode forces continuous rendering and pins canvas size for deterministic runs.
  const canvasStyle =
    perfFlags.enabled && perfFlags.canvasSize !== 'full'
      ? {
          width: `${perfFlags.canvasSize}px`,
          height: `${perfFlags.canvasSize}px`,
        }
      : undefined

  return (
    <>
      <Canvas
        camera={{
          position: initialWaypoint?.position ?? [5, 5, 10],
          fov: 15,
          near: 1,
          far: 100,
        }}
        performance={{ current: 1, min: 0.5, max: 1, debounce: 200 }}
        className="absolute inset-0 z-0"
        style={canvasStyle}
        gl={{
          outputColorSpace: 'srgb',
          toneMapping: 0,
          premultipliedAlpha: false,
        }}
        dpr={dpr}
        linear
        frameloop={isShowcase || perfFlags.enabled ? 'always' : 'demand'}
        onPointerMissed={() => {
          if (isGuidedMode) return
          const now = performance.now()
          if (now - lastMissTime.current < 400) {
            const current = selectedId.get()
            if (!current) return
            const base = current.split(':')[0]
            const entry = getNode(base)
            if (entry?.parent) {
              selectedId.set(inheritInstanceIndex(current, entry.parent.id))
            }
          }
          lastMissTime.current = now
        }}
        onCreated={() => {
          markInit('canvasCreatedMs', performance.now())
          sceneReady.set(true)
        }}
      >
        <SceneContent
          aoQuality={gpuConfig.enableAO ? adaptiveAO : 'off'}
          postMode={perfFlags.postOverride}
          instancing={perfFlags.instancing}
          gpuTier={detectedConfig.tier}
          perfFactor={perfFactor}
        />
        <PerformanceMonitor
          ms={250}
          iterations={5}
          threshold={0.75}
          factor={1}
          bounds={(refreshrate) => (refreshrate > 90 ? [60, 100] : [40, 60])}
          onChange={({ factor }) => {
            setPerfFactor(factor)
            // Map factor (0..1) into [1, maxDpr].
            setDpr(Math.max(1, 1 + (maxDpr - 1) * factor))
            // Hysteresis: drop AO below 0.6, restore above 0.9. The 'low'
            // tier is kept available in PostProcessing for future use.
            if (factor < 0.6) setAdaptiveAO('off')
            else if (factor > 0.9) setAdaptiveAO('full')
          }}
        />
      </Canvas>
      <DebugOverlay />
    </>
  )
}
