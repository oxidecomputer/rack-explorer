import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'

import { activeVideoTour, tourStartScreen, videoTourCurrentTime } from '../atoms'
import { getCaptionAtTime } from '../data/guidedTours'

export function VideoCaptions() {
  const tour = useValue(activeVideoTour)
  const time = useValue(videoTourCurrentTime)
  const isStartScreen = useValue(tourStartScreen)

  if (!tour?.captions?.length || isStartScreen) return null
  const text = getCaptionAtTime(tour, time)

  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
          className="pointer-events-none flex justify-center"
        >
          <div className="bg-default/85 text-sans-lg text-default rounded-md px-3 py-1.5 text-center backdrop-blur-md">
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
