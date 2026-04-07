import { useLoader, type Vector3 } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo } from 'react'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { selectedId } from '../atoms'
import { ModifiedSelect } from './Selection'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

interface SelectableGLBModelProps {
  id: string
  path: string
  position?: Vector3
}

export const SelectableGLBModel = ({
  id,
  path,
  position = [0, 0, 0],
}: SelectableGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const currentSelectedId = useValue(selectedId)
  const enabled = currentSelectedId === id

  useEffect(() => {
    scene.traverse((child) => {
      child.userData = { id }
    })
  }, [scene, id])

  return (
    <ModifiedSelect enabled={enabled}>
      <group position={position}>
        <primitive object={scene} />
      </group>
    </ModifiedSelect>
  )
}
