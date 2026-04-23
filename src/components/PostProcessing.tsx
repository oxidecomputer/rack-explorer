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

  const effects: ReactElement[] = []
  if (aoEnabled) {
    effects.push(
      <N8AO
        key="ao"
        color="black"
        denoiseSamples={isLow ? 2 : 4}
        denoiseRadius={isLow ? 6 : 12}
        distanceFalloff={0.5}
        aoRadius={0.1}
        intensity={5}
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
      />,
    )
  }

  return (
    <EffectComposer enableNormalPass={aoEnabled} autoClear={false}>
      {effects}
    </EffectComposer>
  )
}
