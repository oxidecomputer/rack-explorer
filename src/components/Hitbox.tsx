/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { useMemo } from 'react'

import { showHitboxes } from '../atoms'

type Vec3 = [number, number, number]

interface HitboxProps {
  id: string
  target: Vec3
  scale: Vec3
}

/** Invisible box used as a click target for nodes that have a waypoint but no
 *  model (e.g. `disks`). Rendered with an unlit material so raycasts still hit
 *  it when material.visible is false. The `showHitboxes` debug flag turns it
 *  into a translucent wireframe for inspection. */
export function Hitbox({ id, target, scale }: HitboxProps) {
  const visible = useValue(showHitboxes)
  const userData = useMemo(() => ({ id }), [id])
  return (
    <mesh position={target} userData={userData}>
      <boxGeometry args={scale} />
      <meshBasicMaterial
        visible={visible}
        wireframe
        color="#48d597"
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}
