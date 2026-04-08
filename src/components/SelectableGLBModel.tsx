import { useLoader, type Vector3 } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { selectedId } from '../atoms'
import { dracoLoader } from '../loaders'
import { ModifiedSelect } from './Selection'

interface SelectableGLBModelProps {
  id: string
  path: string
  position?: Vector3
  clickable?: boolean
}

export const SelectableGLBModel = ({
  id,
  path,
  position = [0, 0, 0],
  clickable = true,
}: SelectableGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useEffect(() => {
    const s = scene
    return () => {
      s.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((mat) => mat?.dispose())
        }
      })
    }
  }, [scene])

  const currentSelectedId = useValue(selectedId)
  const enabled = currentSelectedId === id

  useEffect(() => {
    scene.traverse((child) => {
      child.userData = clickable ? { id } : {}
    })
  }, [scene, id, clickable])

  return (
    <ModifiedSelect enabled={enabled}>
      <group position={position}>
        <primitive object={scene} />
      </group>
    </ModifiedSelect>
  )
}
