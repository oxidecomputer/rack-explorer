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
  /** Map of material name → texture path to apply */
  textures?: Record<string, string>
}

export const SelectableGLBModel = ({
  id,
  path,
  position = [0, 0, 0],
  clickable = true,
  textures,
}: SelectableGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // Apply external textures to matching materials
  useEffect(() => {
    if (!textures) return
    const loader = new THREE.TextureLoader()
    const loaded: THREE.Texture[] = []

    for (const [materialName, texturePath] of Object.entries(textures)) {
      loader.load(texturePath, (tex) => {
        tex.flipY = false
        tex.colorSpace = THREE.SRGBColorSpace
        loaded.push(tex)

        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            for (const mat of mats) {
              if (mat.name === materialName && mat instanceof THREE.MeshStandardMaterial) {
                mat.map = tex
                mat.needsUpdate = true
              }
            }
          }
        })
      })
    }

    return () => {
      loaded.forEach((tex) => tex.dispose())
    }
  }, [scene, textures])

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
