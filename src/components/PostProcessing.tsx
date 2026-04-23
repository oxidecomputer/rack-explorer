import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { useEffect, useRef, type ReactElement } from 'react'
import { BlendFunction } from 'postprocessing'
import type { OutlineEffect } from 'postprocessing'

export const PostProcessing = ({
  enableAO,
  enableOutline = true,
}: {
  enableAO: boolean
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

  const effects: ReactElement[] = []
  if (enableAO) {
    effects.push(
      <N8AO key="ao" color="black" aoRadius={0.1} intensity={5} halfRes />,
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
        blur
      />,
    )
  }

  return (
    <EffectComposer enableNormalPass={enableAO} autoClear={false}>
      {effects}
    </EffectComposer>
  )
}
