/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { useEffect } from 'react'

import {
  activeTour,
  activeTourStepIndex,
  goToTourStep,
  idleTourActive,
  kioskMode,
  startIdleTour,
  videoTourPlaying,
} from './atoms'

/** No input for this long starts the idle tour. */
const IDLE_TIMEOUT_MS = 30_000

/** How long the idle tour dwells on each step. */
const IDLE_TOUR_STEP_MS = 12_000

/** Reload on the next idle after this much uptime, so a device left running all
 *  day starts fresh (and picks up any deploy) instead of accumulating GPU memory. */
const RELOAD_AFTER_MS = 4 * 60 * 60 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const

export function useKiosk() {
  const isKiosk = useValue(kioskMode)
  const isIdleTour = useValue(idleTourActive)

  // Reflect kiosk mode on <html> for the touch/selection CSS in index.css.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-kiosk', isKiosk)
  }, [isKiosk])

  // Idle detection
  useEffect(() => {
    if (!isKiosk) return
    let lastActivity = performance.now()
    const onActivity = () => {
      lastActivity = performance.now()
    }
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { capture: true, passive: true })
    }
    const interval = window.setInterval(() => {
      // Someone watching a video tour isn't touching anything, but isn't idle.
      if (idleTourActive.get() || videoTourPlaying.get()) {
        lastActivity = performance.now()
        return
      }
      if (performance.now() - lastActivity < IDLE_TIMEOUT_MS) return
      if (performance.now() > RELOAD_AFTER_MS) {
        window.location.reload()
        return
      }
      startIdleTour()
    }, 1_000)
    return () => {
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true })
      }
      window.clearInterval(interval)
    }
  }, [isKiosk])

  // Idle tour loop: step through the tour startIdleTour started, wrapping
  // back to the first step rather than moving on to the next tour.
  useEffect(() => {
    if (!isIdleTour) return
    const interval = window.setInterval(() => {
      const stepCount = activeTour.get()?.steps.length ?? 0
      if (stepCount === 0) return
      goToTourStep((activeTourStepIndex.get() + 1) % stepCount)
    }, IDLE_TOUR_STEP_MS)
    return () => window.clearInterval(interval)
  }, [isIdleTour])

  // iOS Safari ignores `user-scalable=no`; cancelling its proprietary gesture
  // events is what stops a pinch on the UI from zooming the whole page.
  useEffect(() => {
    if (!isKiosk) return
    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', prevent)
    return () => document.removeEventListener('gesturestart', prevent)
  }, [isKiosk])
}
