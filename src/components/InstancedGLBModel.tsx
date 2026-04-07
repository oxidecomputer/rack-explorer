import { useLoader, type Vector3 } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { selectedId } from '../atoms'
import { ModifiedSelect } from './Selection'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

export interface GLBInstance {
  id: string
  position: Vector3
}

interface InstancedGLBModelProps {
  path: string
  instances: GLBInstance[]
}

export const InstancedGLBModel = ({ path, instances }: InstancedGLBModelProps) => {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })

  const currentSelectedId = useValue(selectedId)

  // Extract all meshes from the GLB
  const meshes = useMemo(() => {
    const result: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = []
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

  // Create refs for all instanced meshes to update their matrices
  const instancedMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([])

  // Set instance matrices whenever instances change
  // Each instance matrix = instanceTranslation * meshWorldMatrix
  // This preserves the mesh's original rotation/scale from the GLB hierarchy
  useEffect(() => {
    const translation = new THREE.Matrix4()
    for (let meshIdx = 0; meshIdx < meshes.length; meshIdx++) {
      const instancedMesh = instancedMeshRefs.current[meshIdx]
      if (!instancedMesh) continue
      for (let i = 0; i < instances.length; i++) {
        const pos = instances[i].position
        const p = Array.isArray(pos) ? pos : [pos, 0, 0]
        translation.makeTranslation(p[0] as number, p[1] as number, p[2] as number)
        instancedMesh.setMatrixAt(
          i,
          translation.clone().multiply(meshes[meshIdx].matrix),
        )
      }
      instancedMesh.instanceMatrix.needsUpdate = true
    }
  }, [instances, meshes])

  // Clone the scene for the selected instance's outline
  const selectedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const selectedInstance = instances.find((inst) => {
    if (inst.id === currentSelectedId) return true
    // Sidebar sets e.g. 'compute-sled', instance IDs are 'compute-sled:0'
    const [baseId] = inst.id.split(':')
    return baseId === currentSelectedId
  })

  useEffect(() => {
    if (!selectedInstance) return
    selectedScene.traverse((child) => {
      child.userData = { id: selectedInstance.id }
    })
  }, [selectedScene, selectedInstance])

  return (
    <group>
      {meshes.map((mesh, meshIdx) => (
        <instancedMesh
          key={meshIdx}
          ref={(el) => { instancedMeshRefs.current[meshIdx] = el }}
          args={[mesh.geometry, undefined, instances.length]}
          frustumCulled={false}
        >
          {Array.isArray(mesh.material)
            ? mesh.material.map((mat, i) => (
                <primitive key={i} object={mat} attach={`material-${i}`} />
              ))
            : <primitive object={mesh.material} attach="material" />
          }
        </instancedMesh>
      ))}

      {/* Render a single clone at the selected position for the outline effect */}
      {selectedInstance && (
        <ModifiedSelect enabled>
          <group position={selectedInstance.position}>
            <primitive object={selectedScene} />
          </group>
        </ModifiedSelect>
      )}
    </group>
  )
}
