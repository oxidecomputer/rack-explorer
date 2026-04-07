import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid } from '@react-three/drei'
import { Canvas, extend, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import { BlendFunction } from 'postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'

import { selectedId } from './atoms'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
import { WireframeCube } from './components/WireframeCube'
import {
  componentTree,
  getInstanceContext,
  getNode,
  inheritInstanceIndex,
  isDescendantOf,
  resolveWaypoint,
} from './data/componentTree'

extend({ MeshLineGeometry, MeshLineMaterial })

const { ACTION } = CameraControlsImpl

const DRAG_THRESHOLD = 5

/** A simple colored box used as a placeholder for child component models */
function PlaceholderCube({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.2, 0.04, 0.12]} />
      <meshStandardMaterial transparent opacity={0.35} />
    </mesh>
  )
}

function RackWireframe() {
  return (
    <WireframeCube
      size={[0.64, 2.28, 1.07]}
      position={[0, 1.205, 0]}
      color="#5D5E61"
      lineWidth={0.0025}
    />
  )
}

function SceneContent({ enableAO }: { enableAO: boolean }) {
  const cameraControlsRef = useRef<CameraControls>(null)
  const currentSelectedId = useValue(selectedId)
  const { camera } = useThree()
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  // Determine if we're viewing a child of an instanced component (e.g. compute sled internals)
  const baseId = currentSelectedId.split(':')[0]
  const isViewingChild = isDescendantOf(baseId, 'compute-sled')
  const instanceCtx = isViewingChild ? getInstanceContext(currentSelectedId) : null

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!cameraControlsRef.current || !currentSelectedId) return

    const waypoint = resolveWaypoint(currentSelectedId)
    if (waypoint) {
      const animate = !isFirstRender.current
      isFirstRender.current = false
      if (animate) cameraControlsRef.current.normalizeRotations()
      cameraControlsRef.current.setLookAt(...waypoint.position, ...waypoint.target, true)
    }
  }, [currentSelectedId, camera])

  // Compute sled instances for the 3D models
  const sledInstances = useMemo(() => {
    const sledNode = componentTree.children?.find((c) => c.id === 'compute-sled')
    if (!sledNode?.instances) return []
    return sledNode.instances.map((pos, i) => ({
      id: `compute-sled:${i}`,
      position: pos as [number, number, number],
    }))
  }, [])

  const powerShelfInstances = useMemo(() => {
    const node = componentTree.children?.find((c) => c.id === 'power-shelf')
    if (!node?.instances) return []
    return node.instances.map((pos, i) => ({
      id: `power-shelf:${i}`,
      position: pos as [number, number, number],
    }))
  }, [])

  const patchPanelWaypoint = resolveWaypoint('patch-panel')

  return (
    <>
      <Environment files="./hdri/hdri.jpg" environmentIntensity={2} />
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
        <EffectComposer enableNormalPass={enableAO} autoClear={false}>
          {enableAO ? <N8AO color="black" aoRadius={0.1} intensity={5} /> : <></>}
          <Outline
            edgeStrength={2.5}
            blendFunction={BlendFunction.ALPHA}
            visibleEdgeColor={4773271}
            hiddenEdgeColor={4773271}
            blur
          />
        </EffectComposer>
        <group
          onPointerDown={(e) => {
            pointerDownPos.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (pointerDownPos.current) {
              const dx = e.clientX - pointerDownPos.current.x
              const dy = e.clientY - pointerDownPos.current.y
              if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return
            }
            const intersectedObject = e.intersections[0]?.object
            if (intersectedObject?.userData?.id) {
              selectedId.set(intersectedObject.userData.id)
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
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
          {/* Hide everything except the selected sled when viewing child components */}
          {!isViewingChild && (
            <>
              <SelectableGLBModel
                id="oxide-rack"
                path="./models/rack-frame/rack-frame-lod1.glb"
                clickable={false}
              />
              <InstancedGLBModel
                path="./models/power-shelf/power-shelf.glb"
                instances={powerShelfInstances}
              />
              {patchPanelWaypoint && (
                <SelectableGLBModel
                  id="patch-panel"
                  path="./models/patch-panel/patch-panel.glb"
                  position={patchPanelWaypoint.target}
                />
              )}
            </>
          )}

          {/* Wireframe rack outline when the full rack is hidden */}
          {isViewingChild && <RackWireframe />}

          {/* Compute sleds — always visible (instanced when viewing rack, single when viewing child) */}
          <InstancedGLBModel
            path="./models/cosmo/cosmo-lod1.glb"
            instances={
              isViewingChild && instanceCtx
                ? [
                    {
                      id: `compute-sled:${instanceCtx.instanceIndex}`,
                      position: instanceCtx.instancePosition,
                    },
                  ]
                : sledInstances
            }
          />

          {/* Placeholder cube — only visible when viewing compute sled child components */}
          {isViewingChild && instanceCtx && (
            <PlaceholderCube position={instanceCtx.instancePosition} />
          )}
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
      {/*<Stats />*/}
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

  useEffect(() => {
    getGPUTier().then((tier) => {
      setGpuConfig(getGPUConfig(tier))
    })
  }, [])

  const initialWaypoint = resolveWaypoint('oxide-rack')

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
    >
      <SceneContent enableAO={gpuConfig.enableAO} />
    </Canvas>
  )
}
