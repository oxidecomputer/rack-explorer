import { Compass16Icon } from '@oxide/design-system/icons/react'
import { Button } from '@oxide/design-system/ui'
import { useValue } from '@tldraw/state-react'
import { motion } from 'motion/react'

import { activeTour, tourStartScreen, videoTourPlaying } from '../atoms'
import { Video16Icon } from './Icons'

export function TourStartScreen() {
  const tour = useValue(activeTour)
  const isStartScreen = useValue(tourStartScreen)

  if (!tour || !isStartScreen) return null

  const isVideo = tour.type === 'video'

  const handleStart = () => {
    tourStartScreen.set(false)
    if (isVideo) {
      videoTourPlaying.set(true)
    }
  }

  return (
    <motion.div
      className="bg-default pointer-events-auto absolute top-1/2 left-1/2 w-full max-w-110 -translate-1/2 rounded-lg p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="mb-2">
        <div className="text-mono-sm text-tertiary mb-1">
          {isVideo ? 'Video Tour' : 'Guided Tour'}
        </div>
        <h1 className="text-sans-2xl text-raise">{tour.title}</h1>
      </div>

      <p className="text-sans-md text-tertiary pr-6">{tour.description}</p>

      <Button onClick={handleStart} className="mt-6 w-full">
        <div className="flex w-full items-center justify-center gap-2">
          {isVideo ? <Video16Icon /> : <Compass16Icon />}
          {isVideo ? 'Play video tour' : 'Start tour'}
        </div>
      </Button>
    </motion.div>
  )
}
