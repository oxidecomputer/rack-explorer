import { DirectionRightIcon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'

import {
  activeVideoTour,
  activeVideoTourStepIndex,
  cycleVideoTourPlaybackRate,
  videoTourCurrentTime,
  videoTourPlaybackRate,
  videoTourPlaying,
} from '../atoms'
import type { VideoTour } from '../data/guidedTours'
import { Pause12Icon } from './Icons'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Returns the end time for a step (start of next step, or tour duration) */
function getStepEnd(tour: VideoTour, stepIndex: number): number {
  if (stepIndex < tour.steps.length - 1) {
    return tour.steps[stepIndex + 1].timestamp
  }
  return tour.duration
}

function ProgressFill({ duration }: { duration: number }) {
  const currentTime = useValue(videoTourCurrentTime)
  const progress = duration > 0 ? currentTime / duration : 0
  return (
    <div
      className="absolute top-0 left-0 h-full rounded-sm bg-green-600"
      style={{ width: `${Math.min(progress * 100, 100)}%` }}
    />
  )
}

function TimelineButton({
  onClick,
  ariaLabel,
  className,
  children,
}: {
  onClick: () => void
  ariaLabel?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        'text-secondary hover:text-default flex h-7 items-center justify-center rounded border border-neutral-800/10 transition-colors hover:bg-neutral-800/30',
        className,
      )}
    >
      {children}
    </button>
  )
}

function TimeDisplay({ duration }: { duration: number }) {
  const currentTime = useValue(videoTourCurrentTime)
  return (
    <div className="text-mono-xs text-secondary pr-3 text-nowrap">
      {formatTime(currentTime)}{' '}
      <span className="text-quaternary">/ {formatTime(duration)}</span>
    </div>
  )
}

export function VideoTourTimeline({ onSeek }: { onSeek: (time: number) => void }) {
  const tour = useValue(activeVideoTour)
  const isPlaying = useValue(videoTourPlaying)
  const currentStepIndex = useValue(activeVideoTourStepIndex)
  const currentTime = useValue(videoTourCurrentTime)
  const playbackRate = useValue(videoTourPlaybackRate)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!tour || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      onSeek(fraction * tour.duration)
    },
    [tour, onSeek],
  )

  const handleTrackHover = useCallback(
    (e: React.MouseEvent) => {
      if (!tour || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const time = fraction * tour.duration
      setHoverX(e.clientX - rect.left)
      // Find which step this time falls in
      let stepIdx = 0
      for (let i = tour.steps.length - 1; i >= 0; i--) {
        if (time >= tour.steps[i].timestamp) {
          stepIdx = i
          break
        }
      }
      setHoveredStep(stepIdx)
    },
    [tour],
  )

  const handleTrackKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (!tour) return
      const current = videoTourCurrentTime.get()
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onSeek(Math.min(tour.duration, current + 5))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onSeek(Math.max(0, current - 5))
      } else if (e.key === 'Home') {
        e.preventDefault()
        onSeek(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onSeek(tour.duration)
      }
    },
    [tour, onSeek],
  )

  if (!tour) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col gap-2"
    >
      {/* Timeline track */}
      <div className="relative">
        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredStep !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.1 }}
              className="1000:block pointer-events-none absolute -top-10 z-10 hidden -translate-x-1/2 rounded bg-neutral-300 px-2.5 py-1"
              style={{ left: hoverX }}
            >
              <span className="text-sans-sm text-default text-nowrap">
                <span className="text-secondary">{tour.steps[hoveredStep].title}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Track background with step segments */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek video tour"
          aria-valuemin={0}
          aria-valuemax={tour.duration}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="group 800:h-2 focus-visible:outline-accent-secondary relative flex h-3 cursor-pointer items-center rounded-sm focus-visible:outline focus-visible:outline-offset-2"
          onClick={handleTrackClick}
          onKeyDown={handleTrackKey}
          onMouseMove={handleTrackHover}
          onMouseLeave={() => setHoveredStep(null)}
        >
          {/* Step segments */}
          {tour.steps.map((step, i) => {
            const start = step.timestamp / tour.duration
            const end = getStepEnd(tour, i) / tour.duration
            const isActive = i === currentStepIndex
            return (
              <div
                key={i}
                className="absolute top-0 h-full"
                style={{
                  left: `${start * 100}%`,
                  width: `${(end - start) * 100}%`,
                }}
              >
                <div
                  className={clsx(
                    'h-full rounded-sm transition-colors',
                    isActive ? 'bg-neutral-400' : 'bg-neutral-300',
                  )}
                />
              </div>
            )
          })}

          {/* Progress fill overlay */}
          <ProgressFill duration={tour.duration} />

          {/* Gap dividers on top of everything */}
          {tour.steps.slice(1).map((step, i) => (
            <div
              key={i}
              className="bg-default/80 absolute top-0 z-10 h-full"
              style={{
                left: `${(step.timestamp / tour.duration) * 100}%`,
                width: 2,
                transform: 'translateX(-1px)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1.5">
        <TimelineButton onClick={() => videoTourPlaying.set(!isPlaying)} className="w-8">
          {isPlaying ? (
            <Pause12Icon className="size-4" />
          ) : (
            <DirectionRightIcon className="size-4" />
          )}
        </TimelineButton>

        <TimelineButton
          onClick={cycleVideoTourPlaybackRate}
          ariaLabel={`Playback speed: ${playbackRate}×. Click to change.`}
          className="text-mono-xs px-2"
        >
          {playbackRate}×
        </TimelineButton>

        <TimeDisplay duration={tour.duration} />

        <div className="text-sans-sm text-default ml-auto truncate">
          {tour.steps[currentStepIndex]?.title}
        </div>
      </div>
    </motion.div>
  )
}
