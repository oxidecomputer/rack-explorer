import { useLoader, type Vector3 } from '@react-three/fiber'
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

// Pre-allocated matrices to avoid GC pressure in instance update loop
const _translation = new THREE.Matrix4()
const _composed = new THREE.Matrix4()
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0)

export const InstancedGLBModel = ({
  path,
  instances,
  selectionOffset,
}: InstancedGLBModelProps) => {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
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

  // Create refs for all instanced meshes to update their matrices
  const instancedMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([])

  // Set instance matrices whenever instances change
  // Each instance matrix = instanceTranslation * meshWorldMatrix
  // This preserves the mesh's original rotation/scale from the GLB hierarchy
  const hideSelected = selectionOffset && selectedIndex >= 0

  useEffect(() => {
    for (let meshIdx = 0; meshIdx < meshes.length; meshIdx++) {
      const instancedMesh = instancedMeshRefs.current[meshIdx]
      if (!instancedMesh) continue
      for (let i = 0; i < instances.length; i++) {
        if (hideSelected && i === selectedIndex) {
          instancedMesh.setMatrixAt(i, _hidden)
        } else {
          const pos = instances[i].position
          const p = Array.isArray(pos) ? pos : [pos, 0, 0]
          _translation.makeTranslation(p[0] as number, p[1] as number, p[2] as number)
          _composed.copy(_translation).multiply(meshes[meshIdx].matrix)
          instancedMesh.setMatrixAt(i, _composed)
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true
    }
  }, [instances, meshes, selectedIndex, hideSelected])

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
      {meshes.map((mesh, meshIdx) => (
        <instancedMesh
          key={meshIdx}
          ref={(el) => {
            instancedMeshRefs.current[meshIdx] = el
          }}
          args={[mesh.geometry, undefined, instances.length]}
          frustumCulled={false}
        >
          {Array.isArray(mesh.material) ? (
            mesh.material.map((mat, i) => (
              <primitive key={i} object={mat} attach={`material-${i}`} />
            ))
          ) : (
            <primitive object={mesh.material} attach="material" />
          )}
        </instancedMesh>
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
