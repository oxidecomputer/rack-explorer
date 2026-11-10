/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { FrameRateMonitor, type FrameRateSample } from './frameRateMonitor'

/**
 * Feeds FrameRateMonitor with real frame intervals only. After every tick of
 * R3F's loop we record whether another frame is already queued
 * (`frameloop="always"`, or `internal.frames > 0` in demand mode). Only when
 * it was does the gap to the next rendered frame measure rendering speed;
 * otherwise the next frame starts a new burst after idle time, and that gap
 * is skipped.
 */
export function AdaptivePerformanceMonitor({
  onSample,
  resetKey,
}: {
  onSample: (sample: FrameRateSample) => void
  /** Changing this discards in-progress samples (e.g. on tier change). */
  resetKey?: unknown
}) {
  const get = useThree((s) => s.get)
  const [monitor] = useState(() => new FrameRateMonitor())
  const onSampleRef = useRef(onSample)
  useLayoutEffect(() => {
    onSampleRef.current = onSample
  })

  const lastFrameAt = useRef<number | null>(null)
  const nextFrameQueued = useRef(false)

  useEffect(() => {
    monitor.reset()
  }, [monitor, resetKey])

  useEffect(
    () =>
      addAfterEffect(() => {
        const state = get()
        nextFrameQueued.current = state.frameloop === 'always' || state.internal.frames > 0
      }),
    [get],
  )

  useFrame(() => {
    const now = performance.now()
    if (nextFrameQueued.current && lastFrameAt.current !== null) {
      const sample = monitor.addInterval(now - lastFrameAt.current)
      if (sample) onSampleRef.current(sample)
    }
    lastFrameAt.current = now
    nextFrameQueued.current = false
  })

  return null
}
