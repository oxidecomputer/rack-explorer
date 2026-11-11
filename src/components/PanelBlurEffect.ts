/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { BlendFunction, Effect, ShaderPass } from 'postprocessing'
import {
  ShaderMaterial,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type TextureDataType,
  type WebGLRenderer,
} from 'three'

import { blurRegions, MAX_BLUR_REGIONS } from './canvasBlur'

// Blurs the rendered frame inside the rects of the DOM panels registered in
// canvasBlur.ts, standing in for CSS `backdrop-filter: blur(12px)`: a box
// downsample to one texel per BLUR_TEXEL_CSS_PX, then a separable Gaussian.
// Three small passes, and the same blur at any DPR.

/** CSS `blur(12px)` is a Gaussian with a 12px standard deviation. */
const BLUR_SIGMA_CSS_PX = 12

/** Blur resolution, in CSS px per blur texel. `high` is plenty for a 12px
 *  blur (a quarter of full res at 2x DPR); `low`, for low-tier GPUs, has a
 *  quarter of the texels and half the taps, and looks nearly the same at
 *  this blur size. */
export type PanelBlurQuality = 'high' | 'low'
const BLUR_TEXEL_CSS_PX: Record<PanelBlurQuality, number> = { high: 2, low: 4 }

// Gaussian taps out to 3σ, paired so each bilinear fetch reads two texels at
// once: offset = weighted mean of the pair, weight = their sum.
function gaussianTaps(sigmaTexels: number) {
  const radius = Math.ceil(sigmaTexels * 3)
  const w = (i: number) => Math.exp(-(i * i) / (2 * sigmaTexels * sigmaTexels))
  const offsets = [0]
  const weights = [w(0)]
  for (let i = 1; i <= radius; i += 2) {
    const a = w(i)
    const b = i + 1 <= radius ? w(i + 1) : 0
    offsets.push((i * a + (i + 1) * b) / (a + b))
    weights.push(a + b)
  }
  const total = weights[0] + 2 * weights.slice(1).reduce((s, x) => s + x, 0)
  return { offsets, weights: weights.map((x) => x / total) }
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

/** Box-filter downsample: four bilinear taps cover a `2·spread` texel square. */
class DownsampleMaterial extends ShaderMaterial {
  constructor() {
    super({
      name: 'PanelBlur.Downsample',
      uniforms: {
        inputBuffer: new Uniform(null),
        texelSize: new Uniform(new Vector2()),
        spread: new Uniform(1),
      },
      vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D inputBuffer;
        uniform vec2 texelSize;
        uniform float spread;
        varying vec2 vUv;
        void main() {
          vec2 d = texelSize * spread;
          gl_FragColor = 0.25 * (
            texture2D(inputBuffer, vUv + vec2(-d.x, -d.y)) +
            texture2D(inputBuffer, vUv + vec2(d.x, -d.y)) +
            texture2D(inputBuffer, vUv + vec2(-d.x, d.y)) +
            texture2D(inputBuffer, vUv + vec2(d.x, d.y)));
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
  }
}

/** One axis of the Gaussian; `direction` is a texel step along that axis. */
class GaussianMaterial extends ShaderMaterial {
  constructor(sigmaTexels: number) {
    const taps = gaussianTaps(sigmaTexels)
    super({
      name: 'PanelBlur.Gaussian',
      defines: { TAPS: String(taps.offsets.length) },
      uniforms: {
        inputBuffer: new Uniform(null),
        direction: new Uniform(new Vector2()),
        offsets: new Uniform(taps.offsets),
        weights: new Uniform(taps.weights),
      },
      vertexShader,
      fragmentShader: /* glsl */ `
        uniform sampler2D inputBuffer;
        uniform vec2 direction;
        uniform float offsets[TAPS];
        uniform float weights[TAPS];
        varying vec2 vUv;
        void main() {
          vec4 sum = texture2D(inputBuffer, vUv) * weights[0];
          for (int i = 1; i < TAPS; i++) {
            vec2 o = direction * offsets[i];
            sum += (texture2D(inputBuffer, vUv + o) + texture2D(inputBuffer, vUv - o)) * weights[i];
          }
          gl_FragColor = sum;
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
  }
}

const fragmentShader = /* glsl */ `
uniform sampler2D pbMap;
uniform vec2 pbViewSize;
uniform int pbCount;
uniform vec4 pbRects[MAX_REGIONS];
uniform vec2 pbStyles[MAX_REGIONS];
uniform vec3 pbBackground;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 p = uv * pbViewSize;
  float mask = 0.0;
  for (int i = 0; i < MAX_REGIONS; i++) {
    if (i >= pbCount) break;
    vec4 r = pbRects[i];
    vec2 halfSize = r.zw * 0.5;
    float radius = min(pbStyles[i].x, min(halfSize.x, halfSize.y));
    // Rounded-rect signed distance in CSS px; 1px antialiased edge.
    vec2 q = abs(p - (r.xy + halfSize)) - halfSize + radius;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    mask = max(mask, clamp(0.5 - d, 0.0, 1.0) * pbStyles[i].y);
  }
  if (mask <= 0.0) {
    outputColor = inputColor;
    return;
  }
  // The canvas is transparent over the page background. CSS backdrop blur
  // blurs the composited result, so put the blurred frame over that colour
  // (the blur of a straight-alpha frame with black transparent texels is
  // premultiplied) and output it opaque. Blended with SRC, so the outline
  // drawn earlier in this pass can't show through partial alpha.
  vec4 blurred = texture2D(pbMap, uv);
  vec4 frosted = vec4(blurred.rgb + pbBackground * (1.0 - blurred.a), 1.0);
  outputColor = mix(inputColor, frosted, mask);
}
`

const _size = new Vector2()

export class PanelBlurEffect extends Effect {
  private readonly targetA = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  private readonly targetB = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  private readonly texelCssPx: number
  private readonly downsampleMaterial = new DownsampleMaterial()
  private readonly gaussianMaterial: GaussianMaterial
  private readonly downsamplePass = new ShaderPass(this.downsampleMaterial)
  private readonly gaussianPass: ShaderPass
  private baseWidth = 1
  private baseHeight = 1
  private dpr = 0

  constructor(quality: PanelBlurQuality = 'high') {
    super('PanelBlurEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      defines: new Map([['MAX_REGIONS', String(MAX_BLUR_REGIONS)]]),
      uniforms: new Map<string, Uniform>([
        ['pbMap', new Uniform(null)],
        ['pbViewSize', new Uniform(new Vector2())],
        ['pbCount', new Uniform(0)],
        // Shared with canvasBlur.ts; three uploads typed arrays as-is.
        ['pbRects', new Uniform(blurRegions.rects)],
        ['pbStyles', new Uniform(blurRegions.styles)],
        ['pbBackground', new Uniform(new Vector3())],
      ]),
    })
    this.texelCssPx = BLUR_TEXEL_CSS_PX[quality]
    this.gaussianMaterial = new GaussianMaterial(BLUR_SIGMA_CSS_PX / this.texelCssPx)
    this.gaussianPass = new ShaderPass(this.gaussianMaterial)
    this.targetA.texture.name = 'PanelBlur.A'
    this.targetB.texture.name = 'PanelBlur.B'
    this.uniforms.get('pbMap')!.value = this.targetA.texture
  }

  /** The page colour behind the (transparent) canvas, as a CSS colour. */
  setBackground(cssColor: string) {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    // The frame is linear until the composer encodes its output.
    const linear = (c: number) => {
      const v = c / 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    this.uniforms.get('pbBackground')!.value.set(linear(r), linear(g), linear(b))
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    const count = blurRegions.count
    this.uniforms.get('pbCount')!.value = count
    this.uniforms.get('pbViewSize')!.value.copy(renderer.getSize(_size))
    if (count === 0) return

    const dpr = renderer.getPixelRatio()
    if (dpr !== this.dpr) {
      this.dpr = dpr
      this.resize()
    }
    // Full res → blur res, then horizontal (A → B) and vertical (B → A).
    this.downsamplePass.render(renderer, inputBuffer, this.targetA)
    const direction = this.gaussianMaterial.uniforms.direction.value as Vector2
    direction.set(1 / this.targetA.width, 0)
    this.gaussianPass.render(renderer, this.targetA, this.targetB)
    direction.set(0, 1 / this.targetA.height)
    this.gaussianPass.render(renderer, this.targetB, this.targetA)
  }

  override setSize(width: number, height: number) {
    this.baseWidth = width
    this.baseHeight = height
    this.resize()
  }

  private resize() {
    // One blur texel per texelCssPx CSS px, whatever the DPR.
    const factor = this.texelCssPx * Math.max(this.dpr, 1)
    const w = Math.max(1, Math.round(this.baseWidth / factor))
    const h = Math.max(1, Math.round(this.baseHeight / factor))
    this.targetA.setSize(w, h)
    this.targetB.setSize(w, h)
    const down = this.downsampleMaterial.uniforms
    ;(down.texelSize.value as Vector2).set(1 / this.baseWidth, 1 / this.baseHeight)
    // Four taps at ±factor/4 texels, each averaging 2×2, cover factor×factor.
    down.spread.value = Math.max(0.5, factor / 4)
  }

  override initialize(_renderer: WebGLRenderer, _alpha: boolean, frameBufferType: number) {
    if (frameBufferType === undefined) return
    this.targetA.texture.type = frameBufferType as TextureDataType
    this.targetB.texture.type = frameBufferType as TextureDataType
  }
}
