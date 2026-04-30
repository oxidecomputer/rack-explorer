import { Spinner } from '@oxide/design-system/ui'
import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  activeVideoTour,
  activeVideoTourStepIndex,
  selectedId,
  tourStartScreen,
  videoTourCurrentTime,
  videoTourPlaybackRate,
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
  const playbackRate = useValue(videoTourPlaybackRate)
  const videoRef = useRef<HTMLVideoElement>(null)
  const prevStepRef = useRef(stepIndex)
  const [isLoading, setIsLoading] = useState(true)

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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate])

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
      className="bg-default pointer-events-auto relative overflow-hidden rounded-md"
      style={{ width: 150, height: 150 }}
    >
      <video
        ref={videoRef}
        src={tour.videoUrl}
        className="h-full w-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onPlaying={() => setIsLoading(false)}
        playsInline
      >
        <track kind="captions" src={tour.captionsUrl} srcLang="en" label="English" />
      </video>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            className="bg-default absolute inset-0 flex items-center justify-center"
          >
            <Spinner variant="secondary" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
