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
