import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'

export const PostProcessing = () => {
  return (
    <EffectComposer enableNormalPass autoClear={false}>
      <N8AO color="black" aoRadius={0.1} intensity={5} />
      <Outline width={5} visibleEdgeColor={4773271} hiddenEdgeColor={4773271} blur />
    </EffectComposer>
  )
}
