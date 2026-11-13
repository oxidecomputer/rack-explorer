/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Close12Icon, Warning12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { detectedTier, kioskMode, sceneReady, softwareRenderingDetected } from '../atoms'

/** Dismissible warning when the GPU looks too slow for a smooth experience. */
export function PerformanceNotice() {
  const isSoftware = useValue(softwareRenderingDetected)
  const tier = useValue(detectedTier)
  const isSceneReady = useValue(sceneReady)
  const isKiosk = useValue(kioskMode)
  const [dismissed, setDismissed] = useState(false)

  const message = isSoftware
    ? "Your browser doesn't appear to be using hardware acceleration. Try enabling it in your settings, or switching to a more recent browser."
    : tier !== null && tier <= 1
      ? 'A lower performance GPU was detected. For the smoothest experience, try with another computer or mobile device.'
      : null

  const visible = !!message && isSceneReady && !dismissed && !isKiosk

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          className="bg-notice text-notice pointer-events-auto absolute top-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 items-start gap-2 rounded-md p-3"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
        >
          <Warning12Icon className="text-notice-tertiary mt-px shrink-0" />
          <p className="text-sans-sm grow">{message}</p>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-notice-tertiary hover:text-notice target-4 shrink-0 transition-colors"
          >
            <Close12Icon />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
