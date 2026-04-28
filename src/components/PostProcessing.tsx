import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { BlendFunction, type OutlineEffect } from 'postprocessing'
import { useEffect, useRef, type ReactElement } from 'react'

export type AOQuality = 'full' | 'low' | 'off'

export const PostProcessing = ({
  aoQuality,
  enableOutline = true,
}: {
  aoQuality: AOQuality
  enableOutline?: boolean
}) => {
  const outlineRef = useRef<OutlineEffect>(null)
  const aoRef = useRef<any>(null)
  const patched = useRef(false)

  useEffect(() => {
    if (outlineRef.current && !patched.current) {
      // Skip the depth pass — it re-renders the entire scene to distinguish
      // visible vs hidden edges, but we use the same color for both.
      const depthPass = (outlineRef.current as any).depthPass
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
    if (!ao.effectShaderQuad || !ao.poissonBlurQuad || !ao.accumulationQuad) return
    ao.__temporallyPatched = true

    let frame = 0
    let lastW = 0
    let lastH = 0
    const noop = () => {}
    const origAO = ao.effectShaderQuad.render.bind(ao.effectShaderQuad)
    const origBlur = ao.poissonBlurQuad.render.bind(ao.poissonBlurQuad)
    const origAccum = ao.accumulationQuad.render.bind(ao.accumulationQuad)
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
        ao.effectShaderQuad.render = noop
        ao.poissonBlurQuad.render = noop
        ao.accumulationQuad.render = noop
      }
      origPass(renderer, input, output, dt, mask)
      if (skip) {
        ao.effectShaderQuad.render = origAO
        ao.poissonBlurQuad.render = origBlur
        ao.accumulationQuad.render = origAccum
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
