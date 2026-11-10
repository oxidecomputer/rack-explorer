/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import {
  componentTree,
  getDescendantModels,
  getNodeModels,
  type ModelConfig,
} from './data/componentTree'
import { dracoLoader } from './loaders'

// Must match the extension the model components pass to useLoader. The
// cache key is [GLTFLoader, path], so a preload here is picked up by the
// later useLoader(GLTFLoader, path) without a second fetch or decode.
const withDraco = (loader: GLTFLoader) => {
  loader.setDRACOLoader(dracoLoader)
}

const requested = new Set<string>()

function preloadModel(path: string) {
  if (requested.has(path)) return
  requested.add(path)
  useLoader.preload(GLTFLoader, path, withDraco)
}

/** Start fetching and decoding everything the rack overview shows, plus the
 *  Draco decoder itself. Called at module load so this overlaps GPU tier
 *  detection instead of waiting for the Canvas to mount and suspend. */
export function preloadRackModels(include: (model: ModelConfig) => boolean = () => true) {
  dracoLoader.preload()
  const top = [componentTree, ...(componentTree.children ?? [])]
  for (const node of top) {
    for (const model of getNodeModels(node)) {
      if (include(model)) preloadModel(model.path)
    }
  }
}

/** Warm the cache for every drill-in view (sled internals, switch internals)
 *  once the browser is idle, so the first drill-in doesn't suspend the scene
 *  on a network fetch + decode. */
export function prefetchDrillInModels(
  include: (model: ModelConfig) => boolean = () => true,
) {
  return onIdle(() => {
    for (const child of componentTree.children ?? []) {
      if (!child.children) continue
      for (const { model } of getDescendantModels(child.id)) {
        if (include(model)) preloadModel(model.path)
      }
    }
  })
}

/** requestIdleCallback with a fallback for browsers without it (Safari).
 *  Returns a canceller. */
export function onIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(fn, { timeout })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = window.setTimeout(fn, 200)
  return () => window.clearTimeout(handle)
}
