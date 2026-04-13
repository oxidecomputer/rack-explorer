import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { useEffect, useRef } from 'react'
import { BlendFunction } from 'postprocessing'
import type { OutlineEffect } from 'postprocessing'

export const PostProcessing = ({ enableAO }: { enableAO: boolean }) => {
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

  return (
    <EffectComposer enableNormalPass={enableAO} autoClear={false}>
      {enableAO ? (
        <>
          <N8AO color="black" aoRadius={0.1} intensity={5} />
          <Outline
            ref={outlineRef}
            edgeStrength={2.5}
            blendFunction={BlendFunction.ALPHA}
            visibleEdgeColor={4773271}
            hiddenEdgeColor={4773271}
            blur
          />
        </>
      ) : (
        <Outline
          ref={outlineRef}
          edgeStrength={2.5}
          blendFunction={BlendFunction.ALPHA}
          visibleEdgeColor={4773271}
          hiddenEdgeColor={4773271}
          blur
        />
      )}
    </EffectComposer>
  )
}
