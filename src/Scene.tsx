import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'

import { navigationMode, sceneReady, selectedId } from './atoms'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
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

function RackWireframe() {
  return (
    <WireframeCube size={[0.64, 2.28, 1.07]} position={[0, 1.205, 0]} color="#5D5E61" />
  )
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

  useEffect(() => {
    if (!cameraControlsRef.current || !currentSelectedId) return

    const waypoint = resolveWaypoint(currentSelectedId)
    if (waypoint) {
      const animate = !isFirstRender.current
      isFirstRender.current = false
      if (animate) cameraControlsRef.current.normalizeRotations()
      cameraControlsRef.current.setLookAt(...waypoint.position, ...waypoint.target, animate)
    }
  }, [currentSelectedId])

  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'

  return (
    <>
      <Environment files="./common/hdri.jpg" environmentIntensity={2} />
      <Grid
        cellSize={0.025}
        sectionSize={0.025}
        sectionColor="#373F41"
        cellColor="#373F41"
        scale={10}
        position={[0, 0, 0]}
        fadeDistance={200}
        fadeStrength={1}
      />
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
  const [gpuConfig, setGpuConfig] = useState<GPUConfig>({ dpr: 1, enableAO: false })
  const lastMissTime = useRef(0)

  useEffect(() => {
    let cancelled = false
    getGPUTier().then((tier) => {
      if (!cancelled) setGpuConfig(getGPUConfig(tier))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const initialWaypoint = resolveWaypoint('oxide-rack')
  const currentNavigationMode = useValue(navigationMode)
  const isGuidedMode = currentNavigationMode === 'guided'

  return (
    <Canvas
      camera={{
        position: initialWaypoint?.position ?? [5, 5, 10],
        fov: 15,
        near: 1,
        far: 100,
      }}
      className="absolute inset-0"
      gl={{
        outputColorSpace: 'srgb',
        toneMapping: 0,
        premultipliedAlpha: false,
      }}
      dpr={gpuConfig.dpr}
      linear
      frameloop="demand"
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
