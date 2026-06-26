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

/** Largest render-target edge (device px) the GPU allows: min of
 *  MAX_RENDERBUFFER_SIZE and MAX_TEXTURE_SIZE. Null if unknown.
 *
 *  Post-processing targets are sized at `canvasSize × DPR`; on overflow Firefox
 *  loses the context (Chrome/ANGLE silently clamps), so callers clamp DPR to fit. */
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

/** Highest MSAA count (4→2, else 0) the GPU can allocate at `width × height`.
 *
 *  MAX_RENDERBUFFER_SIZE only bounds the edge, but a multisampled renderbuffer
 *  must also fit `w × h × samples × bytesPerPixel` in one allocation — on large
 *  displays at high DPR this overflows ANGLE/Metal's per-resource limit, leaving
 *  EffectComposer a zero-size framebuffer → black scene. Not predictable from any
 *  GL param, so we try each count against an off-screen RGBA16F FBO (matching
 *  EffectComposer's HalfFloat buffers) and take the first that's COMPLETE.
 *  Capped at 4× — 8× is visually indistinguishable but doubles the allocation. */
export function probeMaxSamples(width: number, height: number): number {
  if (typeof document === 'undefined') return 0
  if (!(width > 0) || !(height > 0)) return 0
  let gl: WebGL2RenderingContext | null = null
  try {
    const canvas = document.createElement('canvas')
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) return 0
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

    let result = 0
    for (const samples of [4, 2]) {
      if (samples > maxSamples) continue
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      // Clear stale errors so getError() reflects only this allocation.
      while (gl.getError() !== gl.NO_ERROR) {
        /* drain */
      }
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, width, height)
      const allocError = gl.getError()
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.RENDERBUFFER,
        rb,
      )
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      gl.deleteRenderbuffer(rb)
      if (allocError === gl.NO_ERROR && status === gl.FRAMEBUFFER_COMPLETE) {
        result = samples
        break
      }
    }

    gl.deleteFramebuffer(fb)
    return result
  } catch {
    return 0
  } finally {
    // Free the probe context so it doesn't evict the real canvas's (browsers
    // cap simultaneous contexts at ~16).
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
