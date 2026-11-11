/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { memo, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

import { rackCount } from '../atoms'
import { cssColor } from '../cssColor'
import {
  formatCount,
  getRackPosition,
  RACK_CENTER,
  RACK_DIMENSIONS_MM,
  RACK_SIZE,
  RACKS_PER_ROW,
} from '../data/configurator'

type Vec3 = [number, number, number]

const LINE_COLOR = '#7E8385'
/** Gap between the rack and its dimension lines. */
const OFFSET = 0.12
/** Half-length of the end ticks. */
const TICK = 0.04

const [W, H, D] = RACK_SIZE
const RIGHT = W / 2
const FRONT = D / 2
const BOTTOM = RACK_CENTER[1] - H / 2
/** Floor-level lines sit just above the grid so they don't z-fight it. */
const FLOOR = 0.003
const TOP = RACK_CENTER[1] + H / 2

function toGeometry(segments: [Vec3, Vec3][]) {
  const positions = new Float32Array(segments.length * 6)
  segments.forEach(([a, b], i) => positions.set([...a, ...b], i * 6))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geo
}

function useDisposable<T extends { dispose: () => void }>(value: T) {
  useEffect(() => () => value.dispose(), [value])
  return value
}

/** Twelve edges of a box centered at `c`. */
function boxEdges(c: Vec3, [w, h, d]: Vec3): [Vec3, Vec3][] {
  const corner = (sx: number, sy: number, sz: number): Vec3 => [
    c[0] + (sx * w) / 2,
    c[1] + (sy * h) / 2,
    c[2] + (sz * d) / 2,
  ]
  const edges: [Vec3, Vec3][] = []
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      edges.push([corner(-1, s, t), corner(1, s, t)])
      edges.push([corner(s, -1, t), corner(s, 1, t)])
      edges.push([corner(s, t, -1), corner(s, t, 1)])
    }
  }
  return edges
}

/** Labels hide once the camera is further than this from the modelled rack
 *  (scene units ≈ metres), where they'd be too small to read and clutter a
 *  big layout. The single-rack framing sits at ~16. */
const LABEL_MAX_DISTANCE = 28
const _rackCenter = new THREE.Vector3(...RACK_CENTER)

/** Whether the camera is within `distance` of the modelled rack. Only
 *  re-renders when that flips, not every frame. */
function useCameraWithin(distance: number) {
  const [within, setWithin] = useState(true)
  useFrame(({ camera }) => {
    const next = camera.position.distanceTo(_rackCenter) <= distance
    if (next !== within) setWithin(next)
  })
  return within
}

function DimensionLabel({
  position,
  mm,
  visible,
}: {
  position: Vec3
  mm: number
  visible: boolean
}) {
  const inches = (mm / 25.4).toFixed(1)
  return (
    <Html position={position} center zIndexRange={[1, 0]} pointerEvents="none">
      <div
        aria-hidden={!visible}
        className={clsx(
          'transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="bg-default/80 text-mono-xs text-secondary rounded px-1.5 py-0.5 whitespace-nowrap normal-case! select-none">
          {formatCount(mm)} mm <span className="text-quaternary">/ {inches} in</span>
        </div>
      </div>
    </Html>
  )
}

/** Height, width and depth callouts on the modelled rack. Memoised: it has
 *  no props, so a rack-count change in the parent doesn't re-render it. */
const RackDimensions = memo(function RackDimensions() {
  const labelsVisible = useCameraWithin(LABEL_MAX_DISTANCE)
  const geometry = useDisposable(
    useMemo(() => {
      const hx = RIGHT + OFFSET
      const wz = FRONT + OFFSET
      return toGeometry([
        // Height: vertical, off the front-right edge
        [
          [hx, BOTTOM, FRONT],
          [hx, TOP, FRONT],
        ],
        [
          [hx - TICK, BOTTOM, FRONT],
          [hx + TICK, BOTTOM, FRONT],
        ],
        [
          [hx - TICK, TOP, FRONT],
          [hx + TICK, TOP, FRONT],
        ],
        // Width: across the floor in front
        [
          [-RIGHT, FLOOR, wz],
          [RIGHT, FLOOR, wz],
        ],
        [
          [-RIGHT, FLOOR, wz - TICK],
          [-RIGHT, FLOOR, wz + TICK],
        ],
        [
          [RIGHT, FLOOR, wz - TICK],
          [RIGHT, FLOOR, wz + TICK],
        ],
        // Depth: along the floor on the right
        [
          [hx, FLOOR, -FRONT],
          [hx, FLOOR, FRONT],
        ],
        [
          [hx - TICK, FLOOR, -FRONT],
          [hx + TICK, FLOOR, -FRONT],
        ],
        [
          [hx - TICK, FLOOR, FRONT],
          [hx + TICK, FLOOR, FRONT],
        ],
      ])
    }, []),
  )

  return (
    <>
      <lineSegments geometry={geometry} raycast={() => null}>
        <lineBasicMaterial color={LINE_COLOR} />
      </lineSegments>
      <DimensionLabel
        position={[RIGHT + OFFSET, (BOTTOM + TOP) / 2, FRONT]}
        mm={RACK_DIMENSIONS_MM.height}
        visible={labelsVisible}
      />
      <DimensionLabel
        position={[0, FLOOR, FRONT + OFFSET]}
        mm={RACK_DIMENSIONS_MM.width}
        visible={labelsVisible}
      />
      <DimensionLabel
        position={[RIGHT + OFFSET, FLOOR, 0]}
        mm={RACK_DIMENSIONS_MM.depth}
        visible={labelsVisible}
      />
    </>
  )
})

/** Solid fill for the placeholder racks, two steps lighter than the page
 *  background (`--surface-secondary`, neutral-100); rows further back fade a
 *  step closer to it. */
const FILL_NEAR_TOKEN = '--color-neutral-200'
const FILL_FAR_TOKEN = '--color-neutral-100'
/** Rows past this many are fully faded to the far fill. */
const FILL_FADE_ROWS = 6

const _matrix = new THREE.Matrix4()
const _color = new THREE.Color()

/** Every rack after the first: an opaque box per rack (one instanced draw)
 *  so each rack hides the outlines behind it, plus one batch of outlines. */
function AdditionalRacks({ count }: { count: number }) {
  const edges = useDisposable(
    useMemo(() => {
      const segments: [Vec3, Vec3][] = []
      for (let i = 1; i < count; i++) {
        const [x, , z] = getRackPosition(i)
        segments.push(...boxEdges([x, RACK_CENTER[1], z], RACK_SIZE))
      }
      return toGeometry(segments)
    }, [count]),
  )

  const boxes = useDisposable(
    useMemo(() => new THREE.BoxGeometry(RACK_SIZE[0], RACK_SIZE[1], RACK_SIZE[2]), []),
  )
  const fill = useDisposable(
    useMemo(
      () =>
        new THREE.MeshBasicMaterial({
          // Pushed back in depth so the coincident outline edges draw on top.
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      [],
    ),
  )
  const mesh = useDisposable(
    useMemo(() => {
      const near = cssColor(FILL_NEAR_TOKEN)
      const far = cssColor(FILL_FAR_TOKEN)
      const instances = Math.max(1, count - 1)
      const m = new THREE.InstancedMesh(boxes, fill, instances)
      m.count = count - 1
      m.raycast = () => {}
      for (let i = 1; i < count; i++) {
        const [x, , z] = getRackPosition(i)
        _matrix.makeTranslation(x, RACK_CENTER[1], z)
        m.setMatrixAt(i - 1, _matrix)
        const row = Math.floor(i / RACKS_PER_ROW)
        _color.lerpColors(near, far, Math.min(1, row / FILL_FADE_ROWS))
        m.setColorAt(i - 1, _color)
      }
      m.computeBoundingSphere()
      return m
    }, [count, boxes, fill]),
  )

  if (count <= 1) return null
  return (
    <>
      <primitive object={mesh} />
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color={LINE_COLOR} />
      </lineSegments>
    </>
  )
}

export function ConfiguratorOverlay() {
  const racks = useValue(rackCount)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [racks, invalidate])

  return (
    <>
      <RackDimensions />
      <AdditionalRacks count={racks} />
    </>
  )
}
