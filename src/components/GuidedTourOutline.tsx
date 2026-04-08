import { Compass16Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'

import { activeTourId, activeTourStepIndex, selectedId } from '../atoms'
import { guidedTours, type GuidedTour } from '../data/guidedTours'

function TourStepItem({
  title,
  stepIndex,
  tourId,
}: {
  title: string
  stepIndex: number
  tourId: string
}) {
  const currentTourId = useValue(activeTourId)
  const currentStepIndex = useValue(activeTourStepIndex)
  const isActive = currentTourId === tourId && currentStepIndex === stepIndex

  const handleClick = () => {
    const tour = guidedTours.find((t) => t.id === tourId)
    if (!tour) return
    activeTourId.set(tourId)
    activeTourStepIndex.set(stepIndex)
    const step = tour.steps[stepIndex]
    if (step?.selectedId) {
      selectedId.set(step.selectedId)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'text-sans-sm flex w-full items-center border-l py-1.25 pl-4 text-left transition-colors',
        isActive ? 'border-accent text-accent' : 'border-default text-secondary',
      )}
    >
      {title}
    </button>
  )
}

function TourSection({ tour }: { tour: GuidedTour }) {
  const currentTourId = useValue(activeTourId)
  const isExpanded = currentTourId === tour.id

  const handleClick = () => {
    if (isExpanded) {
      activeTourId.set(null)
      activeTourStepIndex.set(0)
    } else {
      activeTourId.set(tour.id)
      activeTourStepIndex.set(0)
      const firstStep = tour.steps[0]
      if (firstStep?.selectedId) {
        selectedId.set(firstStep.selectedId)
      }
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          'text-sans-sm group relative flex w-full items-center gap-2 rounded px-2 py-1.25 text-left',
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 rounded opacity-0 transition-opacity',
            isExpanded && 'bg-accent-inverse opacity-11',
          )}
        />
        <Compass16Icon
          className={clsx(
            'relative shrink-0',
            isExpanded ? 'text-accent' : 'text-tertiary',
          )}
        />
        <span className={clsx('relative', isExpanded ? 'text-accent' : 'text-secondary')}>
          {tour.title}
        </span>
      </button>
      {isExpanded && (
        <div className="ml-4 flex flex-col py-2">
          {tour.steps.map((step, i) => (
            <TourStepItem key={i} title={step.title} stepIndex={i} tourId={tour.id} />
          ))}
        </div>
      )}
    </div>
  )
}

export function GuidedTourOutline() {
  return (
    <div className="flex flex-col gap-0.5">
      {guidedTours.map((tour) => (
        <TourSection key={tour.id} tour={tour} />
      ))}
    </div>
  )
}
