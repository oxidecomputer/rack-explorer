import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export const PostProcessing = ({ enableAO }: { enableAO: boolean }) => {
  return (
    <EffectComposer enableNormalPass={enableAO} autoClear={false}>
      <N8AO color="black" aoRadius={0.1} intensity={5} />
      <Outline
        edgeStrength={2.5}
        blendFunction={BlendFunction.ALPHA}
        visibleEdgeColor={4773271}
        hiddenEdgeColor={4773271}
        blur
      />
    </EffectComposer>
  )
}
