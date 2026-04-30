import { Compass16Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'

import {
  activeTourId,
  activeTourStepIndex,
  activeVideoTourStepIndex,
  seekVideo,
  selectedId,
  startTour,
  tourStartScreen,
} from '../atoms'
import { guidedTours, type GuidedTour, type VideoTour } from '../data/guidedTours'
import { Video16Icon } from './Icons'

function StepItem({
  title,
  isActive,
  onClick,
}: {
  title: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'text-sans-sm flex w-full items-center border-l py-1.25 pl-4 text-left transition-colors',
        isActive ? 'border-accent text-accent' : 'border-default text-secondary',
      )}
    >
      {title}
    </button>
  )
}

function StandardTourStepItems({ tourId }: { tourId: string }) {
  const currentTourId = useValue(activeTourId)
  const currentStepIndex = useValue(activeTourStepIndex)
  const tour = guidedTours.find((t) => t.id === tourId)
  if (!tour || tour.type === 'video') return null

  return tour.steps.map((step, i) => (
    <StepItem
      key={i}
      title={step.title}
      isActive={currentTourId === tourId && currentStepIndex === i}
      onClick={() => {
        activeTourId.set(tourId)
        activeTourStepIndex.set(i)
        if (step.selectedId) selectedId.set(step.selectedId)
      }}
    />
  ))
}

function VideoTourStepItems({ tour }: { tour: VideoTour }) {
  const currentTourId = useValue(activeTourId)
  const currentStepIndex = useValue(activeVideoTourStepIndex)

  return tour.steps.map((step, i) => (
    <StepItem
      key={i}
      title={step.title}
      isActive={currentTourId === tour.id && currentStepIndex === i}
      onClick={() => {
        seekVideo(step.timestamp)
        if (step.selectedId) selectedId.set(step.selectedId)
      }}
    />
  ))
}

function TourSection({ tour }: { tour: GuidedTour }) {
  const currentTourId = useValue(activeTourId)
  const isStartScreen = useValue(tourStartScreen)
  const isExpanded = currentTourId === tour.id

  const handleClick = () => {
    if (isExpanded) return
    startTour(tour.id)
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
            isExpanded
              ? 'bg-accent-inverse group-hover:opacity-20'
              : 'bg-neutral-700 group-hover:opacity-11',
          )}
        />
        <span className={clsx('relative', isExpanded ? 'text-accent' : 'text-secondary')}>
          <span className="flex items-start gap-1.5">
            <span className={isExpanded ? 'text-accent-secondary' : 'text-tertiary'}>
              {tour.type === 'video' ? <Video16Icon /> : <Compass16Icon />}
            </span>
            {tour.title}
          </span>
        </span>
      </button>
      {isExpanded && !isStartScreen && (
        <div className="ml-4 flex flex-col py-2">
          {tour.type === 'video' ? (
            <VideoTourStepItems tour={tour} />
          ) : (
            <StandardTourStepItems tourId={tour.id} />
          )}
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
