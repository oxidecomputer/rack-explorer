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
import { useReducedMotion } from 'motion/react'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  debugMode,
  detectedTier,
  isVideoTour,
  lowTierRendering,
  navigationMode,
  postProcessingSetting,
  resolutionSetting,
  sceneReady,
  selectedId,
  showcaseMode,
  softwareRenderingDetected,
  specificationsOpen,
  tourStartScreen,
} from './atoms'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { MOBILE_SPECS_PANEL_HEIGHT } from './components/MobileSpecsDrawer'
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
import { detectSoftwareRendering } from './gpuProbe'
import { eventsWithoutHover } from './perf/eventsWithoutHover'
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
  const reducedMotion = useReducedMotion()
  const currentOffsetX = useRef(0)
  const currentOffsetY = useRef(0)
  const prevAppliedOffsetX = useRef(0)
  const prevAppliedOffsetY = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  useFrame(({ camera, size }) => {
    const isMobile = size.width < 1000
    const sidebarVisible = specsOpen && !isVideo && !(isGuided && isStartScreen)
    const targetX = isMobile || sidebarVisible ? 0 : 128
    const panelVisible = isMobile && !isVideo && !(isGuided && isStartScreen)
    const targetY = panelVisible ? MOBILE_SPECS_PANEL_HEIGHT / 2 : 0

    const diffX = targetX - currentOffsetX.current
    const diffY = targetY - currentOffsetY.current

    if (reducedMotion || Math.abs(diffX) < 0.5) currentOffsetX.current = targetX
    else {
      currentOffsetX.current += diffX * 0.12
      invalidate()
    }

    if (reducedMotion || Math.abs(diffY) < 0.5) currentOffsetY.current = targetY
    else {
      currentOffsetY.current += diffY * 0.12
      invalidate()
    }

    // Only update projection matrix when offset actually changed
    if (
      Math.abs(currentOffsetX.current - prevAppliedOffsetX.current) < 0.01 &&
      Math.abs(currentOffsetY.current - prevAppliedOffsetY.current) < 0.01
    ) {
      return
    }
    prevAppliedOffsetX.current = currentOffsetX.current
    prevAppliedOffsetY.current = currentOffsetY.current

    const cam = camera as THREE.PerspectiveCamera
    const hasOffset = currentOffsetX.current >= 0.5 || currentOffsetY.current >= 0.5
    if (!hasOffset) {
      if (cam.view) cam.clearViewOffset()
    } else {
      cam.setViewOffset(
        size.width,
        size.height,
        -currentOffsetX.current,
        currentOffsetY.current,
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

// Camera FOV is fixed; subject framing is driven by camera distance instead.
// Must match the `fov` passed to <Canvas camera={...}> below.
const FIXED_FOV = 15
// Default fraction of the frame the component fills in its binding dimension
// (1.0 = bbox edges touch frame edges). Overridable per-waypoint.
const DEFAULT_FIT_FRACTION = 1 / 1.5

const _camTarget = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _corner = new THREE.Vector3()
const _newPos = new THREE.Vector3()

// Zoom-in cap: minimum camera-to-target distance in world units.
const MIN_DOLLY_DISTANCE_TOP = 5
const MIN_DOLLY_DISTANCE_DRILLED = 1.5

// Static rack-bbox used to compute the zoom-out cap (max dolly distance) —
// we want "zoom out as far as needed to see the whole rack" regardless of
// what's currently selected, including when the rack model isn't in the scene.
const _rackWaypoint = resolveWaypoint('oxide-rack')
const RACK_BOX: THREE.Box3 | null = _rackWaypoint?.scale
  ? new THREE.Box3(
      new THREE.Vector3(
        _rackWaypoint.target[0] - _rackWaypoint.scale[0] / 2,
        _rackWaypoint.target[1] - _rackWaypoint.scale[1] / 2,
        _rackWaypoint.target[2] - _rackWaypoint.scale[2] / 2,
      ),
      new THREE.Vector3(
        _rackWaypoint.target[0] + _rackWaypoint.scale[0] / 2,
        _rackWaypoint.target[1] + _rackWaypoint.scale[1] / 2,
        _rackWaypoint.target[2] + _rackWaypoint.scale[2] / 2,
      ),
    )
  : null

/** Walk the scene to find objects tagged with the selected id (or its base id)
 *  and union their world-space bboxes. Skips recursion into matched subtrees. */
function findSelectedBox(scene: THREE.Scene, sel: string): THREE.Box3 | null {
  const baseId = sel.split(':')[0]
  const box = new THREE.Box3()
  let found = false
  function walk(obj: THREE.Object3D) {
    const id = obj.userData?.id
    if (typeof id === 'string' && (id === sel || id === baseId)) {
      // Walk parents up, then children down — useFrame runs before R3F's
      // pre-render scene matrix update, so ancestor matrixWorlds may reflect
      // the previous selection's instance position.
      obj.updateWorldMatrix(true, true)
      box.expandByObject(obj)
      found = true
      return
    }
    for (const child of obj.children) walk(child)
  }
  walk(scene)
  if (!found || box.isEmpty()) return null
  return box
}

/** Project the bbox onto the plane through `target` perpendicular to the
 *  given direction, then compute the camera distance such that the binding
 *  dimension (width or height — whichever is larger relative to the window)
 *  fills `fitFraction` of the frame. `verticalFitScale` < 1 reserves the
 *  bottom of the canvas (e.g. mobile specs drawer) by tightening only the
 *  height-bound calc — width-bound components still get full canvas width.
 *  The returned position lies along the direction ray, anchored at target. */
function computeFitPosition(
  box: THREE.Box3,
  waypointDir: [number, number, number],
  waypointTarget: [number, number, number],
  windowAspect: number,
  fitFraction: number | undefined,
  verticalFitScale: number = 1,
): [number, number, number] {
  _camTarget.fromArray(waypointTarget)
  // Camera direction points from target toward camera; forward is the inverse.
  _forward.fromArray(waypointDir).negate()
  if (_forward.lengthSq() < 1e-6) return waypointTarget
  _forward.normalize()

  _right.crossVectors(_forward, _worldUp)
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0)
  else _right.normalize()
  _up.crossVectors(_right, _forward).normalize()

  let maxX = 0
  let maxY = 0
  const { min, max } = box
  for (let i = 0; i < 8; i++) {
    _corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
    _corner.sub(_camTarget)
    maxX = Math.max(maxX, Math.abs(_corner.dot(_right)))
    maxY = Math.max(maxY, Math.abs(_corner.dot(_up)))
  }

  const tanHalfFov = Math.tan((FIXED_FOV * Math.PI) / 360)
  const f = fitFraction != null && fitFraction > 0 ? fitFraction : DEFAULT_FIT_FRACTION
  // Distance such that the projected dimension is `f` × window dimension.
  // verticalFitScale only tightens height — the canvas is still full-width.
  const dH = maxY / (f * verticalFitScale * tanHalfFov)
  const dW = maxX / (f * tanHalfFov * windowAspect)
  const dist = Math.max(dH, dW)

  _newPos.copy(_camTarget).addScaledVector(_forward, -dist)
  return [_newPos.x, _newPos.y, _newPos.z]
}

function CameraFitter({
  controlsRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>
}) {
  const sel = useValue(selectedId)
  const navMode = useValue(navigationMode)
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const reducedMotion = useReducedMotion()
  const isFirstFitRef = useRef(true)
  const lastFitKeyRef = useRef('')
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    invalidate()
  }, [sel, navMode, isVideo, isStartScreen, invalidate])

  useFrame(({ scene, size }) => {
    if (!controlsRef.current) return
    const isMobile = size.width < 1000
    const panelVisible = isMobile && !isVideo && !(navMode === 'guided' && isStartScreen)
    const fitKey = `${sel}|${navMode}|${size.width}|${size.height}|${panelVisible}`
    if (fitKey === lastFitKeyRef.current) return

    const waypoint = resolveWaypoint(sel)
    if (!waypoint) return
    let box = findSelectedBox(scene, sel)
    if (!box && waypoint.scale) {
      // No model attached — synthesize a focus volume from explicit scale.
      const [w, h, d] = waypoint.scale
      const [tx, ty, tz] = waypoint.target
      box = new THREE.Box3(
        new THREE.Vector3(tx - w / 2, ty - h / 2, tz - d / 2),
        new THREE.Vector3(tx + w / 2, ty + h / 2, tz + d / 2),
      )
    }
    if (!box) return // model still loading and no scale fallback — retry next frame

    const aspect = size.width / size.height
    // Mobile: bottom of viewport is covered by the specs drawer. Tighten only
    // the height-bound fit so the model fills the same proportion of the
    // *visible* height — width is unaffected since the drawer doesn't shrink
    // the canvas horizontally. CameraOffset re-centers vertically.
    const verticalFitScale = panelVisible
      ? (size.height - MOBILE_SPECS_PANEL_HEIGHT) / size.height
      : 1
    const position = computeFitPosition(
      box,
      waypoint.direction,
      waypoint.target,
      aspect,
      waypoint.fitFraction,
      verticalFitScale,
    )

    const fitDistance = Math.hypot(
      position[0] - waypoint.target[0],
      position[1] - waypoint.target[1],
      position[2] - waypoint.target[2],
    )
    // Zoom-out cap: distance needed to frame the whole rack from the current
    // target along the current waypoint direction. Reverts to fitDistance when
    // already at rack level (or larger than rack, e.g. mobile aspect), so the
    // user can never dolly out past the rack's overview shot.
    let maxDistance = fitDistance
    if (RACK_BOX && _rackWaypoint) {
      const rackPos = computeFitPosition(
        RACK_BOX,
        waypoint.direction,
        waypoint.target,
        aspect,
        _rackWaypoint.fitFraction,
        verticalFitScale,
      )
      maxDistance = Math.max(
        fitDistance,
        Math.hypot(
          rackPos[0] - waypoint.target[0],
          rackPos[1] - waypoint.target[1],
          rackPos[2] - waypoint.target[2],
        ),
      )
    }
    const baseId = sel.split(':')[0]
    const drilledIn = (componentTree.children ?? []).some(
      (child) => child.children && isDescendantOf(baseId, child.id),
    )
    const minDolly = drilledIn ? MIN_DOLLY_DISTANCE_DRILLED : MIN_DOLLY_DISTANCE_TOP
    controlsRef.current.minDistance = Math.min(fitDistance, minDolly)
    controlsRef.current.maxDistance = maxDistance

    const animate = !isFirstFitRef.current && !reducedMotion
    isFirstFitRef.current = false
    if (animate) controlsRef.current.normalizeRotations()
    controlsRef.current.setLookAt(...position, ...waypoint.target, animate)
    // camera-controls only writes camera.position inside its own update(),
    // which runs at priority -1 — *before* this useFrame at priority 0. So
    // for a non-animated snap, the new _spherical we just set won't reach
    // camera.position until the next frame, and in 'demand' mode that next
    // frame doesn't auto-fire. Flush synchronously so the same frame's render
    // uses the fit pose.
    if (!animate) controlsRef.current.update(0)
    lastFitKeyRef.current = fitKey
  })

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
        className="pointer-events-none absolute bottom-0 left-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white"
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
  lowTier,
}: {
  aoQuality: AOQuality
  postMode: PerfFlags['postOverride']
  instancing: PerfFlags['instancing']
  gpuTier: number | undefined
  perfFactor: number
  lowTier: boolean
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

  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'

  return (
    <>
      {lowTier ? (
        // Lambert lighting fallback — replaces the per-fragment env-map BRDF
        // sampling that's the dominant cost on integrated GPUs.
        <>
          <ambientLight intensity={0.8} />
          <directionalLight intensity={2.8} position={[5, 8, 6]} />
          <directionalLight intensity={0.4} position={[-6, 3, -4]} />
        </>
      ) : (
        <Environment files="./common/hdri.jpg" environmentIntensity={2} />
      )}
      {!lowTier && (
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
      )}
      {!viewingChildOfId && <RackShadow />}
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
                      textures={model.textures}
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
          wheel: ACTION.DOLLY,
        }}
        touches={{
          one: ACTION.TOUCH_ROTATE,
          two: ACTION.TOUCH_DOLLY,
          three: ACTION.NONE,
        }}
      />
      <ShowcaseRotation cameraControlsRef={cameraControlsRef} />
      <CameraFitter controlsRef={cameraControlsRef} />
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

// Safari masks WEBGL_debug_renderer_info, so @pmndrs/detect-gpu can't identify
// the GPU model and falls back to tier 1. On macOS the GPU is reliably capable
// (Apple Silicon or recent Intel + dGPU), so bump the tier to match what Chrome
// reports on the same hardware. iOS/iPadOS are left alone — adaptive DPR can't
// rescue an underpowered A-chip from being pushed past its budget.
const isSafariOnMac = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|EdgA|Edge|OPR/.test(ua)
  return isSafari && /Macintosh/.test(ua)
}

// detect-gpu's benchmark database lags new releases (e.g. RTX 5070 at time of
// writing) and some browsers (Brave's "Standard" fingerprinting protection)
// farble the renderer string so the lookup misses. Both produce
// type: 'FALLBACK' with a populated `gpu` field. Pattern-match known capable
// GPU families on FALLBACK only, so recognized weak GPUs (type: 'BENCHMARK')
// still flow through with their real tier.
const HIGH_TIER_RENDERER_RE =
  /(rtx\s*[3-9]\d{3}|geforce\s*(rtx\s*)?[3-9]\d{3}|radeon\s*rx\s*[6-9]\d{3}|apple\s*m\d|arc\s*[ab]\d{3})/i

const isUnrecognizedHighTierGPU = (tier: TierResult | null) =>
  tier?.type === 'FALLBACK' && !!tier.gpu && HIGH_TIER_RENDERER_RE.test(tier.gpu)

export const Scene = () => {
  // Null until getGPUTier() resolves. Canvas mount is deferred so GL context
  // options (powerPreference, antialias, precision) can be tier-aware — these
  // can't be changed after the WebGL context is created. Detection is ~30ms.
  const [detectedConfig, setDetectedConfig] = useState<GPUConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    if (detectSoftwareRendering()) softwareRenderingDetected.set(true)
    markInit('gpuTierStartMs', performance.now())
    getGPUTier().then((tier) => {
      markInit('gpuTierEndMs', performance.now())
      if (cancelled) return
      const shouldPromote =
        (isSafariOnMac() || isUnrecognizedHighTierGPU(tier)) && (tier?.tier ?? 0) < 3
      const effectiveTier = shouldPromote ? ({ ...tier, tier: 3 } as TierResult) : tier
      const config = getGPUConfig(effectiveTier)
      detectedTier.set(config.tier ?? 1)
      setDetectedConfig(config)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!detectedConfig) return null
  return <SceneCanvas detectedConfig={detectedConfig} />
}

const SceneCanvas = ({ detectedConfig }: { detectedConfig: GPUConfig }) => {
  const lastMissTime = useRef(0)
  const postSetting = useValue(postProcessingSetting)
  const dprSetting = useValue(resolutionSetting)
  // Respects a manual qualitySetting override and otherwise falls back to
  // (tier < 2). Same value the GLB model components observe.
  const lowTier = useValue(lowTierRendering)
  // Tier-bound flag captured at mount for the GL context options below — these
  // are immutable after WebGL context creation, so we can't track lowTier here.
  const [tierAtMount] = useState(() => (detectedConfig.tier ?? 1) < 2)

  // Tier promotion via sustained factor. detect-gpu's database lags new GPUs
  // and some browsers farble the renderer string, so capable GPUs can land on
  // tier 1 even after the renderer-string regex fallback. After
  // PROMOTION_DURATION_MS at factor ceiling, bump tier by one (capped at 3).
  // If factor immediately collapses post-promotion, demote once and lock to
  // prevent oscillation — adaptive DPR/AO can't claw back the Lambert→PBR
  // material cost on a truly tier-1 GPU. The user can still manually override
  // via the Quality dropdown either way.
  //
  // antialias and precision are immutable after canvas mount, so a promoted
  // user gets the Lambert→PBR / DPR / AO upgrade but not antialias until reload.
  const baseTier = detectedConfig.tier ?? 1
  const [tierBump, setTierBump] = useState(0)
  const [promotionLocked, setPromotionLocked] = useState(false)
  const promotedTier = Math.min(3, baseTier + tierBump)
  const effectiveConfig = useMemo<GPUConfig>(
    () =>
      promotedTier === baseTier
        ? detectedConfig
        : getGPUConfig({ tier: promotedTier } as TierResult),
    [detectedConfig, baseTier, promotedTier],
  )
  const lastPromotionRef = useRef<number | null>(null)
  useEffect(() => {
    if (tierBump > 0) {
      detectedTier.set(promotedTier)
      lastPromotionRef.current = performance.now()
    }
  }, [promotedTier, tierBump])

  const tierAOEnabled =
    perfFlags.postOverride === 'outline+ao' || perfFlags.postOverride === 'ao'
      ? true
      : perfFlags.postOverride === 'outline' || perfFlags.postOverride === 'none'
        ? false
        : effectiveConfig.enableAO

  // Max DPR the GPU tier / override allows. Adaptive DPR scales in [1, maxDpr].
  const dprConfig = perfFlags.dprOverride ?? effectiveConfig.dpr
  const maxDpr = Array.isArray(dprConfig) ? dprConfig[1] : dprConfig
  const [dpr, setDpr] = useState(maxDpr)
  useEffect(() => {
    setDpr(maxDpr)
  }, [maxDpr])
  // Manual resolution overrides pin DPR regardless of perf factor.
  useEffect(() => {
    if (dprSetting === 'high') setDpr(maxDpr)
    else if (dprSetting === 'low') setDpr(1)
  }, [dprSetting, maxDpr])

  // Adaptive AO quality: 'full' → 'off' as perf factor drops. Hysteresis
  // prevents flicker. Only takes effect when postSetting === 'auto' AND the
  // tier supports AO; otherwise the manual or tier-disabled value wins.
  const [adaptiveAO, setAdaptiveAO] = useState<'full' | 'low' | 'off'>('full')
  const [perfFactor, setPerfFactor] = useState(1)

  // Promotion timer: factor sustained above PROMOTION_FACTOR_THRESHOLD for the
  // full duration → bump tier. The first-crossed timestamp lives in a ref so
  // the timer resumes from where it left off across PerformanceMonitor's
  // onChange wobbles within the high range (factor 0.97 → 1.0 → 0.98 …).
  // Resets if factor drops below the threshold.
  const promotePendingSinceRef = useRef<number | null>(null)
  useEffect(() => {
    if (promotionLocked || promotedTier >= 3) return
    if (perfFactor < 0.95) {
      promotePendingSinceRef.current = null
      return
    }
    if (promotePendingSinceRef.current === null) {
      promotePendingSinceRef.current = performance.now()
    }
    const remaining = 10_000 - (performance.now() - promotePendingSinceRef.current)
    if (remaining <= 0) {
      promotePendingSinceRef.current = null
      setTierBump((b) => b + 1)
      return
    }
    const timer = window.setTimeout(() => {
      promotePendingSinceRef.current = null
      setTierBump((b) => b + 1)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [perfFactor, promotedTier, promotionLocked])

  // Demotion verifier: within 5s of a recent promotion, if factor stays below
  // 0.5 for 2s, the GPU couldn't keep up — undo the bump and lock to prevent
  // oscillation. PerformanceMonitor reacts to a tier change within ~1.5s, so
  // a low reading inside this window is a real signal, not measurement lag.
  // Outside the window, transient stutters from unrelated causes (model
  // loading, scene transition) are tolerated by adaptive DPR/AO.
  const demotePendingSinceRef = useRef<number | null>(null)
  useEffect(() => {
    if (tierBump === 0) return
    if (lastPromotionRef.current === null) return
    if (performance.now() - lastPromotionRef.current > 5_000) {
      demotePendingSinceRef.current = null
      return
    }
    if (perfFactor > 0.5) {
      demotePendingSinceRef.current = null
      return
    }
    if (demotePendingSinceRef.current === null) {
      demotePendingSinceRef.current = performance.now()
    }
    const elapsed = performance.now() - demotePendingSinceRef.current
    const demote = () => {
      demotePendingSinceRef.current = null
      lastPromotionRef.current = null
      setTierBump((b) => Math.max(0, b - 1))
      setPromotionLocked(true)
    }
    if (elapsed >= 2_000) {
      demote()
      return
    }
    const timer = window.setTimeout(demote, 2_000 - elapsed)
    return () => window.clearTimeout(timer)
  }, [perfFactor, tierBump])

  // Effective AO quality routed into PostProcessing.
  const effectiveAO: AOQuality =
    postSetting === 'high'
      ? 'full'
      : postSetting === 'low'
        ? 'low'
        : tierAOEnabled
          ? adaptiveAO
          : 'off'

  // Initial camera pose before the first fit lands. CameraFitter will dolly
  // to the bbox-derived distance on the first frame the rack model is loaded.
  const initialWaypoint = resolveWaypoint('oxide-rack')
  const initialPosition: [number, number, number] = initialWaypoint
    ? [
        initialWaypoint.target[0] + initialWaypoint.direction[0],
        initialWaypoint.target[1] + initialWaypoint.direction[1],
        initialWaypoint.target[2] + initialWaypoint.direction[2],
      ]
    : [5, 5, 10]
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
          position: initialPosition,
          fov: FIXED_FOV,
          near: 1,
          far: 100,
        }}
        events={eventsWithoutHover}
        performance={{ current: 1, min: 0.5, max: 1, debounce: 200 }}
        className="absolute inset-0 z-0"
        style={canvasStyle}
        gl={{
          outputColorSpace: 'srgb',
          toneMapping: 0,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
          antialias: !tierAtMount,
          precision: tierAtMount ? 'mediump' : 'highp',
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
          aoQuality={effectiveAO}
          postMode={perfFlags.postOverride}
          instancing={perfFlags.instancing}
          gpuTier={effectiveConfig.tier}
          perfFactor={perfFactor}
          lowTier={lowTier}
        />
        <PerformanceMonitor
          ms={250}
          iterations={5}
          threshold={0.75}
          factor={1}
          bounds={(refreshrate) => (refreshrate > 90 ? [60, 100] : [40, 60])}
          onChange={({ factor }) => {
            setPerfFactor(factor)
            // Adaptive DPR: only when 'auto'. 'high'/'low' pin via the effect above.
            if (dprSetting === 'auto') {
              setDpr(Math.max(1, 1 + (maxDpr - 1) * factor))
            }
            // Adaptive AO: only when 'auto' (manual high/low bypasses adaptiveAO).
            // Hysteresis: drop below 0.6, restore above 0.9.
            if (postSetting === 'auto') {
              if (factor < 0.6) setAdaptiveAO('off')
              else if (factor > 0.9) setAdaptiveAO('full')
            }
          }}
        />
      </Canvas>
      <DebugOverlay />
    </>
  )
}
