/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/** Detects whether the browser will render WebGL via software (SwiftShader,
 *  llvmpipe, …). Returns true when no hardware-accelerated context is available.
 *
 *  Two layered checks: `failIfMajorPerformanceCaveat` is the spec-defined signal
 *  (browsers SHOULD return null when only software is on offer). Some browsers
 *  don't honor it, so we also string-match the renderer name. */
export function detectSoftwareRendering(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
    }) as WebGL2RenderingContext | null
    if (!gl) return true

    let isSoftware = false
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
      if (/SwiftShader|llvmpipe|software/i.test(renderer)) isSoftware = true
    }

    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return isSoftware
  } catch {
    return false
  }
}

/** The largest square edge (in device pixels) the GPU will allocate a render
 *  target at, taken as the min of MAX_RENDERBUFFER_SIZE and MAX_TEXTURE_SIZE.
 *
 *  Post-processing (EffectComposer, N8AO normal pass, MSAA) allocates offscreen
 *  targets at `canvasSize × DPR`. Chrome/ANGLE silently clamps oversized buffers;
 *  Firefox fails the allocation, yielding an incomplete framebuffer that takes
 *  the whole context down ("Width or height exceeds maximum renderbuffer size").
 *  Callers clamp DPR so device dimensions stay within this. Null if unknown. */
export function probeMaxBufferSize(): number | null {
  if (typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) return null
    const maxRb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    const max = Math.min(maxRb, maxTex)
    return Number.isFinite(max) && max > 0 ? max : null
  } catch {
    return null
  }
}
