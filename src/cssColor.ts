/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import * as THREE from 'three'

let ctx: CanvasRenderingContext2D | null | undefined

/** A design-system color token (e.g. `--color-neutral-300`) as a THREE.Color.
 *  The tokens are `oklch()`, which THREE.Color can't parse, so the browser
 *  resolves it to sRGB by painting a pixel. Call after the stylesheet has
 *  loaded (i.e. at render time, not module load). */
export function cssColor(token: string): THREE.Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const color = new THREE.Color()
  if (!ctx || !value) return color
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}
