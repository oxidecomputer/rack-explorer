import { useValue } from '@tldraw/state-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

import {
  activeVideoTour,
  activeVideoTourStepIndex,
  selectedId,
  tourStartScreen,
  videoTourCurrentTime,
  videoTourPlaying,
} from '../atoms'

export function VideoTourPlayer({
  onTimeUpdate,
}: {
  onTimeUpdate?: (time: number) => void
}) {
  const tour = useValue(activeVideoTour)
  const isPlaying = useValue(videoTourPlaying)
  const isStartScreen = useValue(tourStartScreen)
  const stepIndex = useValue(activeVideoTourStepIndex)
  const videoRef = useRef<HTMLVideoElement>(null)
  const prevStepRef = useRef(stepIndex)

  // Sync play/pause state to video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => {
        // Autoplay may be blocked
        videoTourPlaying.set(false)
      })
    } else {
      video.pause()
    }
  }, [isPlaying])

  // When video tour step changes, update selectedId for 3D scene navigation
  useEffect(() => {
    if (prevStepRef.current !== stepIndex && tour) {
      const step = tour.steps[stepIndex]
      if (step?.selectedId) {
        selectedId.set(step.selectedId)
      }
      prevStepRef.current = stepIndex
    }
  }, [stepIndex, tour])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    videoTourCurrentTime.set(video.currentTime)
    onTimeUpdate?.(video.currentTime)
  }, [onTimeUpdate])

  const handleEnded = useCallback(() => {
    videoTourPlaying.set(false)
  }, [])

  if (!tour || isStartScreen) return null

  return (
    <motion.div
      data-video-tour-player
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
      className="bg-default pointer-events-auto overflow-hidden rounded-md"
      style={{ width: 150, height: 150 }}
    >
      <video
        ref={videoRef}
        src={tour.videoUrl}
        className="h-full w-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        playsInline
      />
    </motion.div>
  )
}
