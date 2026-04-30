import { useMemo } from 'react'
import * as THREE from 'three'

interface WireframeCubeProps {
  size: [number, number, number]
  position?: [number, number, number]
  color?: string
}

export function WireframeCube({
  size,
  position,
  color = '#5D5E61',
}: WireframeCubeProps) {
  const [w, h, d] = size
  const geometry = useMemo(() => {
    const x = w / 2
    const y = h / 2
    const z = d / 2

    const corners: [number, number, number][] = [
      [-x, -y, -z],
      [x, -y, -z],
      [x, y, -z],
      [-x, y, -z],
      [-x, -y, z],
      [x, -y, z],
      [x, y, z],
      [-x, y, z],
    ]

    const edgeIndices = [
      0, 1, 1, 2, 2, 3, 3, 0, // back face
      4, 5, 5, 6, 6, 7, 7, 4, // front face
      0, 4, 1, 5, 2, 6, 3, 7, // connecting edges
    ]

    const positions = new Float32Array(edgeIndices.length * 3)
    for (let i = 0; i < edgeIndices.length; i++) {
      const c = corners[edgeIndices[i]]
      positions[i * 3] = c[0]
      positions[i * 3 + 1] = c[1]
      positions[i * 3 + 2] = c[2]
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [w, h, d])

  return (
    // raycast disabled — the default Line threshold (1 world unit) is huge
    // relative to a sled, so the wireframe edges intercept clicks the user
    // intends as background, blocking onPointerMissed (double-click-to-go-up).
    <lineSegments geometry={geometry} position={position} raycast={() => null}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  )
}
