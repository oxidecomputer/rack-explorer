import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'

import {
  advanceFreeTutorial,
  dismissFreeTutorial,
  FREE_TUTORIAL_STEP_COUNT,
  freeTutorialStepIndex,
  landingOpen,
  navigationMode,
  selectedId,
} from '../atoms'

const STEPS: {
  body: string
  position: string
}[] = [
  {
    body: 'The rack outliner. Click any item to focus on it. Use the Arrow Keys to step through siblings, Enter to drill down or Esc to go back up.',
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

// Step 1 announces itself with a spring entrance and a bouncy wiggle; later
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
const WIGGLE = {
  initial: { rotate: -6 },
  animate: { rotate: 0 },
  transition: { type: 'spring' as const, duration: 1.25, bounce: 0.75 },
}
const EXIT = { opacity: 0, y: 4, transition: { duration: 0.2, ease: EASE_OUT_QUAD } }

export function FreeTutorial() {
  const stepIndex = useValue(freeTutorialStepIndex)
  const mode = useValue(navigationMode)
  const isLandingOpen = useValue(landingOpen)

  const visible = stepIndex !== null && mode === 'free' && !isLandingOpen
  const step = stepIndex !== null ? STEPS[stepIndex] : null
  const isLast = stepIndex === FREE_TUTORIAL_STEP_COUNT - 1
  const isFirst = stepIndex === 0

  // Step 3 talks about contextual specifications, which the rack frame itself
  // doesn't surface in a useful way — drill into a compute sled so the panel
  // has something to show.
  useEffect(() => {
    if (stepIndex !== 2) return
    if (selectedId.get().split(':')[0] !== 'oxide-rack') return
    selectedId.set('compute-sled:16')
  }, [stepIndex])

  const entrance = isFirst ? FIRST_ENTRANCE : STANDARD_ENTRANCE

  return (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          key={stepIndex}
          className={`pointer-events-auto absolute z-30 ${step.position}`}
          {...entrance}
          exit={EXIT}
        >
          <motion.div
            className="bg-default relative w-64 rounded-md p-2"
            {...(isFirst && WIGGLE)}
          >
            <div className="text-sans-sm text-default p-1 pr-1.5">{step.body}</div>
            <div className="border-secondary -mx-2 mt-2.5 mb-2 h-px border-t" />
            <div className="flex items-center justify-between gap-4 px-0.5">
              <div className="text-mono-xs text-raise grow">
                {(stepIndex ?? 0) + 1}{' '}
                <span className="text-quaternary">/ {FREE_TUTORIAL_STEP_COUNT}</span>
              </div>
              <button
                onClick={dismissFreeTutorial}
                className="target-2 text-mono-xs text-tertiary hover:text-default transition-colors"
              >
                Skip
              </button>
              <button
                onClick={advanceFreeTutorial}
                className="target-2 text-mono-xs text-default hover:text-raise transition-colors"
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
