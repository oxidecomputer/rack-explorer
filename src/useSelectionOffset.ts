import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import * as THREE from 'three'

/**
 * Animates a group's position toward `offset` when active, back to origin when not.
 * Pass a `resetKey` to force-reset the animation (e.g. when switching instances).
 */
const ZERO: [number, number, number] = [0, 0, 0]

export function useSelectionOffset(
  active: boolean,
  offset: [number, number, number] | undefined,
  resetKey?: unknown,
) {
  const groupRef = useRef<THREE.Group>(null)
  const animPos = useRef(new THREE.Vector3())
  const prevKey = useRef(resetKey)
  const reducedMotion = useReducedMotion()

  if (prevKey.current !== resetKey) {
    animPos.current.set(0, 0, 0)
    prevKey.current = resetKey
  }

  useFrame((state, delta) => {
    if (!groupRef.current || !offset) return
    const target = active ? offset : ZERO
    const pos = animPos.current
    if (
      Math.abs(pos.x - target[0]) < 0.0001 &&
      Math.abs(pos.y - target[1]) < 0.0001 &&
      Math.abs(pos.z - target[2]) < 0.0001
    )
      return
    const rate = reducedMotion ? 1 : 1 - Math.pow(0.001, delta)
    pos.set(
      THREE.MathUtils.lerp(pos.x, target[0], rate),
      THREE.MathUtils.lerp(pos.y, target[1], rate),
      THREE.MathUtils.lerp(pos.z, target[2], rate),
    )
    groupRef.current.position.copy(pos)
    state.invalidate()
  })

  return groupRef
}
