import { Compass16Icon, Show16Icon } from '@oxide/design-system/icons/react'
import { motion } from 'motion/react'

import {
  activeTourId,
  activeTourStepIndex,
  landingOpen,
  navigationMode,
  selectedId,
} from '../atoms'
import { guidedTours } from '../data/guidedTours'

function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="8" y="2" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="14" y="2" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="20" y="2" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="8" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="14" y="8" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="20" y="8" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="14" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="8" y="14" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="14" y="14" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="20" y="14" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="20" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="8" y="20" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="14" y="20" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="20" y="20" width="4" height="4" rx="1" fill="currentColor" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="16" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="15" width="20" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="21" width="12" height="3" rx="1" fill="currentColor" />
    </svg>
  )
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-secondary group border-secondary flex items-center gap-4 rounded-md border p-1.5 text-left"
    >
      <div className="bg-accent text-accent flex h-20 w-20 shrink-0 items-center justify-center rounded-sm">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 pr-4">
        <div className="text-sans-md text-default">{title}</div>
        <p className="text-sans-sm text-tertiary">{description}</p>
      </div>
    </button>
  )
}

export function LandingModal() {
  const dismiss = (mode: 'free' | 'guided') => {
    navigationMode.set(mode)
    if (mode === 'guided') {
      activeTourId.set(guidedTours[0].id)
      activeTourStepIndex.set(0)
      const firstStep = guidedTours[0].steps[0]
      if (firstStep?.selectedId) {
        selectedId.set(firstStep.selectedId)
      }
    }
    landingOpen.set(false)
  }

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-default w-full max-w-lg rounded-lg p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="mb-5 text-center">
          <div className="text-mono-sm text-tertiary mb-1">Oxide Rack Explorer</div>
          <h1 className="text-sans-2xl text-raise">What would you like to see?</h1>
        </div>

        <div className="flex flex-col gap-2">
          <OptionCard
            icon={<Show16Icon className="size-6" />}
            title="Explore the hardware"
            description="Take a closer look at Oxide's rack. Explore every sled, switch, and shelf at your own pace."
            onClick={() => dismiss('free')}
          />
          <OptionCard
            icon={<Compass16Icon className="size-6" />}
            title="Guided Tour & Help"
            description="Follow a step-by-step walkthrough. Learn how the system works or get instructions for common tasks."
            onClick={() => dismiss('guided')}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
