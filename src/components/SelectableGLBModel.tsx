import { useLoader, type Vector3 } from '@react-three/fiber'
import { computed } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { selectedId } from '../atoms'
import { dracoLoader } from '../loaders'

const textureLoader = new THREE.TextureLoader()
import { useSelectionOffset } from '../useSelectionOffset'
import { ModifiedSelect } from './Selection'

interface SelectableGLBModelProps {
  id: string
  path: string
  position?: Vector3
  clickable?: boolean
  /** Map of material name → texture path to apply */
  textures?: Record<string, string>
  /** Offset applied when selected (animated) */
  selectionOffset?: [number, number, number]
}

export const SelectableGLBModel = memo(function SelectableGLBModel({
  id,
  path,
  position = [0, 0, 0],
  clickable = true,
  textures,
  selectionOffset,
}: SelectableGLBModelProps) {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // Apply external textures to matching materials
  useEffect(() => {
    if (!textures) return
    const loaded: THREE.Texture[] = []

    for (const [materialName, texturePath] of Object.entries(textures)) {
      textureLoader.load(texturePath, (tex) => {
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

  const isSelected = useMemo(
    () =>
      computed('select-' + id, () => {
        const sel = selectedId.get()
        return sel === id || sel.split(':')[0] === id
      }),
    [id],
  )
  const enabled = useValue(isSelected)

  useEffect(() => {
    scene.traverse((child) => {
      child.userData = clickable ? { id } : {}
      if (!clickable && child instanceof THREE.Mesh) {
        child.raycast = () => {}
      }
    })
  }, [scene, id, clickable])

  const offsetGroupRef = useSelectionOffset(enabled, selectionOffset)

  return (
    <ModifiedSelect enabled={enabled}>
      <group position={position}>
        <group ref={offsetGroupRef}>
          <primitive object={scene} />
        </group>
      </group>
    </ModifiedSelect>
  )
})
