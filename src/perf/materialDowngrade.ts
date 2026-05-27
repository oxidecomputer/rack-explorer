/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import * as THREE from 'three'

import { SHARED_PERF_MATERIAL } from '../components/textureApply'

function toLambert(mat: THREE.MeshStandardMaterial): THREE.MeshLambertMaterial {
  const lambert = new THREE.MeshLambertMaterial({
    color: mat.color,
    map: mat.map,
    transparent: mat.transparent,
    opacity: mat.opacity,
    alphaMap: mat.alphaMap,
    alphaTest: mat.alphaTest,
    side: mat.side,
    vertexColors: mat.vertexColors,
    emissive: mat.emissive,
    emissiveIntensity: mat.emissiveIntensity,
    emissiveMap: mat.emissiveMap,
  })
  lambert.name = mat.name
  return lambert
}

/** Replace every MeshStandardMaterial under `root` with a MeshLambertMaterial,
 *  preserving color, base map, and transparency. Lambert skips per-fragment
 *  env-map BRDF sampling, which is the dominant cost on integrated GPUs.
 *
 *  Operates on a cloned scene (caller's responsibility — `gltf.scene.clone(true)`),
 *  not the cached source. Returns the newly created materials so the caller can
 *  dispose them when the clone is replaced.
 *
 *  Preserves `name` so name-based lookups (e.g. external texture overrides)
 *  keep working — callers should not rely on `instanceof MeshStandardMaterial`.
 *
 *  Skips SHARED_PERF_MATERIAL: it's a module-level singleton owned by
 *  textureApply, so cloning per-mesh would defeat the sharing AND lose the
 *  alphaMap that gets attached asynchronously. */
export function downgradeMaterials(root: THREE.Object3D): THREE.Material[] {
  const created: THREE.Material[] = []
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const swap = (mat: THREE.Material): THREE.Material => {
      if (mat === SHARED_PERF_MATERIAL) return mat
      if (!(mat instanceof THREE.MeshStandardMaterial)) return mat
      const lambert = toLambert(mat)
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
  if (mat === SHARED_PERF_MATERIAL) return mat
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat
  return toLambert(mat)
}
