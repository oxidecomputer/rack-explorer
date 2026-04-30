import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { BlendFunction, type OutlineEffect } from 'postprocessing'
import { useEffect, useRef, type ReactElement } from 'react'

export type AOQuality = 'full' | 'low' | 'off'

type QuadRender = (...args: unknown[]) => void
type AORender = (
  renderer: unknown,
  input: { width: number; height: number },
  output: unknown,
  dt: unknown,
  mask: unknown,
) => void
type N8AOLike = {
  __temporallyPatched?: boolean
  effectShaderQuad?: { render: QuadRender }
  poissonBlurQuad?: { render: QuadRender }
  accumulationQuad?: { render: QuadRender }
  render: AORender
}

export const PostProcessing = ({
  aoQuality,
  enableOutline = true,
}: {
  aoQuality: AOQuality
  enableOutline?: boolean
}) => {
  const outlineRef = useRef<OutlineEffect>(null)
  const aoRef = useRef<N8AOLike>(null)
  const patched = useRef(false)

  useEffect(() => {
    if (outlineRef.current && !patched.current) {
      // Skip the depth pass — it re-renders the entire scene to distinguish
      // visible vs hidden edges, but we use the same color for both.
      const depthPass = (outlineRef.current as unknown as { depthPass?: { render: () => void } })
        .depthPass
      if (depthPass) {
        depthPass.render = () => {}
      }
      patched.current = true
    }
  }, [])

  const aoEnabled = aoQuality !== 'off'
  const isLow = aoQuality === 'low'

  // Temporal amortization: skip the expensive AO compute (sample, denoise,
  // accumulate) on alternate frames. The composite still runs every frame
  // against the cached accumulationRenderTarget, so AO is applied to fresh
  // scene color — only the AO mask is one frame stale.
  useEffect(() => {
    const ao = aoRef.current
    if (!ao || !aoEnabled || ao.__temporallyPatched) return
    const effectQuad = ao.effectShaderQuad
    const blurQuad = ao.poissonBlurQuad
    const accumQuad = ao.accumulationQuad
    if (!effectQuad || !blurQuad || !accumQuad) return
    ao.__temporallyPatched = true

    let frame = 0
    let lastW = 0
    let lastH = 0
    const noop = () => {}
    const origAO = effectQuad.render.bind(effectQuad)
    const origBlur = blurQuad.render.bind(blurQuad)
    const origAccum = accumQuad.render.bind(accumQuad)
    const origPass = ao.render.bind(ao)

    ao.render = (
      renderer: unknown,
      input: { width: number; height: number },
      output: unknown,
      dt: unknown,
      mask: unknown,
    ) => {
      // Force compute on resize — accumulationRenderTarget is cleared by setSize.
      const resized = input.width !== lastW || input.height !== lastH
      lastW = input.width
      lastH = input.height
      const skip = !resized && (frame++ & 1) === 1
      if (skip) {
        effectQuad.render = noop
        blurQuad.render = noop
        accumQuad.render = noop
      }
      origPass(renderer, input, output, dt, mask)
      if (skip) {
        effectQuad.render = origAO
        blurQuad.render = origBlur
        accumQuad.render = origAccum
      }
    }
  }, [aoEnabled, aoQuality])

  const effects: ReactElement[] = []
  if (aoEnabled) {
    effects.push(
      <N8AO
        key="ao"
        ref={aoRef}
        color="black"
        denoiseSamples={isLow ? 2 : 4}
        denoiseRadius={isLow ? 6 : 12}
        distanceFalloff={0.5}
        aoRadius={0.1}
        intensity={3.3}
        halfRes
      />,
    )
  }
  if (enableOutline) {
    effects.push(
      <Outline
        key="outline"
        ref={outlineRef}
        edgeStrength={2.5}
        blendFunction={BlendFunction.ALPHA}
        visibleEdgeColor={4773271}
        hiddenEdgeColor={4773271}
        resolutionScale={0.5}
      />,
    )
  }

  return (
    <EffectComposer enableNormalPass={aoEnabled} autoClear={false}>
      {effects}
    </EffectComposer>
  )
}
