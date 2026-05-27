/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Warning12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import { motion } from 'motion/react'

import {
  detectedTier,
  landingOpen,
  maybeStartFreeTutorial,
  softwareRenderingDetected,
  startTour,
} from '../atoms'
import { getFirstStandardTour } from '../data/guidedTours'
import { ExplorerIcon, GuidedTourIcon } from './Icons'

function OptionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-secondary group border-secondary flex items-center gap-4 rounded-md border p-1.5 text-left"
    >
      <div className="bg-accent text-accent flex h-20 w-20 shrink-0 items-center justify-center rounded-sm">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 pr-4">
        <div className="text-sans-md text-default">{title}</div>
        <p className="text-sans-sm text-tertiary">{description}</p>
      </div>
    </button>
  )
}

function PerformanceNotice() {
  const isSoftware = useValue(softwareRenderingDetected)
  const tier = useValue(detectedTier)

  const message = isSoftware
    ? "Your browser doesn't appear to be using hardware acceleration. Try enabling it in your settings, or switching to a more recent browser."
    : tier !== null && tier <= 1
      ? 'A lower performance GPU was detected. For the smoothest experience, try with another computer or mobile device.'
      : null

  if (!message) return null

  return (
    <div className="bg-notice text-notice mt-4 flex items-start gap-2 rounded-md p-3">
      <Warning12Icon className="text-notice-tertiary mt-px shrink-0" />
      <p className="text-sans-sm pr-6">{message}</p>
    </div>
  )
}

export function LandingModal() {
  const dismiss = (mode: 'free' | 'guided') => {
    if (mode === 'guided') {
      const first = getFirstStandardTour()
      startTour(first.id)
    } else {
      // Wait for the modal exit animation before showing coachmarks.
      setTimeout(maybeStartFreeTutorial, 400)
    }
    landingOpen.set(false)
  }

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.24 } }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-default w-full max-w-lg rounded-lg p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{
          opacity: 0,
          y: 8,
          transition: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
        }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="mb-5 text-center">
          <div className="text-mono-sm text-tertiary mb-1">Oxide 3D Explorer</div>
          <h2 className="text-sans-2xl text-raise">What would you like to see?</h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="max-1000:hidden">
            <OptionCard
              icon={<ExplorerIcon />}
              title="Explore the hardware"
              description="Take a closer look at Oxide's cloud computer. Explore every sled, switch, and shelf at your own pace."
              onClick={() => dismiss('free')}
            />
          </div>
          <OptionCard
            icon={<GuidedTourIcon />}
            title="Guided Tour & Help"
            description="Follow a step-by-step walkthrough. Learn how the system works or get instructions for common tasks."
            onClick={() => dismiss('guided')}
          />
        </div>

        <PerformanceNotice />
      </motion.div>
    </motion.div>
  )
}
