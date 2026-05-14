/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useThree } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import { EffectComposer as PPEffectComposer } from 'postprocessing'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { canvasExportRequest } from '../atoms'

const EXPORT_SCALE = 4

/** PostProcessing.tsx writes its EffectComposer ref here on mount and clears it
 *  on unmount, so the exporter can drive the same composer that's currently
 *  rendering the scene. Null when post-processing is disabled. */
export const sharedComposerRef: { current: PPEffectComposer | null } = { current: null }

function downloadPNG(pixels: Uint8Array, width: number, height: number, filename: string) {
  // WebGL pixel rows run bottom-up; flip into a top-down ImageData buffer.
  const flipped = new Uint8ClampedArray(width * height * 4)
  const rowBytes = width * 4
  for (let y = 0; y < height; y++) {
    const src = y * rowBytes
    const dst = (height - 1 - y) * rowBytes
    flipped.set(pixels.subarray(src, src + rowBytes), dst)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(new ImageData(flipped, width, height), 0, 0)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function exportCanvas(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const composer = sharedComposerRef.current

  // Save state
  const origPixelRatio = gl.getPixelRatio()
  const origSize = new THREE.Vector2()
  gl.getSize(origSize)
  const origBackground = scene.background
  const origClearColor = new THREE.Color()
  gl.getClearColor(origClearColor)
  const origClearAlpha = gl.getClearAlpha()

  // Configure for export. setSize with updateStyle=false grows the backing
  // buffer without resizing the canvas's CSS box — the browser just downscales
  // the high-res render to the same on-screen size for one frame.
  scene.background = null
  gl.setClearColor(0x000000, 0)
  gl.setPixelRatio(EXPORT_SCALE)
  if (composer) composer.setSize(width, height, false)
  else gl.setSize(width, height, false)

  try {
    if (composer) composer.render()
    else gl.render(scene, camera)

    const w = gl.domElement.width
    const h = gl.domElement.height
    const ctx = gl.getContext()
    const pixels = new Uint8Array(w * h * 4)
    ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels)
    downloadPNG(pixels, w, h, `rack-explorer-${Date.now()}.png`)
  } finally {
    gl.setPixelRatio(origPixelRatio)
    if (composer) composer.setSize(origSize.x, origSize.y, false)
    else gl.setSize(origSize.x, origSize.y, false)
    scene.background = origBackground
    gl.setClearColor(origClearColor, origClearAlpha)
  }
}

export function CanvasExporter() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const requestId = useValue(canvasExportRequest)
  const lastHandledRef = useRef(0)

  useEffect(() => {
    if (requestId === 0 || requestId === lastHandledRef.current) return
    lastHandledRef.current = requestId
    try {
      exportCanvas(gl, scene, camera, size.width, size.height)
    } catch (err) {
      console.error('Canvas export failed', err)
    }
    // 'demand' frameloop won't auto-repaint after our manual render — kick it
    // so the screen returns to its normal state at the original resolution.
    invalidate()
  }, [requestId, gl, scene, camera, size, invalidate])

  return null
}
