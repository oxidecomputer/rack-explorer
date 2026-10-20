/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'

import { idleTourActive, stopIdleTour } from '../atoms'

/** Invisible full-screen catcher for the kiosk idle tour. Swallows the first
 *  touch so it only hands the tour over, rather than also pressing whichever
 *  tour control was under the finger. Stays mounted through a brief exit so the
 *  matching pointerup/click land here too, not on the UI underneath. */
export function IdleTourOverlay() {
  const isIdleTour = useValue(idleTourActive)

  return (
    <AnimatePresence>
      {isIdleTour && (
        <motion.div
          className="pointer-events-auto absolute inset-0 z-50"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onPointerDown={() => {
            if (idleTourActive.get()) stopIdleTour()
          }}
        />
      )}
    </AnimatePresence>
  )
}
