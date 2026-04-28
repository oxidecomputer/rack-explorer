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

export function FreeTutorial() {
  const stepIndex = useValue(freeTutorialStepIndex)
  const mode = useValue(navigationMode)
  const isLandingOpen = useValue(landingOpen)

  const visible = stepIndex !== null && mode === 'free' && !isLandingOpen
  const step = stepIndex !== null ? STEPS[stepIndex] : null
  const isLast = stepIndex === FREE_TUTORIAL_STEP_COUNT - 1

  // Step 3 talks about contextual specifications, which the rack frame itself
  // doesn't surface in a useful way — drill into a compute sled so the panel
  // has something to show.
  useEffect(() => {
    if (stepIndex !== 2) return
    if (selectedId.get().split(':')[0] !== 'oxide-rack') return
    selectedId.set('compute-sled:16')
  }, [stepIndex])

  return (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          key={stepIndex}
          className={`pointer-events-auto absolute z-30 ${step.position}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="bg-default w-64 rounded-md p-2">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
