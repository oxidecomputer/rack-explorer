/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import {
  advanceFreeTutorial,
  dismissFreeTutorial,
  FREE_TUTORIAL_STEP_COUNT,
  freeTutorialStepIndex,
  landingOpen,
  navigationMode,
} from '../atoms'

const STEPS: {
  body: string
  position: string
}[] = [
  {
    body: 'The rack tree of components. Click any item to focus on it. Use Arrow Up and Down to step through adjacent items, Enter to drill down or Esc to go back up.',
    position: 'left-72 top-20',
  },
  {
    body: 'Drag to orbit, scroll to zoom and click components to select them. Double-click the background to zoom back out.',
    position: 'bottom-4 left-1/2 -translate-x-1/2',
  },
  {
    body: 'Where available, selecting a component shows contextual specifications.',
    position: 'right-72 top-20',
  },
]

const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const

// Step 1 announces itself with a spring entrance and a periodic shake; later
// steps fade in quietly since the user already knows where to look.
const FIRST_ENTRANCE = {
  initial: { opacity: 0, y: 12, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring' as const, duration: 0.55, bounce: 0.28 },
}
const STANDARD_ENTRANCE = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: EASE_OUT_QUAD },
}
const EXIT = { opacity: 0, y: 4, transition: { duration: 0.2, ease: EASE_OUT_QUAD } }

export function FreeTutorial() {
  const stepIndex = useValue(freeTutorialStepIndex)
  const mode = useValue(navigationMode)
  const isLandingOpen = useValue(landingOpen)
  const [isDirty, setIsDirty] = useState(false)

  const visible = stepIndex !== null && mode === 'free' && !isLandingOpen
  const step = stepIndex !== null ? STEPS[stepIndex] : null
  const isLast = stepIndex === FREE_TUTORIAL_STEP_COUNT - 1
  const isFirst = stepIndex === 0

  const shakeControls = useAnimationControls()
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isFirst || isDirty || !visible) return

    const shake = () => {
      shakeControls.start({
        x: [0, -4, 4, -3, 3, -1, 1, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      })
    }

    const scheduleShake = () => {
      shakeTimerRef.current = setTimeout(() => {
        shake()
        scheduleShake()
      }, 4000)
    }

    scheduleShake()

    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
    }
  }, [isFirst, visible, shakeControls, isDirty])

  const entrance = isFirst ? FIRST_ENTRANCE : STANDARD_ENTRANCE

  return (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          key={stepIndex}
          className={`pointer-events-auto absolute z-30 ${step.position}`}
          {...entrance}
          exit={EXIT}
          onPointerOver={() => {
            if (isFirst && !isDirty) setIsDirty(true)
          }}
        >
          <motion.div
            className="bg-accent relative w-64 rounded-md border border-current/5 p-2"
            animate={isFirst ? shakeControls : undefined}
          >
            <div className="text-sans-sm text-accent-secondary p-1 pr-1.5">{step.body}</div>
            <div className="border-accent-quaternary -mx-2 mt-2.5 mb-2 h-px border-t" />
            <div className="flex items-center justify-between gap-4 px-0.5">
              <div className="text-mono-xs text-accent grow">
                {(stepIndex ?? 0) + 1}{' '}
                <span className="text-accent-tertiary">/ {FREE_TUTORIAL_STEP_COUNT}</span>
              </div>
              <button
                onClick={dismissFreeTutorial}
                className="target-2 text-mono-xs text-accent-tertiary hover:text-accent-secondary transition-colors"
              >
                Skip
              </button>
              <button
                onClick={advanceFreeTutorial}
                className="target-2 text-mono-xs text-accent hover:text-accent-secondary transition-colors"
              >
                {isLast ? 'Got it' : 'Next'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
