import { useMemo } from 'react'
import * as THREE from 'three'

interface WireframeCubeProps {
  size: [number, number, number]
  position?: [number, number, number]
  color?: string
  lineWidth?: number
}

/**
 * Generates the 12 edges of a box as individual line strips.
 * Each edge is a pair of points suitable for a MeshLineGeometry.
 */
function getBoxEdges(w: number, h: number, d: number): [number, number, number][][] {
  const x = w / 2
  const y = h / 2
  const z = d / 2

  // 8 corners of the box
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

  // 12 edges as index pairs
  const edgeIndices: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ]

  return edgeIndices.map(([a, b]) => [corners[a], corners[b]])
}

export function WireframeCube({ size, position, color = 'hotpink', lineWidth = 1 }: WireframeCubeProps) {
  const edges = useMemo(() => getBoxEdges(...size), [size[0], size[1], size[2]])

  return (
    <group position={position}>
      {edges.map((edge, i) => {
        const points = new Float32Array(edge.flat())
        return (
          <mesh key={i}>
            <meshLineGeometry points={points} />
            <meshLineMaterial lineWidth={lineWidth} color={color} />
          </mesh>
        )
      })}
    </group>
  )
}
