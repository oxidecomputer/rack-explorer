import { PrevArrow12Icon } from '@oxide/design-system/icons/react'
import type { Atom } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import {
  debugMode,
  landingOpen,
  navigationMode,
  postProcessingSetting,
  qualitySetting,
  resolutionSetting,
  showcaseMode,
  type QualityLevel,
} from '../atoms'

function ToggleIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
        checked ? 'bg-accent-secondary' : 'bg-tertiary'
      }`}
    >
      <motion.span
        className="bg-raise absolute top-0.5 left-0.5 block h-3 w-3 rounded-full"
        initial={false}
        animate={{ x: checked ? 12 : 0 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
      />
    </span>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="hover:bg-hover flex w-full cursor-pointer items-center justify-between rounded px-3 py-2"
    >
      <span className="text-secondary">{label}</span>
      <ToggleIndicator checked={checked} />
    </button>
  )
}

const LEVEL_OPTIONS: QualityLevel[] = ['auto', 'high', 'low']
const LEVEL_LABELS: Record<QualityLevel, string> = {
  auto: 'Auto',
  high: 'High',
  low: 'Low',
}

function Segmented<T extends string>({
  label,
  atom,
  options,
  labels,
}: {
  label: string
  atom: Atom<T>
  options: readonly T[]
  labels: Record<T, string>
}) {
  const value = useValue(atom)
  return (
    <div className="flex items-center justify-between rounded px-3 py-2">
      <span className="text-secondary">{label}</span>
      <div className="bg-tertiary flex rounded-sm p-px">
        {options.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              onClick={() => atom.set(option)}
              className={clsx(
                'text-mono-xs rounded-sm px-1.5 py-0.5 transition-colors',
                selected ? 'bg-raise text-default' : 'text-quaternary hover:text-secondary',
              )}
            >
              {labels[option]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OptionsDropdown() {
  const [openState, setOpen] = useState(false)
  const isShowcaseMode = useValue(showcaseMode)
  const isDebugMode = useValue(debugMode)
  const currentNavigationMode = useValue(navigationMode)
  const isGuided = currentNavigationMode === 'guided'
  const isLandingOpen = useValue(landingOpen)
  // While landing modal is open, the dropdown is force-hidden.
  const open = openState && !isLandingOpen

  return (
    <div className="max-1000:hidden relative z-40 w-full">
      <button
        onClick={() => setOpen(!open)}
        disabled={isLandingOpen}
        className="text-mono-xs text-secondary bg-default hover:bg-hover border-neutral-0 flex h-8 w-full items-center gap-1.5 rounded border p-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <PrevArrow12Icon
          className={clsx(
            'text-quaternary transition-transform',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />{' '}
        Options
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className={clsx(
              'bg-default text-sans-sm absolute top-0 z-30 w-68 rounded-md p-px',
              isGuided ? 'right-66' : 'right-56',
            )}
          >
            <ToggleRow
              label="Showcase Mode"
              checked={isShowcaseMode}
              onChange={(v) => showcaseMode.set(v)}
            />
            <ToggleRow
              label="Debug Mode"
              checked={isDebugMode}
              onChange={(v) => debugMode.set(v)}
            />
            <div className="border-secondary border-t" />
            <Segmented
              label="Quality"
              atom={qualitySetting}
              options={LEVEL_OPTIONS}
              labels={LEVEL_LABELS}
            />
            <Segmented
              label="Post Processing"
              atom={postProcessingSetting}
              options={LEVEL_OPTIONS}
              labels={LEVEL_LABELS}
            />
            <Segmented
              label="Resolution"
              atom={resolutionSetting}
              options={LEVEL_OPTIONS}
              labels={LEVEL_LABELS}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
