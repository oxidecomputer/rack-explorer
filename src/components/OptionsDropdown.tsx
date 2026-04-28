import { PrevArrow12Icon } from '@oxide/design-system/icons/react'
import type { Atom } from '@tldraw/state'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { motion } from 'motion/react'
import { useState } from 'react'

import {
  adaptiveDprSetting,
  ambientOcclusionSetting,
  debugMode,
  highQualitySetting,
  showcaseMode,
  type QualitySetting,
} from '../atoms'

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-4 w-7 rounded-full transition-colors ${
        checked ? 'bg-accent-secondary' : 'bg-tertiary'
      }`}
    >
      <motion.div
        className="bg-raise absolute top-0.5 h-3 w-3 rounded-full"
        initial={false}
        animate={{ left: checked ? 14 : 2 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
      />
    </button>
  )
}

const SETTING_OPTIONS: QualitySetting[] = ['auto', 'on', 'off']
const SETTING_LABELS: Record<QualitySetting, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
}

function SegmentedSetting({ label, atom }: { label: string; atom: Atom<QualitySetting> }) {
  const value = useValue(atom)
  return (
    <div className="flex items-center justify-between rounded px-3 py-2">
      <span className="text-secondary">{label}</span>
      <div className="bg-tertiary flex rounded-sm p-px">
        {SETTING_OPTIONS.map((option) => {
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
              {SETTING_LABELS[option]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OptionsDropdown() {
  const [open, setOpen] = useState(false)
  const isShowcaseMode = useValue(showcaseMode)
  const isDebugMode = useValue(debugMode)

  return (
    <div className="max-1000:hidden relative z-40 w-full">
      <button
        onClick={() => setOpen(!open)}
        className="text-mono-xs text-secondary bg-default hover:bg-hover border-neutral-0 flex h-8 w-full items-center gap-1.5 rounded border p-2"
      >
        <PrevArrow12Icon
          className={clsx(
            'text-quaternary transition-transform',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />{' '}
        Options
      </button>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className="bg-default text-sans-sm absolute top-0 right-56 z-30 w-68 rounded-md p-px"
          >
            <label className="hover:bg-hover flex cursor-pointer items-center justify-between rounded px-3 py-2">
              <span className="text-secondary">Showcase Mode</span>
              <Toggle checked={isShowcaseMode} onChange={(v) => showcaseMode.set(v)} />
            </label>
            <label className="hover:bg-hover flex cursor-pointer items-center justify-between rounded px-3 py-2">
              <span className="text-secondary">Debug Stats</span>
              <Toggle checked={isDebugMode} onChange={(v) => debugMode.set(v)} />
            </label>
            <div className="border-secondary border-t" />
            <SegmentedSetting label="High Quality" atom={highQualitySetting} />
            <SegmentedSetting label="Ambient Occlusion" atom={ambientOcclusionSetting} />
            <SegmentedSetting label="Adaptive DPR" atom={adaptiveDprSetting} />
          </motion.div>
        </>
      )}
    </div>
  )
}
