import { InstancedMesh2 } from '@three.ez/instanced-mesh'
import { extend, useLoader, useThree, type Vector3 } from '@react-three/fiber'
import { computed } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { navigationMode, selectedId } from '../atoms'
import { isDescendantOf } from '../data/componentTree'
import { dracoLoader } from '../loaders'
import { useSelectionOffset } from '../useSelectionOffset'
import { ModifiedSelect } from './Selection'

extend({ InstancedMesh2 })

declare module '@react-three/fiber' {
  interface ThreeElements {
    instancedMesh2: any
  }
}

export interface GLBInstance {
  id: string
  position: Vector3
}

interface InstancedGLBModelProps {
  path: string
  instances: GLBInstance[]
  selectionOffset?: [number, number, number]
}

const DRAG_THRESHOLD = 5

// Pre-allocated objects to avoid GC pressure in instance update loop
const _translation = new THREE.Matrix4()
const _composed = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()

export const InstancedGLBModel = ({
  path,
  instances,
  selectionOffset,
}: InstancedGLBModelProps) => {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const gl = useThree((s) => s.gl)
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  // Extract all meshes from the GLB
  const meshes = useMemo(() => {
    const result: {
      geometry: THREE.BufferGeometry
      material: THREE.Material | THREE.Material[]
      matrix: THREE.Matrix4
    }[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        result.push({
          geometry: child.geometry,
          material: child.material,
          matrix: child.matrixWorld.clone(),
        })
      }
    })
    return result
  }, [gltf.scene])

  const indexToId = useMemo(() => instances.map((inst) => inst.id), [instances])

  // Derived atom: only triggers re-render when the matched index actually changes
  const selectedIndexAtom = useMemo(
    () =>
      computed('instsel-' + path, () => {
        const sel = selectedId.get()
        for (let i = 0; i < instances.length; i++) {
          const inst = instances[i]
          if (inst.id === sel) return i
          if (inst.id.split(':')[0] === sel) return i
        }
        return -1
      }),
    [instances, path],
  )
  const selectedIndex = useValue(selectedIndexAtom)
  const selectedInstance = selectedIndex >= 0 ? instances[selectedIndex] : undefined

  // Lazily clone the scene for the selected instance's outline — only allocate when needed
  const selectedSceneRef = useRef<THREE.Group | null>(null)
  const selectedSceneSourceRef = useRef<THREE.Group | null>(null)

  const selectedScene = useMemo(() => {
    if (!selectedInstance) {
      // Dispose previous clone when deselecting
      if (selectedSceneRef.current) {
        selectedSceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((mat) => mat?.dispose())
          }
        })
        selectedSceneRef.current = null
        selectedSceneSourceRef.current = null
      }
      return null
    }
    // Re-clone only when the gltf source changes
    if (selectedSceneSourceRef.current !== gltf.scene) {
      if (selectedSceneRef.current) {
        selectedSceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((mat) => mat?.dispose())
          }
        })
      }
      selectedSceneRef.current = gltf.scene.clone(true)
      selectedSceneSourceRef.current = gltf.scene
    }
    return selectedSceneRef.current
  }, [gltf.scene, selectedInstance])

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (selectedSceneRef.current) {
        selectedSceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((mat) => mat?.dispose())
          }
        })
      }
    }
  }, [])

  // Create InstancedMesh2 instances imperatively since we need to compose matrices
  const instancedMeshes = useMemo(() => {
    return meshes.map((mesh) => {
      const geom = mesh.geometry.clone()
      geom.deleteAttribute('instanceIndex')
      const im = new InstancedMesh2(geom, mesh.material as THREE.Material, {
        capacity: instances.length,
        createEntities: true,
        renderer: gl,
      })
      im.addInstances(instances.length, (entity, i) => {
        const pos = instances[i].position
        const p = Array.isArray(pos) ? pos : [pos, 0, 0]
        _translation.makeTranslation(p[0] as number, p[1] as number, p[2] as number)
        _composed.copy(_translation).multiply(mesh.matrix)
        _composed.decompose(_pos, _quat, _scale)
        entity.position.copy(_pos)
        entity.quaternion.copy(_quat)
        entity.scale.copy(_scale)
      })
      im.computeBVH()
      return im
    })
  }, [meshes, instances, gl])

  // Hide/show selected instance for the offset effect
  const hideSelected = selectionOffset && selectedIndex >= 0

  useEffect(() => {
    for (const im of instancedMeshes) {
      for (let i = 0; i < instances.length; i++) {
        im.setVisibilityAt(i, !(hideSelected && i === selectedIndex))
      }
    }
  }, [instancedMeshes, instances, selectedIndex, hideSelected])

  // Dispose InstancedMesh2 instances and cloned geometries on unmount
  useEffect(() => {
    return () => {
      for (const im of instancedMeshes) {
        im.geometry.dispose()
        im.dispose()
      }
    }
  }, [instancedMeshes])

  const selectedGroupRef = useSelectionOffset(
    selectedIndex >= 0,
    selectionOffset,
    selectedIndex,
  )

  useEffect(() => {
    if (!selectedInstance || !selectedScene) return
    selectedScene.traverse((child) => {
      child.userData = { id: selectedInstance.id }
    })
  }, [selectedScene, selectedInstance])

  return (
    <group
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY }
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (navigationMode.get() === 'guided') return
        if (pointerDownPos.current) {
          const dx = e.clientX - pointerDownPos.current.x
          const dy = e.clientY - pointerDownPos.current.y
          if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return
        }
        const intersection = e.intersections[0]
        if (intersection?.instanceId != null) {
          const targetId = indexToId[intersection.instanceId]
          // Don't re-select the parent sled if we're already viewing one of its children
          const currentBase = selectedId.get().split(':')[0]
          const targetBase = targetId.split(':')[0]
          if (isDescendantOf(currentBase, targetBase)) return
          selectedId.set(targetId)
        }
      }}
    >
      {instancedMeshes.map((im, meshIdx) => (
        <primitive key={meshIdx} object={im} />
      ))}

      {/* Render a single clone at the selected position for the outline effect */}
      {selectedInstance && selectedScene && (
        <ModifiedSelect enabled>
          <group position={selectedInstance.position}>
            <group ref={selectedGroupRef}>
              <primitive object={selectedScene} />
            </group>
          </group>
        </ModifiedSelect>
      )}
    </group>
  )
}
