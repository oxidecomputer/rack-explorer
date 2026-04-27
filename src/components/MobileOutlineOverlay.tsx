import { Close12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'

import { mobileOutlineOpen, navigationMode } from '../atoms'
import { ContactSales } from './ContactSales'
import { GuidedTourOutline } from './GuidedTourOutline'
import { Outline } from './Outline'

export function MobileOutlineOverlay() {
  const isOpen = useValue(mobileOutlineOpen)
  const isGuided = useValue(navigationMode) === 'guided'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="1000:hidden pointer-events-auto absolute inset-0 z-40 flex flex-col p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => mobileOutlineOpen.set(false)}
          />
          <motion.div
            className="bg-default relative flex min-h-0 flex-1 flex-col rounded-md"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
          >
            <div className="border-secondary flex items-center justify-between border-b px-4 py-3">
              <div className="text-mono-xs text-secondary">
                {isGuided ? 'Guided tour & help' : 'Explore the hardware'}
              </div>
              <button
                onClick={() => mobileOutlineOpen.set(false)}
                className="target-8 text-tertiary hover:text-default"
              >
                <Close12Icon />
              </button>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto p-3"
              onClick={() => mobileOutlineOpen.set(false)}
            >
              {isGuided ? <GuidedTourOutline /> : <Outline />}
            </div>
            {isGuided && <ContactSales className="border-secondary block border-t p-3" />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
