import { getGPUTier, type TierResult } from '@pmndrs/detect-gpu'
import { CameraControls, Environment, Grid } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { useValue } from '@tldraw/state-react'
import CameraControlsImpl from 'camera-controls'
import { BlendFunction } from 'postprocessing'
import { useEffect, useRef, useState } from 'react'

import { hoveredId, selectedId } from './atoms'
import { SelectableGLBModel } from './components/SelectableGLBModel'
import { ModifiedSelection } from './components/Selection'
import { cameraWaypoints } from './data/cameraWaypoints'

const { ACTION } = CameraControlsImpl

function SceneContent({ enableAO }: { enableAO: boolean }) {
  const cameraControlsRef = useRef<CameraControls>(null)
  const currentSelectedId = useValue(selectedId)
  const { camera } = useThree()

  useEffect(() => {
    if (!cameraControlsRef.current || !currentSelectedId) return

    const waypoint = cameraWaypoints[currentSelectedId]
    if (waypoint) {
      cameraControlsRef.current.setLookAt(...waypoint.position, ...waypoint.target, true)
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
          onClick={(e) => {
            e.stopPropagation()
            const intersectedObject = e.intersections[0]?.object
            if (intersectedObject?.userData?.id) {
              selectedId.set(intersectedObject.userData.id)
            }
          }}
          onPointerMove={(e) => {
            const intersectedObject = e.intersections[0]?.object
            if (intersectedObject?.userData?.id) {
              hoveredId.set(intersectedObject.userData.id)
            } else {
              hoveredId.set(null)
            }
          }}
          onPointerLeave={() => hoveredId.set(null)}
        >
          <SelectableGLBModel id="oxide-rack" path="./models/rack-frame.glb" />
          <SelectableGLBModel id="power-shelf" path="./models/power-shelf.glb" />
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
        position: cameraWaypoints['oxide-rack'].position,
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
