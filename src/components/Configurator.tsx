/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Refresh16Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { motion } from 'motion/react'
import { useState } from 'react'

import {
  lowTierRendering,
  rackConfig,
  rackCount,
  resetRackConfig,
  sledConfig,
  updateRackConfig,
} from '../atoms'
import {
  CPU,
  DEFAULT_CONFIG,
  DRIVE_OPTIONS,
  formatCount,
  formatMemory,
  formatStorage,
  getRackTotals,
  MAX_DRIVES_PER_SLED,
  MAX_RACKS,
  MAX_RATED_RACK_KW,
  MAX_SLEDS,
  MEMORY_OPTIONS,
  MIN_DRIVES_PER_SLED,
  MIN_RACKS,
  MIN_SLEDS,
  RACK_DIMENSIONS_MM,
  scaleTotals,
  SLED_STEP,
  type ConfigOption,
  type RackTotals,
} from '../data/configurator'
import { InputNumber } from './InputNumber'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-mono-xs text-tertiary">{title}</div>
      {children}
    </div>
  )
}

/** Full-bleed rule across the card, past its padding. */
const Divider = () => <hr className="border-secondary -mx-3 border-t" />

function OptionGrid({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ConfigOption[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={clsx(
              'flex items-baseline justify-between gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
              selected
                ? 'border-accent bg-accent text-accent'
                : 'border-secondary text-tertiary hover:bg-hover hover:text-secondary',
            )}
          >
            <span className="text-sans-sm">{option.label}</span>
            <span
              className={clsx(
                'text-mono-xs',
                selected ? 'text-accent-secondary' : 'text-quaternary',
              )}
            >
              {option.detail}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Left sidebar: the configuration options. */
export function ConfiguratorPanel() {
  const config = useValue(sledConfig)

  return (
    <div className="flex flex-col gap-4 pb-1">
      <InputNumber
        label="Compute sleds"
        hint="per rack"
        value={config.sleds}
        min={MIN_SLEDS}
        max={MAX_SLEDS}
        step={SLED_STEP}
        onChange={(sleds) => updateRackConfig({ sleds })}
      />

      <Divider />

      <Section title="Memory per sled">
        <OptionGrid
          label="Memory per sled"
          options={MEMORY_OPTIONS}
          value={config.memoryId}
          onChange={(memoryId) => updateRackConfig({ memoryId })}
        />
      </Section>

      <Divider />

      <Section title="NVMe drive capacity">
        <OptionGrid
          label="NVMe drive capacity"
          options={DRIVE_OPTIONS}
          value={config.driveId}
          onChange={(driveId) => updateRackConfig({ driveId })}
        />
      </Section>

      <InputNumber
        label="NVMe drives per sled"
        value={config.drivesPerSled}
        min={MIN_DRIVES_PER_SLED}
        max={MAX_DRIVES_PER_SLED}
        onChange={(drivesPerSled) => updateRackConfig({ drivesPerSled })}
      />
    </div>
  )
}

export function ConfiguratorResetButton() {
  const config = useValue(rackConfig)
  const isDefault = (Object.keys(DEFAULT_CONFIG) as (keyof typeof DEFAULT_CONFIG)[]).every(
    (k) => config[k] === DEFAULT_CONFIG[k],
  )
  return (
    <button
      onClick={resetRackConfig}
      disabled={isDefault}
      aria-label="Reset configuration"
      className="text-quaternary hover:text-default target-4 -my-1 rounded transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      <Refresh16Icon className="h-3 w-3" />
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-secondary flex items-baseline justify-between gap-2 rounded-md border px-2.5 py-1.5">
      <div className="text-mono-xs text-quaternary">{label}</div>
      <div className="text-sans-md text-raise tabular-nums">{value}</div>
    </div>
  )
}

function TotalsGrid({ totals }: { totals: RackTotals }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Stat label="CPU cores" value={formatCount(totals.cores)} />
      <Stat label="Threads" value={formatCount(totals.threads)} />
      <Stat label="Memory" value={formatMemory(totals.memoryGiB)} />
      <Stat label="NVMe storage" value={formatStorage(totals.storageTB)} />
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-mono-xs text-quaternary uppercase">{label}</div>
      <div className="text-sans-sm text-secondary">{value}</div>
    </div>
  )
}

const kwFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const formatKW = (kw: number) => `${kwFormat.format(kw)} kW`

/** Estimated draw of one rack against its rated maximum. */
function PowerBar({ kw }: { kw: number }) {
  const fraction = Math.min(1, kw / MAX_RATED_RACK_KW)
  const overRated = kw > MAX_RATED_RACK_KW
  return (
    <div
      className={clsx(
        'rounded-md border px-2.5 py-2 transition-colors',
        overRated ? 'border-destructive-secondary' : 'border-secondary',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-mono-xs text-quaternary">Est. power draw</span>
        <span
          className={clsx(
            'text-sans-md tabular-nums transition-colors',
            overRated ? 'text-destructive' : 'text-raise',
          )}
        >
          {formatKW(kw)}
        </span>
      </div>
      <div className="bg-tertiary mt-2 h-1.5 overflow-hidden rounded-full">
        <motion.div
          className={clsx(
            'h-full rounded-full transition-colors',
            overRated ? 'bg-(--content-destructive)' : 'bg-(--content-secondary)',
          )}
          initial={false}
          animate={{ width: `${fraction * 100}%` }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
        />
      </div>
      <div
        className={clsx(
          'text-mono-xs mt-1.5 text-right',
          overRated ? 'text-destructive-secondary' : 'text-quaternary',
        )}
      >
        {overRated ? 'Exceeds max rated' : 'Max rated'}: {MAX_RATED_RACK_KW} kW
      </div>
    </div>
  )
}

/** Right sidebar: what the configuration adds up to. */
export function ConfiguratorSummary() {
  const config = useValue(rackConfig)
  const perRack = getRackTotals(config)
  const multiRack = config.racks > 1
  const { height, width, depth } = RACK_DIMENSIONS_MM

  return (
    <div className="flex flex-col gap-4">
      {multiRack ? (
        <>
          <Section title={`Total · ${config.racks} racks`}>
            <TotalsGrid totals={scaleTotals(perRack, config.racks)} />
            <Stat
              label="Est. power draw"
              value={formatKW(perRack.powerKW * config.racks)}
            />
          </Section>
          <Divider />
          <Section title="Per rack">
            <TotalsGrid totals={perRack} />
            <PowerBar kw={perRack.powerKW} />
          </Section>
        </>
      ) : (
        <Section title="Rack totals">
          <TotalsGrid totals={perRack} />
          <PowerBar kw={perRack.powerKW} />
        </Section>
      )}

      <Divider />

      <div className="flex flex-col gap-3 select-text">
        <SpecRow
          label="Compute sleds"
          value={`${config.sleds} × ${CPU.cores} cores / ${CPU.threads} threads`}
        />
        <SpecRow
          label="NVMe drives"
          value={`${formatCount(perRack.drives)} per rack (${config.drivesPerSled} per sled)`}
        />
        <SpecRow label="Switching capacity" value="12.8 Tbit/s per rack" />
        <SpecRow label="Per-sled networking" value="2 × 100GbE" />
        <SpecRow
          label="Dimensions (H × W × D)"
          value={`${formatCount(height)} × ${width} × ${formatCount(depth)} mm`}
        />
      </div>
    </div>
  )
}

/** Centered under the rack: how many racks to deploy. */
export function RackCountStepper() {
  const racks = useValue(rackCount)
  const isLowTier = useValue(lowTierRendering)
  const [draft, setDraft] = useState<string | null>(null)
  const set = (n: number) =>
    updateRackConfig({ racks: Math.min(MAX_RACKS, Math.max(MIN_RACKS, Math.round(n))) })

  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft.trim())
    if (draft.trim() !== '' && Number.isFinite(parsed) && parsed !== racks) set(parsed)
    setDraft(null)
  }

  const buttonClass =
    'text-secondary hover:bg-hover hover:text-default flex h-8 w-8 items-center justify-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40'

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-md border border-neutral-900/10 p-1',
        isLowTier ? 'bg-default/95' : 'bg-default/70 backdrop-blur-md',
      )}
    >
      <button
        className={buttonClass}
        onClick={() => set(racks - 1)}
        disabled={racks <= MIN_RACKS}
        aria-label="Remove a rack"
      >
        <MinusIcon />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Racks (${MIN_RACKS}–${MAX_RACKS})`}
        value={draft ?? String(racks)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            setDraft(null)
            set(racks + (e.key === 'ArrowUp' ? 1 : -1))
          }
        }}
        className="text-sans-md text-raise hover:bg-hover focus:bg-hover w-14 rounded-sm bg-transparent text-center tabular-nums outline-none"
      />
      <button
        className={buttonClass}
        onClick={() => set(racks + 1)}
        disabled={racks >= MAX_RACKS}
        aria-label="Add a rack"
      >
        <PlusIcon />
      </button>
    </div>
  )
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const MinusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)
