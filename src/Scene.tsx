import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

export const Scene = () => {
  return (
    <Canvas className="absolute inset-0">
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshPhongMaterial />
      </mesh>
      <ambientLight intensity={0.1} />
      <directionalLight position={[0, 0, 5]} color="red" />
      <OrbitControls />
    </Canvas>
  )
}
