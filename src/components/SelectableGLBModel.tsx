import { useLoader } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect } from 'react'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { selectedId } from '../atoms'
import { ModifiedSelect } from './Selection'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

interface SelectableGLBModelProps {
  id: string
  path: string
}

export const SelectableGLBModel = ({ id, path }: SelectableGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const currentSelectedId = useValue(selectedId)
  const enabled = currentSelectedId === id

  useEffect(() => {
    gltf.scene.traverse((child) => {
      child.userData = { id }
    })
  }, [gltf.scene, id])

  return (
    <ModifiedSelect enabled={enabled}>
      <primitive object={gltf.scene} />
    </ModifiedSelect>
  )
}
