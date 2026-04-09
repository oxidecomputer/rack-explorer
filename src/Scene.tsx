import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  lowQuality,
  navigationMode,
  sceneReady,
  selectedId,
  showcaseMode,
  specificationsOpen,
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
  inheritInstanceIndex,
  isDescendantOf,
  resolveWaypoint,
} from './data/componentTree'

const PostProcessing = lazy(() =>
  import('./components/PostProcessing').then((m) => ({ default: m.PostProcessing })),
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
  const currentOffset = useRef(0)
  const invalidate = useThree((s) => s.invalidate)

  useFrame(({ camera, size }) => {
    const target = specsOpen ? 0 : 128
    const diff = target - currentOffset.current

    if (Math.abs(diff) < 0.5) {
      currentOffset.current = target
    } else {
      currentOffset.current += diff * 0.12
      invalidate()
    }

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
  }, [specsOpen, invalidate])

  return null
}

function SceneContent({ enableAO }: { enableAO: boolean }) {
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
      if (child.instances && child.model) {
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
        <PostProcessing enableAO={enableAO} />
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
            const intersectedObject = e.intersections[0]?.object
            if (intersectedObject?.userData?.id) {
              selectedId.set(intersectedObject.userData.id)
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
          {!viewingChildOfId && componentTree.model && (
            <SelectableGLBModel
              id={componentTree.id}
              path={componentTree.model.path}
              clickable={componentTree.model.clickable ?? true}
            />
          )}

          {/* Wireframe rack outline when drilled in */}
          {viewingChildOfId && <RackWireframe />}

          {/* Top-level components from tree */}
          {componentTree.children?.map((node) => {
            if (!node.model) return null

            // Hide non-active siblings when drilled in
            if (viewingChildOfId && viewingChildOfId !== node.id) return null

            // When drilled into this component, render its descendant models
            if (viewingChildOfId === node.id && instanceCtx) {
              return (
                <group key={node.id} position={instanceCtx.instancePosition}>
                  {descendantModels.map((descendant) => (
                    <SelectableGLBModel
                      key={descendant.id}
                      id={descendant.id}
                      path={descendant.model!.path}
                      clickable={descendant.model!.clickable ?? true}
                      textures={descendant.model!.textures}
                    />
                  ))}
                </group>
              )
            }

            // Instanced rendering
            if (node.instances) {
              return (
                <InstancedGLBModel
                  key={node.id}
                  path={node.model.path}
                  instances={instancesById[node.id]}
                  selectionOffset={node.selectionOffset}
                />
              )
            }

            // Single positioned model
            return (
              <SelectableGLBModel
                key={node.id}
                id={node.id}
                path={node.model.path}
                position={node.model.position}
              />
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
      <CameraOffset />
    </>
  )
}

type GPUConfig = {
  dpr: number | [number, number]
  enableAO: boolean
}

const getGPUConfig = (tier: TierResult | null): GPUConfig => {
  // tier.tier: 0 (low) to 3 (high)
  const tierLevel = tier?.tier ?? 1
  return {
    dpr: tierLevel >= 2 ? [1, 2] : 1,
    enableAO: tierLevel >= 2,
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
    getGPUTier().then((tier) => {
      if (!cancelled) setDetectedConfig(getGPUConfig(tier))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const gpuConfig: GPUConfig = isLowQuality ? { dpr: 1, enableAO: false } : detectedConfig

  const initialWaypoint = resolveWaypoint('oxide-rack')
  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'
  const isShowcase = useValue(showcaseMode)

  return (
    <Canvas
      camera={{
        position: initialWaypoint?.position ?? [5, 5, 10],
        fov: 15,
        near: 1,
        far: 100,
      }}
      className="absolute inset-0 z-0"
      gl={{
        outputColorSpace: 'srgb',
        toneMapping: 0,
        premultipliedAlpha: false,
      }}
      dpr={gpuConfig.dpr}
      linear
      frameloop={isShowcase ? 'always' : 'demand'}
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
      onCreated={() => sceneReady.set(true)}
    >
      <SceneContent enableAO={gpuConfig.enableAO} />
    </Canvas>
  )
}
