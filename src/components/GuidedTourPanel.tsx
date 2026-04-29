import { NextArrow12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { activeTour, activeTourStep, activeTourStepIndex, goToTourStep } from '../atoms'
import type { TourStep } from '../data/guidedTours'

export function GuidedTourPanel() {
  const tour = useValue(activeTour)
  const step = useValue(activeTourStep)
  const stepIndex = useValue(activeTourStepIndex)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset the mobile drawer's scroll position when the step changes — long
  // descriptions otherwise stay scrolled to the previous step's bottom.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [stepIndex])

  const standardStep = step && 'description' in step ? (step as TourStep) : null

  if (!tour || !standardStep) {
    return (
      <div className="text-sans-sm text-tertiary px-1 py-2">
        Select a tour from the sidebar to get started.
      </div>
    )
  }

  const totalSteps = tour.steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  return (
    <div className="flex h-full grow flex-col">
      <div
        ref={scrollRef}
        className="max-1000:overflow-y-auto max-1000:pt-4 h-full grow pb-2"
      >
        <div className="max-1000:hidden text-mono-xs text-quaternary max-1000:pt-3 pb-2 uppercase">
          {tour.title}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            className="flex flex-col gap-1.5 select-text"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="text-sans-md text-default">{standardStep.title}</div>
            <p className="text-sans-sm text-secondary pr-4">{standardStep.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-secondary">
        <div className="border-default -mx-3 mb-3 h-px w-[calc(100%+24px)] border-t" />
        <div className="flex items-center justify-between">
          <div className="text-mono-xs text-raise">
            {stepIndex + 1} <span className="text-quaternary">/ {totalSteps}</span>
          </div>
          <div className="1000:hidden text-mono-xs text-quaternary">{tour.title}</div>
          <div className="max-1000:hidden -m-1 flex gap-1">
            <button
              onClick={() => goToTourStep(stepIndex - 1)}
              disabled={isFirst}
              className="hover:bg-hover disabled:text-quaternary text-secondary flex h-6 w-6 items-center justify-center rounded transition-colors disabled:pointer-events-none"
            >
              <PrevArrow12Icon />
            </button>
            <button
              onClick={() => goToTourStep(stepIndex + 1)}
              disabled={isLast}
              className="hover:bg-hover disabled:text-quaternary text-secondary flex h-6 w-6 items-center justify-center rounded transition-colors disabled:pointer-events-none"
            >
              <NextArrow12Icon />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
