import { Line } from '@react-three/drei'
import { useMemo } from 'react'

interface WireframeCubeProps {
  size: [number, number, number]
  position?: [number, number, number]
  color?: string
  lineWidth?: number
}

function getBoxEdges(w: number, h: number, d: number): [number, number, number][][] {
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

  const edgeIndices: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0], // back face
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4], // front face
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7], // connecting edges
  ]

  return edgeIndices.map(([a, b]) => [corners[a], corners[b]])
}

export function WireframeCube({
  size,
  position,
  color = 'hotpink',
  lineWidth = 1,
}: WireframeCubeProps) {
  const edges = useMemo(() => getBoxEdges(...size), size)

  return (
    <group position={position}>
      {edges.map((edge, i) => (
        <Line key={i} points={edge} color={color} lineWidth={lineWidth} />
      ))}
    </group>
  )
}
