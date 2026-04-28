import * as THREE from 'three'

/** Replace every MeshStandardMaterial under `root` with a MeshLambertMaterial,
 *  preserving color, base map, and transparency. Lambert skips per-fragment
 *  env-map BRDF sampling, which is the dominant cost on integrated GPUs.
 *
 *  Operates on a cloned scene (caller's responsibility — `gltf.scene.clone(true)`),
 *  not the cached source. Returns the newly created materials so the caller can
 *  dispose them when the clone is replaced.
 *
 *  Preserves `name` so name-based lookups (e.g. external texture overrides)
 *  keep working — callers should not rely on `instanceof MeshStandardMaterial`. */
export function downgradeMaterials(root: THREE.Object3D): THREE.Material[] {
  const created: THREE.Material[] = []
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const swap = (mat: THREE.Material): THREE.Material => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return mat
      const lambert = new THREE.MeshLambertMaterial({
        color: mat.color,
        map: mat.map,
        transparent: mat.transparent,
        opacity: mat.opacity,
        alphaMap: mat.alphaMap,
        side: mat.side,
        vertexColors: mat.vertexColors,
        emissive: mat.emissive,
        emissiveIntensity: mat.emissiveIntensity,
        emissiveMap: mat.emissiveMap,
      })
      lambert.name = mat.name
      created.push(lambert)
      return lambert
    }
    if (Array.isArray(child.material)) {
      child.material = child.material.map(swap)
    } else {
      child.material = swap(child.material)
    }
  })
  return created
}

/** Single-material variant for callers that already hold a material reference
 *  (e.g. when extracting from a GLB scene without cloning the whole tree).
 *  Returns the same reference if no swap was performed. */
export function downgradeMaterial(
  mat: THREE.Material | THREE.Material[],
): THREE.Material | THREE.Material[] {
  if (Array.isArray(mat)) return mat.map((m) => downgradeMaterial(m) as THREE.Material)
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat
  const lambert = new THREE.MeshLambertMaterial({
    color: mat.color,
    map: mat.map,
    transparent: mat.transparent,
    opacity: mat.opacity,
    alphaMap: mat.alphaMap,
    side: mat.side,
    vertexColors: mat.vertexColors,
    emissive: mat.emissive,
    emissiveIntensity: mat.emissiveIntensity,
    emissiveMap: mat.emissiveMap,
  })
  lambert.name = mat.name
  return lambert
}
