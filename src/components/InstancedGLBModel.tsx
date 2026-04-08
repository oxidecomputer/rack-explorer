import { useFrame, useLoader, type Vector3 } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { navigationMode, selectedId } from '../atoms'
import { isDescendantOf } from '../data/componentTree'
import { dracoLoader } from '../loaders'
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

export const InstancedGLBModel = ({
  path,
  instances,
  selectionOffset,
}: InstancedGLBModelProps) => {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const currentSelectedId = useValue(selectedId)

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

  // Find the selected instance and its index in a single pass
  const { selectedInstance, selectedIndex } = useMemo(() => {
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i]
      if (inst.id === currentSelectedId) return { selectedInstance: inst, selectedIndex: i }
      const [baseId] = inst.id.split(':')
      if (baseId === currentSelectedId) return { selectedInstance: inst, selectedIndex: i }
    }
    return { selectedInstance: undefined, selectedIndex: -1 }
  }, [instances, currentSelectedId])

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
    const translation = new THREE.Matrix4()
    const composed = new THREE.Matrix4()
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let meshIdx = 0; meshIdx < meshes.length; meshIdx++) {
      const instancedMesh = instancedMeshRefs.current[meshIdx]
      if (!instancedMesh) continue
      for (let i = 0; i < instances.length; i++) {
        if (hideSelected && i === selectedIndex) {
          instancedMesh.setMatrixAt(i, hidden)
        } else {
          const pos = instances[i].position
          const p = Array.isArray(pos) ? pos : [pos, 0, 0]
          translation.makeTranslation(p[0] as number, p[1] as number, p[2] as number)
          composed.copy(translation).multiply(meshes[meshIdx].matrix)
          instancedMesh.setMatrixAt(i, composed)
        }
      }
      instancedMesh.instanceMatrix.needsUpdate = true
    }
  }, [instances, meshes, selectedIndex, hideSelected])

  // Animation state for selection offset
  const selectedGroupRef = useRef<THREE.Group>(null)
  const animOffset = useRef(new THREE.Vector3())
  const prevSelectedIndex = useRef(-1)

  // Reset animation when selection changes to a different instance
  if (prevSelectedIndex.current !== selectedIndex) {
    animOffset.current.set(0, 0, 0)
    prevSelectedIndex.current = selectedIndex
  }

  // Animate selected instance toward selectionOffset
  useFrame((state, delta) => {
    if (!selectedGroupRef.current || !selectionOffset) return
    const target = selectedIndex >= 0 ? selectionOffset : [0, 0, 0]
    const pos = animOffset.current
    // Early-out: skip math if already at target
    if (
      Math.abs(pos.x - target[0]) < 0.0001 &&
      Math.abs(pos.y - target[1]) < 0.0001 &&
      Math.abs(pos.z - target[2]) < 0.0001
    )
      return
    const rate = 1 - Math.pow(0.001, delta)
    const nx = THREE.MathUtils.lerp(pos.x, target[0], rate)
    const ny = THREE.MathUtils.lerp(pos.y, target[1], rate)
    const nz = THREE.MathUtils.lerp(pos.z, target[2], rate)
    pos.set(nx, ny, nz)
    selectedGroupRef.current.position.copy(pos)
    state.invalidate()
  })

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
