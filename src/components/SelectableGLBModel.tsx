import { useLoader, type Vector3 } from '@react-three/fiber'
import { computed } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { lowTierRendering, selectedId } from '../atoms'
import { dracoLoader } from '../loaders'
import { downgradeMaterials } from '../perf/materialDowngrade'
import { ensureBoundsTree } from '../perf/raycasting'

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
  ensureBoundsTree(gltf.scene)
  const lowTier = useValue(lowTierRendering)

  // Re-clone whenever the source GLTF or low-tier setting changes. The clone
  // owns any new lambert materials we create during downgrade — they get
  // disposed when the next clone replaces this one.
  const sceneInfo = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const created = lowTier ? downgradeMaterials(cloned) : []
    return { scene: cloned, created }
  }, [gltf.scene, lowTier])
  const scene = sceneInfo.scene

  useEffect(() => {
    return () => {
      for (const m of sceneInfo.created) m.dispose()
    }
  }, [sceneInfo])

  // Apply external textures to matching materials. Material name is preserved
  // through downgrade, so the lookup works for both Standard and Lambert.
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
              if (
                mat.name === materialName &&
                (mat instanceof THREE.MeshStandardMaterial ||
                  mat instanceof THREE.MeshLambertMaterial)
              ) {
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
      child.userData = { id }
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
