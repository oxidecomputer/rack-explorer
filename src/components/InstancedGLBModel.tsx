import {
  extend,
  useLoader,
  useThree,
  type ThreeElement,
  type Vector3,
} from '@react-three/fiber'
import { InstancedMesh2 } from '@three.ez/instanced-mesh'
import { computed } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { lowTierRendering, navigationMode, selectedId } from '../atoms'
import { isDescendantOf } from '../data/componentTree'
import { dracoLoader } from '../loaders'
import { downgradeMaterial, downgradeMaterials } from '../perf/materialDowngrade'
import { ensureBoundsTree } from '../perf/raycasting'
import { useSelectionOffset } from '../useSelectionOffset'
import { ModifiedSelect } from './Selection'
import { applyExternalTextures, rewritePerforations } from './textureApply'

extend({ InstancedMesh2 })

declare module '@react-three/fiber' {
  interface ThreeElements {
    instancedMesh2: ThreeElement<typeof InstancedMesh2>
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
  /** Map of material name → texture path to apply. */
  textures?: Record<string, string>
}

const DRAG_THRESHOLD = 5

// Pre-allocated objects to avoid GC pressure in instance update loop
const _translation = new THREE.Matrix4()
const _composed = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scale = new THREE.Vector3()

export const InstancedGLBModel = memo(function InstancedGLBModel({
  path,
  instances,
  selectionOffset,
  textures,
}: InstancedGLBModelProps) {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const gl = useThree((s) => s.gl)
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })
  ensureBoundsTree(gltf.scene)
  const lowTier = useValue(lowTierRendering)

  // Swap any perforation material on the loaded scene to the shared module-
  // level material before meshesInfo and the overlay clone capture it.
  // Idempotent per gltf.scene.
  useMemo(
    () => rewritePerforations(gltf.scene, textures, gl),
    [gltf.scene, textures, gl],
  )

  // Extract all meshes from the GLB. For InstancedMesh (from EXT_mesh_gpu_instancing),
  // expand per-instance matrices so each sub-instance gets rendered at its baked transform.
  // When low tier, materials are swapped to Lambert; the new materials live in
  // `meshesInfo.created` and get disposed when this memo's value is replaced.
  const meshesInfo = useMemo(() => {
    const result: {
      geometry: THREE.BufferGeometry
      material: THREE.Material | THREE.Material[]
      matrices: THREE.Matrix4[]
    }[] = []
    const created: THREE.Material[] = []
    const swap = (mat: THREE.Material | THREE.Material[]) => {
      if (!lowTier) return mat
      const next = downgradeMaterial(mat)
      if (next === mat) return mat
      if (Array.isArray(next)) {
        for (let i = 0; i < next.length; i++) {
          if (Array.isArray(mat) ? next[i] !== mat[i] : true) created.push(next[i])
        }
      } else {
        created.push(next)
      }
      return next
    }
    gltf.scene.updateMatrixWorld(true)
    const local = new THREE.Matrix4()
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) {
        const matrices: THREE.Matrix4[] = []
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, local)
          matrices.push(child.matrixWorld.clone().multiply(local))
        }
        result.push({ geometry: child.geometry, material: swap(child.material), matrices })
      } else if (child instanceof THREE.Mesh) {
        result.push({
          geometry: child.geometry,
          material: swap(child.material),
          matrices: [child.matrixWorld.clone()],
        })
      }
    })
    return { meshes: result, created }
  }, [gltf.scene, lowTier])
  const meshes = meshesInfo.meshes

  useEffect(() => {
    return () => {
      for (const m of meshesInfo.created) m.dispose()
    }
  }, [meshesInfo])

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

  // Outline overlay: clone (and optionally downgrade) the scene once per
  // gltf+lowTier combination. The clone is reused across selection changes —
  // we just toggle whether we render it. Created lambert materials are
  // disposed when this combo changes.
  const overlayInfo = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const created = lowTier ? downgradeMaterials(cloned) : []
    return { scene: cloned, created }
  }, [gltf.scene, lowTier])

  useEffect(() => {
    return () => {
      for (const m of overlayInfo.created) m.dispose()
    }
  }, [overlayInfo])

  // Apply external textures to materials on both the instanced render path
  // (`meshes[].material`) and the selection-outline overlay scene. After a
  // lowTier toggle these are separate material refs, so both need the texture.
  useEffect(() => {
    if (!textures) return
    return applyExternalTextures(textures, () => {
      const mats: THREE.Material[] = []
      for (const m of meshes) {
        const ms = Array.isArray(m.material) ? m.material : [m.material]
        mats.push(...ms)
      }
      overlayInfo.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const ms = Array.isArray(child.material) ? child.material : [child.material]
          mats.push(...ms)
        }
      })
      return mats
    })
  }, [meshes, overlayInfo, textures])

  const selectedScene = selectedInstance ? overlayInfo.scene : null

  // Create InstancedMesh2 instances imperatively since we need to compose matrices.
  // Each batch holds sledCount × subCount instances, laid out as [sled0_sub0, sled0_sub1, ..., sled1_sub0, ...].
  const instancedMeshes = useMemo(() => {
    return meshes.map((mesh) => {
      const subCount = mesh.matrices.length
      const totalCapacity = instances.length * subCount
      const geom = mesh.geometry.clone()
      geom.deleteAttribute('instanceIndex')
      const im = new InstancedMesh2(geom, mesh.material as THREE.Material, {
        capacity: totalCapacity,
        createEntities: true,
        renderer: gl,
      })
      im.perObjectFrustumCulled = false
      im.addInstances(totalCapacity, (entity, flatIdx) => {
        const sledIdx = Math.floor(flatIdx / subCount)
        const subIdx = flatIdx % subCount
        const pos = instances[sledIdx].position
        const p = Array.isArray(pos) ? pos : [pos, 0, 0]
        _translation.makeTranslation(p[0] as number, p[1] as number, p[2] as number)
        _composed.copy(_translation).multiply(mesh.matrices[subIdx])
        _composed.decompose(_pos, _quat, _scale)
        entity.position.copy(_pos)
        entity.quaternion.copy(_quat)
        entity.scale.copy(_scale)
      })
      return im
    })
  }, [meshes, instances, gl])

  // Hide/show selected instance for the offset effect
  const hideSelected = selectionOffset && selectedIndex >= 0

  useEffect(() => {
    for (let mIdx = 0; mIdx < instancedMeshes.length; mIdx++) {
      const im = instancedMeshes[mIdx]
      const subCount = meshes[mIdx].matrices.length
      for (let sledIdx = 0; sledIdx < instances.length; sledIdx++) {
        const hide = !!(hideSelected && sledIdx === selectedIndex)
        for (let subIdx = 0; subIdx < subCount; subIdx++) {
          im.setVisibilityAt(sledIdx * subCount + subIdx, !hide)
        }
      }
    }
  }, [instancedMeshes, meshes, instances, selectedIndex, hideSelected])

  // Dispose InstancedMesh2 instances and their cloned geometries. We can't
  // dispose synchronously in the cleanup because React StrictMode's synthetic
  // effect cycle (cleanup → setup) would dispose IMs that are still mounted
  // in the scene for the upcoming setup, causing GL "deleted buffer" errors.
  // Defer dispose via microtask; the next setup cancels it if it's reusing
  // the same IMs (StrictMode case). Different IMs (real prop change) → dispose.
  const pendingDisposeRef = useRef<{
    ims: InstancedMesh2[]
    cancelled: boolean
  } | null>(null)

  useEffect(() => {
    if (
      pendingDisposeRef.current &&
      pendingDisposeRef.current.ims === instancedMeshes
    ) {
      pendingDisposeRef.current.cancelled = true
      pendingDisposeRef.current = null
    }
    return () => {
      const handle = { ims: instancedMeshes, cancelled: false }
      pendingDisposeRef.current = handle
      queueMicrotask(() => {
        if (handle.cancelled) return
        pendingDisposeRef.current = null
        for (const im of handle.ims) {
          im.geometry.dispose()
          im.dispose()
        }
      })
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
        if (intersection?.instanceId != null && intersection.object) {
          const meshIdx = instancedMeshes.findIndex((im) => im === intersection.object)
          if (meshIdx < 0) return
          const subCount = meshes[meshIdx].matrices.length
          const sledIdx = Math.floor(intersection.instanceId / subCount)
          const targetId = instances[sledIdx].id
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
})
