import { Close12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'

import { mobileOutlineOpen, navigationMode } from '../atoms'
import { ContactSales } from './ContactSales'
import { GuidedTourOutline } from './GuidedTourOutline'
import { Outline } from './Outline'

const overlayTransition = {
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94],
} as const

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
          transition={overlayTransition}
        >
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            onClick={() => mobileOutlineOpen.set(false)}
          />
          <motion.div
            className="bg-default relative flex min-h-0 flex-1 flex-col rounded-md"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={overlayTransition}
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
            {/* Bubble-listener wrapper: any tap on a tree button inside dismisses the
                overlay. Inner buttons handle keyboard + focus, so this div is presentational. */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
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
