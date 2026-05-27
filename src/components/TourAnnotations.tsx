/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Html } from '@react-three/drei'
import { useValue } from '@tldraw/state-react'
import { useMemo } from 'react'

import { activeTourStep, selectedId } from '../atoms'
import { getInstanceContext, getNode, getNodeModels } from '../data/componentTree'
import type { TourAnnotation } from '../data/guidedTours'

type Vec3 = [number, number, number]

function getElementPosition(id: string): Vec3 {
  const ctx = getInstanceContext(id)
  if (ctx) return ctx.instancePosition

  const [baseId] = id.split(':')
  const node = getNode(baseId)
  if (node) {
    const positioned = getNodeModels(node.node).find((m) => m.position)
    if (positioned?.position) return positioned.position
  }

  return [0, 0, 0]
}

function Annotation({
  label,
  description,
  position,
  offset,
}: TourAnnotation & { offset: Vec3 }) {
  const worldPos: Vec3 = [
    position[0] + offset[0],
    position[1] + offset[1],
    position[2] + offset[2],
  ]

  return (
    <Html position={worldPos}>
      <div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-3">
        <div className="bg-default w-60 rounded-md p-2">
          <div className="text-mono-xs text-quaternary uppercase">{label}</div>
          <div className="text-sans-sm text-default pr-2">{description}</div>
        </div>
      </div>
    </Html>
  )
}

export function TourAnnotations() {
  const step = useValue(activeTourStep)
  const currentSelectedId = useValue(selectedId)

  const offset = useMemo(() => getElementPosition(currentSelectedId), [currentSelectedId])

  if (!step?.annotations?.length) return null

  return (
    <>
      {step.annotations.map((annotation, i) => (
        <Annotation key={i} {...annotation} offset={offset} />
      ))}
    </>
  )
}
