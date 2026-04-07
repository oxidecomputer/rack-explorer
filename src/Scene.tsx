import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { BlendFunction } from 'postprocessing'
import { useEffect, useRef, useState } from 'react'

import { selectedId } from './atoms'
import { InstancedGLBModel } from './components/InstancedGLBModel'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
import {
  cameraWaypoints,
  getWaypointEntries,
  getWaypointEntry,
} from './data/cameraWaypoints'

const { ACTION } = CameraControlsImpl

const DRAG_THRESHOLD = 5

function SceneContent({ enableAO }: { enableAO: boolean }) {
  const cameraControlsRef = useRef<CameraControls>(null)
  const currentSelectedId = useValue(selectedId)
  const { camera } = useThree()
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!cameraControlsRef.current || !currentSelectedId) return

    const [id, indexStr] = currentSelectedId.split(':')
    const waypoint = cameraWaypoints[id]
    if (waypoint) {
      const entry = getWaypointEntry(waypoint, Number(indexStr ?? 0))
      cameraControlsRef.current.setLookAt(...entry.position, ...entry.target, true)
    }
  }, [currentSelectedId, camera])

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
        >
          <SelectableGLBModel
            id="oxide-rack"
            path="./models/rack-frame/rack-frame-lod1.glb"
            clickable={false}
          />
          <InstancedGLBModel
            path="./models/cosmo/cosmo-lod1.glb"
            instances={getWaypointEntries(cameraWaypoints['compute-sled']).map(
              (entry, i) => ({
                id: `compute-sled:${i}`,
                position: entry.target,
              }),
            )}
          />
          <InstancedGLBModel
            path="./models/power-shelf/power-shelf.glb"
            instances={getWaypointEntries(cameraWaypoints['power-shelf']).map(
              (entry, i) => ({
                id: `power-shelf:${i}`,
                position: entry.target,
              }),
            )}
          />
          <SelectableGLBModel
            id="patch-panel"
            path="./models/patch-panel/patch-panel.glb"
            position={getWaypointEntry(cameraWaypoints['patch-panel'], 0).target}
          />
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

  return (
    <Canvas
      camera={{
        position: getWaypointEntry(cameraWaypoints['oxide-rack'], 0).position,
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
