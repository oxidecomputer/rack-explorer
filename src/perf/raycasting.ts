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

const scheduled = new WeakSet<THREE.Object3D>()

/** Schedule a BVH build for every Mesh geometry under `root`, in idle time.
 *  Idempotent — safe to call during render from every component that shares
 *  the same cached GLTF scene. Raycasts only happen on click, and
 *  acceleratedRaycast falls back to the standard per-triangle path for any
 *  geometry without a BVH yet, so deferring is safe — it just keeps the
 *  build (tens of ms for the larger interiors) off the drill-in frame. */
export function ensureBoundsTree(root: THREE.Object3D): void {
  if (scheduled.has(root)) return
  scheduled.add(root)
  const run = () => buildBoundsTrees(root)
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2000 })
  } else {
    setTimeout(run, 200)
  }
}

function buildBoundsTrees(root: THREE.Object3D): void {
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
