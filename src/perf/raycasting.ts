/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

// Patch Three.js prototypes once at module load. Geometries with a `boundsTree`
// will use BVH-accelerated raycasting (O(log N) vs O(N)). Meshes whose
// geometries have no `boundsTree` fall back to default behavior — so this is
// safe to apply globally.
;(
  THREE.BufferGeometry.prototype as unknown as {
    computeBoundsTree: typeof computeBoundsTree
  }
).computeBoundsTree = computeBoundsTree
;(
  THREE.BufferGeometry.prototype as unknown as {
    disposeBoundsTree: typeof disposeBoundsTree
  }
).disposeBoundsTree = disposeBoundsTree
;(THREE.Mesh.prototype as unknown as { raycast: typeof acceleratedRaycast }).raycast =
  acceleratedRaycast

const BUILT_KEY = '__rackExplorerBvhBuilt'

/** Build a BVH for every Mesh geometry under `root`, if not already built.
 *  Idempotent — safe to call across components that share the same cached
 *  GLTF scene. The build is one-time and adds a few ms per geometry; after
 *  that, raycasts (clicks) traverse the BVH instead of every triangle. */
export function ensureBoundsTree(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const geom = child.geometry as THREE.BufferGeometry & {
      [BUILT_KEY]?: true
      computeBoundsTree?: typeof computeBoundsTree
    }
    if (!geom || geom[BUILT_KEY] || !geom.computeBoundsTree) return
    geom.computeBoundsTree()
    geom[BUILT_KEY] = true
  })
}
