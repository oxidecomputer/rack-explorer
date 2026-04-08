import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { LayoutGroup, motion } from 'motion/react'

import { activeTour, activeTourStepIndex, selectedId } from '../atoms'

export function StepPips() {
  const tour = useValue(activeTour)
  const stepIndex = useValue(activeTourStepIndex)

  if (!tour) return null

  const goTo = (index: number) => {
    activeTourStepIndex.set(index)
    const step = tour.steps[index]
    if (step?.selectedId) {
      selectedId.set(step.selectedId)
    }
  }

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
              onClick={() => goTo(i)}
              className={clsx(
                'h-8 overflow-hidden rounded-md bg-neutral-800/20 text-center backdrop-blur-sm hover:bg-neutral-800/30',
                isActive ? 'bg-neutral-800/30' : '',
              )}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
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
            </motion.button>
          )
        })}
      </LayoutGroup>
    </motion.div>
  )
}
