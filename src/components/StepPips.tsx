import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { LayoutGroup, motion } from 'motion/react'

import { activeTour, activeTourStepIndex, goToTourStep } from '../atoms'

export function StepPips() {
  const tour = useValue(activeTour)
  const stepIndex = useValue(activeTourStepIndex)

  if (!tour) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1"
    >
      <LayoutGroup>
        {tour.steps.map((step, i) => {
          const isActive = i === stepIndex
          return (
            <motion.button
              key={i}
              layout
              data-step={i}
              onClick={() => goToTourStep(i)}
              className="target-2"
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <div
                className={clsx(
                  'flex h-8 items-center justify-center overflow-hidden rounded-md bg-neutral-800/20 text-center backdrop-blur-sm hover:bg-neutral-800/30',
                  isActive ? 'bg-neutral-800/30' : '',
                )}
              >
                {isActive ? (
                  <motion.span
                    className="text-sans-sm text-default block px-3 text-nowrap"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: 0.1 }}
                  >
                    {step.title}
                  </motion.span>
                ) : (
                  <span className="block h-8 w-2" />
                )}
              </div>
            </motion.button>
          )
        })}
      </LayoutGroup>
    </motion.div>
  )
}
