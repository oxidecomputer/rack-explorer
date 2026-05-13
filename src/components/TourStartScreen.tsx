import { Compass16Icon } from '@oxide/design-system/icons/react'
import { Button } from '@oxide/design-system/ui'
import { useValue } from '@tldraw/state-react'
import { motion } from 'motion/react'

import {
  activeTour,
  cycledFromPreviousTour,
  mobileOutlineOpen,
  tourStartScreen,
  videoTourPlaying,
} from '../atoms'
import { ContactSales } from './ContactSales'
import { Video16Icon } from './Icons'

export function TourStartScreen() {
  const tour = useValue(activeTour)
  const isStartScreen = useValue(tourStartScreen)
  const cycled = useValue(cycledFromPreviousTour)

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
      className="absolute top-1/2 left-1/2 flex w-full max-w-120 -translate-1/2 flex-col gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: 8,
        transition: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="bg-default pointer-events-auto rounded-lg p-6 px-8">
        <div className="mb-2">
          <div className="text-mono-sm text-tertiary mb-1">
            {isVideo ? 'Video Tour' : 'Guided Tour'}
          </div>
          <h2 className="text-sans-2xl text-raise">{tour.title}</h2>
        </div>

        <p className="text-sans-md text-tertiary pr-6">{tour.description}</p>

        {tour.author && (
          <div className="mt-4 flex items-center gap-2">
            <img
              src={`/images/${tour.author.portrait}`}
              alt={tour.author.name}
              className="border-secondary h-8 w-8 rounded-full border object-cover"
            />
            <div className="text-sans-sm">
              <div className="text-secondary">{tour.author.name}</div>
              <div className="text-quaternary">{tour.author.title}</div>
            </div>
          </div>
        )}

        <Button onClick={handleStart} className="mt-6 w-full" size="sm">
          <div className="flex w-full items-center justify-center gap-2">
            {isVideo ? <Video16Icon /> : <Compass16Icon />}
            {isVideo ? 'Play video tour' : 'Start tour'}
          </div>
        </Button>

        <Button
          onClick={() => mobileOutlineOpen.set(true)}
          className="1000:hidden mt-2 w-full"
          variant="secondary"
          size="sm"
        >
          <div className="flex w-full items-center justify-center gap-2">
            View other tours
          </div>
        </Button>

        {cycled && (
          <ContactSales className="hover:bg-hover/80 bg-default border-secondary mt-4 block w-full rounded-md border p-2.5 transition-colors" />
        )}
      </div>
    </motion.div>
  )
}
