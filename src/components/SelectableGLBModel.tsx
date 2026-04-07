import { useLoader, type Vector3 } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
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
  clickable?: boolean
  hideMaterials?: string[]
}

export const SelectableGLBModel = ({
  id,
  path,
  position = [0, 0, 0],
  clickable = true,
  hideMaterials,
}: SelectableGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const currentSelectedId = useValue(selectedId)
  const enabled = currentSelectedId === id

  useEffect(() => {
    scene.traverse((child) => {
      child.userData = clickable ? { id } : {}
    })
  }, [scene, id, clickable])

  // Todo: remove this by adding airflow shroud as a separate mesh
  useEffect(() => {
    if (!hideMaterials) return
    scene.traverse((child) => {
      const mesh = child as Mesh
      const mat = mesh.material as MeshStandardMaterial | undefined
      if (mat) mesh.visible = !hideMaterials?.includes(mat.name)
    })
  }, [scene, hideMaterials])

  return (
    <ModifiedSelect enabled={enabled}>
      <group position={position}>
        <primitive object={scene} />
      </group>
    </ModifiedSelect>
  )
}
