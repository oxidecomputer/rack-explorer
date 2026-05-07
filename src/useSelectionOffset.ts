import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useCallback, useRef } from 'react'
import * as THREE from 'three'

/**
 * Animates a group's position toward `offset` when active, back to origin when not.
 * Position persists across re-renders of a mounted group (so a sled-to-sled
 * switch holds the extended pose), but resets to origin the moment the group
 * unmounts — that way a subsequent remount (e.g. re-selecting after deselect)
 * starts cleanly instead of carrying the previous extended value.
 */
const ZERO: [number, number, number] = [0, 0, 0]

export function useSelectionOffset(
  active: boolean,
  offset: [number, number, number] | undefined,
  /** When true on first render, animPos is initialized at `offset` instead of
   *  origin — used when a component mounts with a selection already in its
   *  extended state (e.g. returning from a drilldown). */
  startAtOffset = false,
  /** Whenever this value changes after the first render, animPos snaps to
   *  origin (no lerp). Use it to force-reset position on a sled-to-sled
   *  switch so the new selection starts cleanly without retracting from
   *  the previous extended pose. */
  resetSignal?: unknown,
) {
  const groupRef = useRef<THREE.Group | null>(null)
  const animPos = useRef(new THREE.Vector3())
  const initRef = useRef(false)
  if (!initRef.current) {
    initRef.current = true
    if (startAtOffset && offset) {
      animPos.current.set(offset[0], offset[1], offset[2])
    }
  }
  const lastResetRef = useRef(resetSignal)
  if (lastResetRef.current !== resetSignal) {
    lastResetRef.current = resetSignal
    animPos.current.set(0, 0, 0)
  }
  const reducedMotion = useReducedMotion()

  const setGroup = useCallback((node: THREE.Group | null) => {
    groupRef.current = node
    if (!node) animPos.current.set(0, 0, 0)
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current || !offset) return
    const target = active ? offset : ZERO
    const pos = animPos.current
    if (
      Math.abs(pos.x - target[0]) < 0.0001 &&
      Math.abs(pos.y - target[1]) < 0.0001 &&
      Math.abs(pos.z - target[2]) < 0.0001
    ) {
      // animPos is settled, but the group's three.js position may still
      // be stale (e.g. we just snapped animPos via resetSignal, or it was
      // initialized via startAtOffset and the lerp never ran). Sync once.
      if (!groupRef.current.position.equals(pos)) {
        groupRef.current.position.copy(pos)
        state.invalidate()
      }
      return
    }
    const rate = reducedMotion ? 1 : 1 - Math.pow(0.001, delta)
    pos.set(
      THREE.MathUtils.lerp(pos.x, target[0], rate),
      THREE.MathUtils.lerp(pos.y, target[1], rate),
      THREE.MathUtils.lerp(pos.z, target[2], rate),
    )
    groupRef.current.position.copy(pos)
    state.invalidate()
  })

  return setGroup
}
