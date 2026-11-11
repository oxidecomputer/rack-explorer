/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { getGPUTier, type ModelEntry, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid, Stats } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { useReducedMotion } from 'motion/react'
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import * as THREE from 'three'

import {
  activeTourStep,
  debugMode,
  detectedTier,
  environmentIntensity,
  fitFractionMultiplier,
  hdriRotationX,
  hdriRotationY,
  hdriRotationZ,
  idleTourActive,
  isVideoTour,
  lowTierRendering,
  maxZoomMultiplier,
  navigationMode,
  postProcessingSetting,
  rackCount,
  resolutionSetting,
  sceneReady,
  selectedId,
  showcaseMode,
  showcaseRotationSpeed,
  showHdriBackground,
  softwareRenderingDetected,
  specificationsOpen,
  togglePlayWithFlash,
  tourStartScreen,
  visibleSledSlots,
} from './atoms'
import { CanvasExporter } from './components/CanvasExporter'
import { ConfiguratorOverlay } from './components/ConfiguratorOverlay'
import { Hitbox } from './components/Hitbox'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { MOBILE_SPECS_PANEL_HEIGHT } from './components/MobileSpecsDrawer'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
import { TourAnnotations } from './components/TourAnnotations'
import { WireframeCube } from './components/WireframeCube'
import {
  componentTree,
  getDescendantHitboxes,
  getDescendantModels,
  getInstanceContext,
  getInstances,
  getNode,
  getNodeModels,
  inheritInstanceIndex,
  isDescendantOf,
  resolveWaypoint,
  type ModelConfig,
} from './data/componentTree'
import { getLayoutBounds, getLayoutWaypoint, RACK_SIZE } from './data/configurator'
import { detectSoftwareRendering, probeMaxBufferSize, probeMaxSamples } from './gpuProbe'
import { AdaptivePerformanceMonitor } from './perf/AdaptivePerformanceMonitor'
import { eventsWithoutHover } from './perf/eventsWithoutHover'
import type { FrameRateSample } from './perf/frameRateMonitor'
import { markInit, parsePerfFlags, type PerfFlags } from './perf/harness'
import { prefetchDrillInModels, preloadRackModels } from './preload'

const perfFlags = parsePerfFlags()

/** One raised-floor tile: a rack's width. */
const FLOOR_TILE = RACK_SIZE[0]
/** Center the modelled rack on its tiles: one tile wide, and two tiles deep
 *  with an equal margin front and back (≈ (1200 − 1060) / 2 = 70 mm). Grid
 *  lines fall on multiples of the tile from this point. */
const FLOOR_TILE_OFFSET: [number, number, number] = [
  FLOOR_TILE / 2,
  0,
  RACK_SIZE[2] / 2 + (2 * FLOOR_TILE - RACK_SIZE[2]) / 2,
]

// Perf ablation: when ?perforations=off, skip GLBs whose alpha-test geometry
// (Perforations material) drives extra fragment cost.
function isPerforationModel(model: ModelConfig): boolean {
  return !!model.textures && 'Perforations' in model.textures
}
function filterPerforations(models: ModelConfig[]): ModelConfig[] {
  if (perfFlags.perforations !== 'off') return models
  return models.filter((m) => !isPerforationModel(m))
}

// With the EffectComposer mounted, the scene renders into the composer's own
// multisampled target and the canvas only ever receives one fullscreen
// triangle. A canvas MSAA + depth buffer would be allocated at full resolution
// and resolved every frame for nothing. `?post=none` renders straight to the
// canvas, so it keeps both; `?canvasaa=on` restores them for ablation.
const composerOwnsFrame = perfFlags.postOverride !== 'none' && perfFlags.canvasAA !== 'on'

const includeModel = (model: ModelConfig) =>
  !(perfFlags.perforations === 'off' && isPerforationModel(model))

// Start network + Draco decode for the rack overview, and the PostProcessing
// chunk the scene also suspends on, at module load so they overlap GPU tier
// detection instead of starting when the Canvas mounts. This does slow tier
// detection itself (it shares bandwidth and main thread), but nothing is
// visible until the models arrive, and first model frame is what improves —
// measured 1.88s → 1.69s on a throttled cold load. Starting these only after
// tier detection requested its benchmark chunk measured worse (1.76s).
preloadRackModels(includeModel)
const loadPostProcessing = () =>
  import('./components/PostProcessing').then((m) => ({ default: m.PostProcessing }))
void loadPostProcessing()
const PostProcessing = lazy(loadPostProcessing)

// Debug-only; lazy so tweakpane (~145kB) stays out of the main bundle.
const DebugPanel = lazy(() =>
  import('./components/DebugPanel').then((m) => ({ default: m.DebugPanel })),
)

type AOQuality = 'full' | 'low' | 'off'

// Harness is only referenced behind perfFlags.enabled; lazy-import keeps it out
// of the production bundle when ?perf= is not set.
const PerfHarness = lazy(() =>
  import('./perf/PerfHarness').then((m) => ({ default: m.PerfHarness })),
)

const { ACTION } = CameraControlsImpl

function HDRIEnvironment() {
  const rotX = useValue(hdriRotationX)
  const rotY = useValue(hdriRotationY)
  const rotZ = useValue(hdriRotationZ)
  const intensity = useValue(environmentIntensity)
  const showBackground = useValue(showHdriBackground)
  const invalidate = useThree((s) => s.invalidate)
  const rotation = useMemo(() => new THREE.Euler(rotX, rotY, rotZ), [rotX, rotY, rotZ])
  useEffect(() => {
    invalidate()
  }, [rotX, rotY, rotZ, intensity, showBackground, invalidate])
  return (
    <Environment
      files="./common/hdri.jpg"
      environmentIntensity={intensity}
      environmentRotation={rotation}
      background={showBackground}
      backgroundRotation={rotation}
      backgroundIntensity={intensity}
    />
  )
}

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

/** Floor: raised data center tiles, one rack wide (600 mm), with the
 *  modelled rack centered on a 1 × 2 tile footprint. Faded out from the rack
 *  rather than the camera so a zoomed-out configurator layout keeps its
 *  floor. Its own component so a rack-count change re-renders only this. */
function DataCenterFloor() {
  const isConfigure = useValue(navigationMode) === 'configure'
  const configuredRacks = useValue(rackCount)
  const racks = isConfigure ? configuredRacks : 1
  // Fade the floor out just past the furthest rack.
  const fade = useMemo(() => {
    const { min, max } = getLayoutBounds(racks)
    return Math.max(22, Math.hypot(max[0] - min[0], max[2] - min[2]) + 10)
  }, [racks])
  // Grid's cellSize is in the plane's local units, so size the plane with
  // `args` (not `scale`) to keep tiles in world units.
  const size = fade * 2.5
  return (
    <Grid
      args={[size, size]}
      cellSize={FLOOR_TILE}
      sectionSize={FLOOR_TILE}
      sectionColor="#373F41"
      cellColor="#373F41"
      position={FLOOR_TILE_OFFSET}
      fadeDistance={fade}
      fadeFrom={0}
      fadeStrength={1}
    />
  )
}

/** InstancedGLBModel that, for compute sleds, shows only the configured bays.
 *  Reads the bays itself so a sled-count change doesn't re-render the scene. */
function InstancedModel({
  configurableSleds,
  ...props
}: Omit<ComponentProps<typeof InstancedGLBModel>, 'visibleInstances'> & {
  configurableSleds: boolean
}) {
  const slots = useValue(visibleSledSlots)
  return (
    <InstancedGLBModel {...props} visibleInstances={configurableSleds ? slots : null} />
  )
}

function RackWireframe() {
  return (
    <WireframeCube size={[0.64, 2.28, 1.07]} position={[0, 1.205, 0]} color="#5D5E61" />
  )
}

function ShowcaseRotation({
  cameraControlsRef,
  spinDirectionRef,
}: {
  cameraControlsRef: React.RefObject<CameraControls | null>
  spinDirectionRef: React.RefObject<1 | -1>
}) {
  const isShowcase = useValue(showcaseMode)
  const isIdleTour = useValue(idleTourActive)
  const speed = useValue(showcaseRotationSpeed)

  useFrame((_state, delta) => {
    if (!(isShowcase || isIdleTour) || !cameraControlsRef.current) return
    // The idle tour keeps flying between steps; rotating with a transition
    // lets the orbit ride on top of those fits instead of snapping their angle.
    const direction = isIdleTour ? spinDirectionRef.current : 1
    cameraControlsRef.current.rotate(delta * speed * direction, 0, isIdleTour)
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

  useFrame(({ camera, size }, delta) => {
    const isMobile = size.width < 1000
    const sidebarVisible = specsOpen && !isVideo && !(isGuided && isStartScreen)
    const targetX = isMobile || sidebarVisible ? 0 : 128
    const panelVisible = isMobile && !isVideo && !(isGuided && isStartScreen)
    const targetY = panelVisible ? MOBILE_SPECS_PANEL_HEIGHT / 2 : 0

    const diffX = targetX - currentOffsetX.current
    const diffY = targetY - currentOffsetY.current

    // Frame-rate independent exponential decay; rate at 60fps ≈ 0.12.
    const rate = 1 - Math.pow(0.0005, delta)

    if (reducedMotion || Math.abs(diffX) < 0.5) currentOffsetX.current = targetX
    else {
      currentOffsetX.current += diffX * rate
      invalidate()
    }

    if (reducedMotion || Math.abs(diffY) < 0.5) currentOffsetY.current = targetY
    else {
      currentOffsetY.current += diffY * rate
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

/** Horizontal space a sidebar takes from the canvas: its 256px card plus the
 *  16px page padding. */
const SIDEBAR_INSET = 272
/** Space kept clear at the top (header) and bottom (rack stepper) when the
 *  configurator frames its layout. Symmetric, since the view isn't offset
 *  vertically. */
const CONFIGURE_VERTICAL_INSET = 80

/** Far plane for normal framing; CameraFitter raises it for big layouts. */
const BASE_FAR = 100

type ZoomBlend = {
  /** Distance at or below which the orbit centers on `from`. */
  near: number
  /** Distance at which it centers on `to` (the fitted, max zoom-out). */
  far: number
  from: [number, number, number]
  to: [number, number, number]
}

const _blendTarget = new THREE.Vector3()
const _rackFitBox = new THREE.Box3()
const _rackFitMin = new THREE.Vector3()
const _rackFitMax = new THREE.Vector3()
const _camTarget = new THREE.Vector3()
const _boxSize = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _corner = new THREE.Vector3()
const _newPos = new THREE.Vector3()
const _curCamPos = new THREE.Vector3()
const _curCamTgt = new THREE.Vector3()
const _endSpherical = new THREE.Spherical()
const _curSpherical = new THREE.Spherical()

/** How much slower camera fits run during the kiosk idle tour. The orbit adds
 *  its own swing on top of each move, so full-speed fits read as jarring. */
const IDLE_TOUR_TRANSITION_SLOWDOWN = 2

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
  horizontalFitScale: number = 1,
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
  const dW = maxX / (f * horizontalFitScale * tanHalfFov * windowAspect)
  const dist = Math.max(dH, dW)

  _newPos.copy(_camTarget).addScaledVector(_forward, -dist)
  return [_newPos.x, _newPos.y, _newPos.z]
}

function CameraFitter({
  controlsRef,
  spinDirectionRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>
  spinDirectionRef: React.RefObject<1 | -1>
}) {
  const sel = useValue(selectedId)
  const navMode = useValue(navigationMode)
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const tourStep = useValue(activeTourStep)
  const racks = useValue(rackCount)
  const specsOpen = useValue(specificationsOpen)
  // Configure mode frames the whole floor layout rather than a component.
  const configWaypoint = useMemo(
    () => (navMode === 'configure' ? getLayoutWaypoint(racks) : null),
    [navMode, racks],
  )
  const stepWaypoint = navMode === 'guided' ? (tourStep?.waypoint ?? null) : configWaypoint
  const fitFractionMult = useValue(fitFractionMultiplier)
  const maxZoomMult = useValue(maxZoomMultiplier)
  const isIdleTour = useValue(idleTourActive)
  const reducedMotion = useReducedMotion()
  const isFirstFitRef = useRef(true)
  const lastFitKeyRef = useRef('')
  const invalidate = useThree((s) => s.invalidate)
  // Configure mode: zooming slides the orbit center from the whole layout
  // (at the fitted, max zoom-out distance) to the modelled rack (at the
  // single-rack framing distance or closer). Set at each fit; null elsewhere.
  const zoomBlendRef = useRef<ZoomBlend | null>(null)
  // Only the user's own zooming drives the blend, not a fit's animated dolly.
  const userControlRef = useRef(false)
  const lastBlendDistanceRef = useRef<number | null>(null)
  // Half the diagonal of the last framed volume.
  const framedRadiusRef = useRef(0)

  // Keep the framed volume (and the floor fading out behind it) inside the
  // clip range. Uses the camera's current distance as well as how far the user
  // may dolly out, so while a fit is still flying in from a big layout to a
  // small one the far plane shrinks with the camera, not ahead of it.
  useFrame(({ camera }) => {
    const controls = controlsRef.current
    if (!controls) return
    const reach = Math.max(controls.maxDistance, controls.distance)
    const far = Math.max(BASE_FAR, (reach + framedRadiusRef.current) * 1.5)
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.far - far) > 0.01 * far) {
      cam.far = far
      cam.updateProjectionMatrix()
    }
  })

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const onControl = () => {
      userControlRef.current = true
    }
    // The wheel emits only 'control'; drags emit 'controlstart' first.
    controls.addEventListener('control', onControl)
    controls.addEventListener('controlstart', onControl)
    return () => {
      controls.removeEventListener('control', onControl)
      controls.removeEventListener('controlstart', onControl)
    }
  }, [controlsRef])

  useFrame(() => {
    const controls = controlsRef.current
    const blend = zoomBlendRef.current
    if (!controls || !blend || !userControlRef.current) return
    const distance = controls.distance
    const last = lastBlendDistanceRef.current
    lastBlendDistanceRef.current = distance
    if (last === null || Math.abs(distance - last) < 1e-5) return
    const span = blend.far - blend.near
    if (span < 1e-3) return
    const t = (d: number) => Math.min(1, Math.max(0, (d - blend.near) / span))
    // Shift by the change in blend rather than snapping to it, so any pan the
    // user has applied is kept.
    const dt = t(distance) - t(last)
    if (dt === 0) return
    controls.getTarget(_blendTarget, true)
    controls.moveTo(
      _blendTarget.x + (blend.to[0] - blend.from[0]) * dt,
      _blendTarget.y + (blend.to[1] - blend.from[1]) * dt,
      _blendTarget.z + (blend.to[2] - blend.from[2]) * dt,
      // Instant: the dolly distance driving this is already smoothed, so an
      // eased move here would trail behind the zoom.
      false,
    )
  })

  useEffect(() => {
    invalidate()
  }, [
    sel,
    navMode,
    isVideo,
    isStartScreen,
    stepWaypoint,
    fitFractionMult,
    maxZoomMult,
    invalidate,
  ])

  useFrame(({ scene, size }) => {
    if (!controlsRef.current) return
    const isMobile = size.width < 1000
    const panelVisible = isMobile && !isVideo && !(navMode === 'guided' && isStartScreen)
    // Include a stable key for the step waypoint so changing it re-fits.
    const wpKey = stepWaypoint
      ? `${stepWaypoint.direction.join(',')}|${stepWaypoint.target.join(',')}|${stepWaypoint.scale?.join(',') ?? ''}|${stepWaypoint.fitFraction ?? ''}`
      : ''
    // The configurator frames a wide layout, so fit it into the canvas left
    // between the sidebars (and the header and rack stepper), not the whole
    // canvas. CameraOffset already centers the view in that space.
    const fitBetweenPanels = navMode === 'configure' && !isMobile
    const fitKey = `${sel}|${navMode}|${size.width}|${size.height}|${panelVisible}|${wpKey}|${fitFractionMult}|${maxZoomMult}|${fitBetweenPanels && specsOpen}`
    if (fitKey === lastFitKeyRef.current) return

    // Step-level waypoint overrides the selected component's default. When the
    // step provides an explicit `scale` it acts as a focus volume (great for
    // pointing at things that aren't separate meshes — e.g. the PSC module).
    const waypoint = stepWaypoint ?? resolveWaypoint(sel)
    if (!waypoint) return
    let box = stepWaypoint ? null : findSelectedBox(scene, sel)
    if (!box && waypoint.scale) {
      // No model attached — synthesize a focus volume from explicit scale.
      const [w, h, d] = waypoint.scale
      const [tx, ty, tz] = waypoint.target
      box = new THREE.Box3(
        new THREE.Vector3(tx - w / 2, ty - h / 2, tz - d / 2),
        new THREE.Vector3(tx + w / 2, ty + h / 2, tz + d / 2),
      )
    }
    if (!box && !stepWaypoint) return // model still loading and no scale fallback — retry next frame
    if (!box) {
      // Step waypoint with no scale: fall back to selected mesh bbox.
      box = findSelectedBox(scene, sel)
      if (!box) return
    }

    const aspect = size.width / size.height
    // Mobile: bottom of viewport is covered by the specs drawer. Tighten only
    // the height-bound fit so the model fills the same proportion of the
    // *visible* height — width is unaffected since the drawer doesn't shrink
    // the canvas horizontally. CameraOffset re-centers vertically.
    const verticalFitScale = panelVisible
      ? (size.height - MOBILE_SPECS_PANEL_HEIGHT) / size.height
      : 1
    const panelsWidth = fitBetweenPanels ? SIDEBAR_INSET * (specsOpen ? 2 : 1) : 0
    const horizontalFitScale = Math.max(0.2, (size.width - panelsWidth) / size.width)
    const fitVerticalScale = fitBetweenPanels
      ? Math.max(0.2, (size.height - 2 * CONFIGURE_VERTICAL_INSET) / size.height)
      : verticalFitScale
    const baseFitFraction = waypoint.fitFraction ?? DEFAULT_FIT_FRACTION
    const position = computeFitPosition(
      box,
      waypoint.direction,
      waypoint.target,
      aspect,
      baseFitFraction * fitFractionMult,
      fitVerticalScale,
      horizontalFitScale,
    )

    const fitDistance = Math.hypot(
      position[0] - waypoint.target[0],
      position[1] - waypoint.target[1],
      position[2] - waypoint.target[2],
    )

    zoomBlendRef.current = null
    userControlRef.current = false
    lastBlendDistanceRef.current = null
    if (navMode === 'configure' && configWaypoint) {
      // Distance at which the modelled rack alone fills the same space.
      const rack = getLayoutWaypoint(1)
      const [rw, rh, rd] = rack.scale!
      const [rx, ry, rz] = rack.target
      _rackFitBox.set(
        _rackFitMin.set(rx - rw / 2, ry - rh / 2, rz - rd / 2),
        _rackFitMax.set(rx + rw / 2, ry + rh / 2, rz + rd / 2),
      )
      const nearPos = computeFitPosition(
        _rackFitBox,
        configWaypoint.direction,
        rack.target,
        aspect,
        (rack.fitFraction ?? DEFAULT_FIT_FRACTION) * fitFractionMult,
        fitVerticalScale,
        horizontalFitScale,
      )
      zoomBlendRef.current = {
        near: Math.hypot(
          nearPos[0] - rack.target[0],
          nearPos[1] - rack.target[1],
          nearPos[2] - rack.target[2],
        ),
        far: fitDistance,
        from: rack.target,
        to: waypoint.target,
      }
    }
    // Zoom-out cap: distance needed to frame the whole rack from the current
    // target along the current waypoint direction. Reverts to fitDistance when
    // already at rack level (or larger than rack, e.g. mobile aspect), so the
    // user can never dolly out past the rack's overview shot.
    let maxDistance = fitDistance
    if (RACK_BOX && _rackWaypoint) {
      const rackBaseFitFraction = _rackWaypoint.fitFraction ?? DEFAULT_FIT_FRACTION
      const rackPos = computeFitPosition(
        RACK_BOX,
        waypoint.direction,
        waypoint.target,
        aspect,
        rackBaseFitFraction * fitFractionMult,
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
    controlsRef.current.maxDistance = maxDistance * maxZoomMult

    // Far plane follows this (see the far-plane useFrame above).
    framedRadiusRef.current = box.getSize(_boxSize).length() / 2

    const animate = !isFirstFitRef.current && !reducedMotion
    isFirstFitRef.current = false
    if (animate) {
      // Scale fit duration with travel distance — small moves stay snappy,
      // big drill-outs (e.g. CPU back to rack overview) get more time so
      // they don't feel rushed. Uses the larger of camera-pos and target
      // travel so a small camera move with a big target shift still reads.
      controlsRef.current.getPosition(_curCamPos)
      controlsRef.current.getTarget(_curCamTgt)
      const posTravel = Math.hypot(
        _curCamPos.x - position[0],
        _curCamPos.y - position[1],
        _curCamPos.z - position[2],
      )
      const tgtTravel = Math.hypot(
        _curCamTgt.x - waypoint.target[0],
        _curCamTgt.y - waypoint.target[1],
        _curCamTgt.z - waypoint.target[2],
      )
      const travel = Math.max(posTravel, tgtTravel)
      const smoothTime = Math.max(0.2, Math.min(0.4, 0.2 + travel * 0.02))
      controlsRef.current.smoothTime = isIdleTour
        ? smoothTime * IDLE_TOUR_TRANSITION_SLOWDOWN
        : smoothTime
      controlsRef.current.normalizeRotations()
    }
    controlsRef.current.setLookAt(...position, ...waypoint.target, animate)
    if (animate) {
      // Each fit returns to the waypoint's own angle, undoing whatever the
      // idle-tour orbit accumulated. Orbit onward in the direction the fit
      // just swung, so the camera never visibly reverses on itself. With
      // similar waypoint angles this alternates the spin step to step.
      const swing =
        controlsRef.current.getSpherical(_endSpherical, true).theta -
        controlsRef.current.getSpherical(_curSpherical, false).theta
      if (Math.abs(swing) > 1e-3) spinDirectionRef.current = swing > 0 ? 1 : -1
    }
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
    // Disable per-frame auto-reset so we can read stats from the previous frame
    // before manually resetting in useFrame. The renderer config must be mutated.
    /* eslint-disable react-hooks/immutability */
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
    /* eslint-enable react-hooks/immutability */
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
      <Suspense fallback={null}>
        <DebugPanel />
      </Suspense>
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
  multisampling,
}: {
  aoQuality: AOQuality
  postMode: PerfFlags['postOverride']
  instancing: PerfFlags['instancing']
  gpuTier: number | undefined
  perfFactor: number
  lowTier: boolean
  multisampling: number
}) {
  const cameraControlsRef = useRef<CameraControls>(null)
  /** Idle-tour orbit direction, set by CameraFitter after each fit. */
  const spinDirectionRef = useRef<1 | -1>(1)
  const currentSelectedId = useValue(selectedId)
  const tourStep = useValue(activeTourStep)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  // SceneContent only commits once its initial models have loaded (the R3F
  // root suspends until then), so this runs after the first full scene.
  useEffect(() => prefetchDrillInModels(includeModel), [])

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

  // The id we're "focused on" — either drilled into (children visible) or
  // explicitly isolated by a tour step (rest of rack hidden). Used for hiding
  // the rack background and unrelated top-level components.
  const isolatedToId = useMemo(() => {
    if (viewingChildOfId) return viewingChildOfId
    if (!tourStep?.isolate) return null
    const isTopLevel = (componentTree.children ?? []).some((c) => c.id === baseId)
    return isTopLevel ? baseId : null
  }, [viewingChildOfId, tourStep?.isolate, baseId])

  const instanceCtx = useMemo(
    () => getInstanceContext(currentSelectedId),
    [currentSelectedId],
  )

  // Collect descendant models for the active parent (e.g. cosmo interior when inside compute-sled)
  const descendantModels = useMemo(
    () =>
      viewingChildOfId
        ? getDescendantModels(viewingChildOfId).filter(
            ({ model }) => !(perfFlags.perforations === 'off' && isPerforationModel(model)),
          )
        : [],
    [viewingChildOfId],
  )

  // Click-target volumes for descendants without a model (e.g. disks).
  const descendantHitboxes = useMemo(
    () => (viewingChildOfId ? getDescendantHitboxes(viewingChildOfId) : []),
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
  const isConfigureMode = currentNavigationMode === 'configure'
  const isFreeMode = currentNavigationMode === 'free'
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const videoClickActive = isVideo && !isStartScreen

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
        <HDRIEnvironment />
      )}
      {!lowTier && <DataCenterFloor />}
      {!isolatedToId && <RackShadow />}
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
            panelBlurQuality={lowTier ? 'low' : 'high'}
            multisampling={multisampling}
          />
        )}
        {postMode === 'none' && perfFlags.enabled && <ManualRenderer />}
        <group
          onPointerDown={(e) => {
            pointerDownPos.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (videoClickActive) {
              if (pointerDownPos.current) {
                const dx = e.clientX - pointerDownPos.current.x
                const dy = e.clientY - pointerDownPos.current.y
                if (dx * dx + dy * dy > 5 * 5) return
              }
              togglePlayWithFlash()
              return
            }
            if (!isFreeMode) return

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
            if (!isFreeMode) return
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
          {!isolatedToId &&
            getNodeModels(componentTree).map((model, i) => (
              <SelectableGLBModel
                key={`${componentTree.id}-${i}`}
                id={componentTree.id}
                path={model.path}
                clickable={model.clickable ?? true}
              />
            ))}

          {/* Wireframe rack outline whenever the rest of the rack is hidden */}
          {isolatedToId && <RackWireframe />}

          {/* Top-level components from tree */}
          {componentTree.children?.map((node) => {
            const models = filterPerforations(getNodeModels(node))
            if (models.length === 0) return null

            // Hide non-active siblings when focused (drilldown or isolation)
            if (isolatedToId && isolatedToId !== node.id) return null

            // Isolation-only on an instanced top-level node (e.g. power-shelf):
            // render just the targeted instance to match drilldown framing.
            if (
              isolatedToId === node.id &&
              !viewingChildOfId &&
              node.instances &&
              instanceCtx
            ) {
              return (
                <group key={node.id} position={instanceCtx.instancePosition}>
                  {models.map((model, i) => (
                    <SelectableGLBModel
                      key={`${node.id}-iso-${i}`}
                      id={`${node.id}:${instanceCtx.instanceIndex}`}
                      path={model.path}
                      clickable={false}
                      textures={model.textures}
                    />
                  ))}
                </group>
              )
            }

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
                  {descendantHitboxes.map((d) => (
                    <Hitbox
                      key={`${d.id}-hitbox`}
                      id={d.id}
                      target={d.waypoint!.target}
                      scale={d.waypoint!.scale!}
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
                    <InstancedModel
                      key={`${node.id}-${i}`}
                      path={model.path}
                      instances={instancesById[node.id]}
                      selectionOffset={node.selectionOffset}
                      textures={model.textures}
                      animationSpeed={model.animationSpeed}
                      configurableSleds={node.id === 'compute-sled'}
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
      {isConfigureMode && <ConfiguratorOverlay />}
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
      <ShowcaseRotation
        cameraControlsRef={cameraControlsRef}
        spinDirectionRef={spinDirectionRef}
      />
      <CameraFitter controlsRef={cameraControlsRef} spinDirectionRef={spinDirectionRef} />
      <CameraOffset />
      <DebugStats aoQuality={aoQuality} gpuTier={gpuTier} perfFactor={perfFactor} />
      <CanvasExporter />
      {perfFlags.enabled && (
        <>
          <FirstRenderMarker />
          <PerfHarness cameraControlsRef={cameraControlsRef} flags={perfFlags} />
        </>
      )}
    </>
  )
}

/** Measured full-rate rendering needed before promoting one GPU tier. */
const PROMOTION_RENDER_MS = 10_000
/** Measured rendering after a promotion during which a decline demotes. Two
 *  decision cycles (10 samples × 500ms each) at the new settings. */
const DEMOTION_WINDOW_MS = 10_000

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

// detect-gpu fetches its benchmark data from unpkg by default. Bundle it
// instead, so tier detection (which gates Canvas mount) doesn't depend on a
// third-party CDN and works from the offline cache. Each file stays a lazy chunk.
const GPU_BENCHMARKS_DIR = '/node_modules/@pmndrs/detect-gpu/dist/benchmarks'
const gpuBenchmarks = import.meta.glob<[string, ...ModelEntry[]]>(
  '/node_modules/@pmndrs/detect-gpu/dist/benchmarks/*.json',
  { import: 'default' },
)
async function loadGPUBenchmarks(file: string): Promise<ModelEntry[]> {
  const load = gpuBenchmarks[`${GPU_BENCHMARKS_DIR}/${file}`]
  if (!load) throw new Error(`Unknown GPU benchmark file: ${file}`)
  // First entry is the data format version, which the default loader also strips.
  const [, ...entries] = await load()
  return entries
}

export const Scene = () => {
  // Null until getGPUTier() resolves. Canvas mount is deferred so GL context
  // options (powerPreference, antialias, precision) can be tier-aware — these
  // can't be changed after the WebGL context is created. Detection is ~30ms.
  const [detectedConfig, setDetectedConfig] = useState<GPUConfig | null>(null)
  // Largest render-target edge the GPU allows; clamps DPR below. Null = no cap.
  const [maxBufferSize] = useState(() => probeMaxBufferSize())

  useEffect(() => {
    let cancelled = false
    if (detectSoftwareRendering()) softwareRenderingDetected.set(true)
    markInit('gpuTierStartMs', performance.now())
    getGPUTier({ override: { loadBenchmarks: loadGPUBenchmarks } }).then((tier) => {
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
  return <SceneCanvas detectedConfig={detectedConfig} maxBufferSize={maxBufferSize} />
}

const SceneCanvas = ({
  detectedConfig,
  maxBufferSize,
}: {
  detectedConfig: GPUConfig
  maxBufferSize: number | null
}) => {
  const lastMissTime = useRef(0)
  const postSetting = useValue(postProcessingSetting)
  const dprSetting = useValue(resolutionSetting)
  // Respects a manual qualitySetting override and otherwise falls back to
  // (tier < 2). Same value the GLB model components observe.
  const lowTier = useValue(lowTierRendering)
  // Tier-bound flag captured at mount for the GL context options below — these
  // are immutable after WebGL context creation, so we can't track lowTier here.
  const [tierAtMount] = useState(() => (detectedConfig.tier ?? 1) < 2)

  // Longest viewport edge in CSS px; tracked so the DPR cap re-tightens on resize.
  const [viewportEdge, setViewportEdge] = useState(() =>
    typeof window === 'undefined' ? 0 : Math.max(window.innerWidth, window.innerHeight),
  )
  useEffect(() => {
    const onResize = () => setViewportEdge(Math.max(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Highest DPR that keeps render-target edges within the GPU's limit; 0.98
  // leaves headroom for rounding in derived (half-res) passes. Infinity = no cap.
  const bufferDprCap =
    maxBufferSize && viewportEdge > 0
      ? Math.max(1, (maxBufferSize * 0.98) / viewportEdge)
      : Infinity

  // Tier promotion on measured evidence. detect-gpu's database lags new GPUs
  // and some browsers farble the renderer string, so capable GPUs can land on
  // tier 1 even after the renderer-string regex fallback. After
  // PROMOTION_RENDER_MS of *measured* rendering at full display rate, bump
  // tier by one (capped at 3). If the monitor then declines within
  // DEMOTION_WINDOW_MS of measured rendering, demote once and lock to prevent
  // oscillation — adaptive DPR/AO can't claw back the Lambert→PBR material
  // cost on a truly tier-1 GPU. The user can still manually override via the
  // Quality dropdown either way.
  //
  // Both windows count rendering time, not wall-clock time: in demand mode an
  // idle scene produces no frames, and no frames must mean no promotion.
  //
  // precision is immutable after canvas mount, so a promoted user gets the
  // Lambert→PBR / DPR / AO upgrade but stays on mediump until reload.
  // (Antialiasing is the composer's MSAA, which is the same on every tier.)
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

  const tierAOEnabled =
    perfFlags.postOverride === 'outline+ao' || perfFlags.postOverride === 'ao'
      ? true
      : perfFlags.postOverride === 'outline' || perfFlags.postOverride === 'none'
        ? false
        : effectiveConfig.enableAO

  // Max DPR the GPU tier / override allows. Adaptive DPR scales in [1, maxDpr].
  const dprConfig = perfFlags.dprOverride ?? effectiveConfig.dpr
  const maxDpr = Array.isArray(dprConfig) ? dprConfig[1] : dprConfig

  // Highest MSAA level EffectComposer can allocate here. bufferDprCap bounds the
  // edge but not total allocation, so probe the worst case (viewport × max DPR,
  // squared to over-estimate); bucketed to 256px to avoid re-probing per pixel.
  const effectiveMaxDpr = Math.min(maxDpr, bufferDprCap)
  const probeEdge = Math.ceil((viewportEdge * effectiveMaxDpr) / 256) * 256
  const probedMultisampling = useMemo(
    () => probeMaxSamples(probeEdge, probeEdge),
    [probeEdge],
  )
  // `?msaa=<n>` forces a count for ablation, bypassing the probe.
  const safeMultisampling = perfFlags.msaaOverride ?? probedMultisampling

  // Adaptive AO quality: 'full' → 'off' as perf factor drops. Hysteresis
  // prevents flicker. Only takes effect when postSetting === 'auto' AND the
  // tier supports AO; otherwise the manual or tier-disabled value wins.
  const [adaptiveAO, setAdaptiveAO] = useState<'full' | 'low' | 'off'>('full')
  const [perfFactor, setPerfFactor] = useState(1)

  // Derived DPR: manual overrides pin to maxDpr/1; 'auto' scales with perfFactor.
  // bufferDprCap keeps render targets within the GPU limit — Firefox loses the
  // context on overflow rather than clamping like Chrome/ANGLE.
  const dpr = Math.min(
    bufferDprCap,
    dprSetting === 'high'
      ? maxDpr
      : dprSetting === 'low'
        ? 1
        : Math.max(1, 1 + (maxDpr - 1) * perfFactor),
  )

  // Measured rendering time at full rate since the last tier change, and
  // measured rendering time since the last promotion (null = no promotion
  // under review). Refs, because samples arrive from inside the frame loop.
  const healthyRenderMsRef = useRef(0)
  const sincePromotionMsRef = useRef<number | null>(null)

  const handleSample = (sample: FrameRateSample) => {
    if (sample.change) {
      setPerfFactor(sample.factor)
      // Adaptive AO: only when 'auto' (manual high/low bypasses adaptiveAO).
      // Hysteresis: drop below 0.6, restore above 0.9.
      if (postSetting === 'auto') {
        if (sample.factor < 0.6) setAdaptiveAO('off')
        else if (sample.factor > 0.9) setAdaptiveAO('full')
      }
    }

    if (sincePromotionMsRef.current !== null) {
      if (sample.change === 'decline') {
        // The promoted settings were too much for this GPU: undo and lock.
        sincePromotionMsRef.current = null
        healthyRenderMsRef.current = 0
        detectedTier.set(Math.max(baseTier, promotedTier - 1))
        setTierBump((b) => Math.max(0, b - 1))
        setPromotionLocked(true)
        return
      }
      sincePromotionMsRef.current += sample.sampleMs
      if (sincePromotionMsRef.current > DEMOTION_WINDOW_MS)
        sincePromotionMsRef.current = null
    }

    if (promotionLocked || promotedTier >= 3) return
    healthyRenderMsRef.current =
      sample.healthy && sample.factor >= 0.95
        ? healthyRenderMsRef.current + sample.sampleMs
        : 0
    if (healthyRenderMsRef.current >= PROMOTION_RENDER_MS) {
      healthyRenderMsRef.current = 0
      sincePromotionMsRef.current = 0
      detectedTier.set(promotedTier + 1)
      setTierBump((b) => b + 1)
    }
  }

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
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const videoClickActive = isVideo && !isStartScreen
  const isShowcase = useValue(showcaseMode)
  const isIdleTour = useValue(idleTourActive)

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
          far: BASE_FAR,
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
          antialias: !composerOwnsFrame && !tierAtMount,
          depth: !composerOwnsFrame,
          precision: tierAtMount ? 'mediump' : 'highp',
        }}
        dpr={dpr}
        linear
        frameloop={isShowcase || isIdleTour || perfFlags.enabled ? 'always' : 'demand'}
        onPointerMissed={() => {
          if (videoClickActive) {
            togglePlayWithFlash()
            return
          }
          if (currentNavigationMode !== 'free') return
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
          multisampling={safeMultisampling}
        />
        <AdaptivePerformanceMonitor onSample={handleSample} resetKey={promotedTier} />
      </Canvas>
      <DebugOverlay />
    </>
  )
}
