/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

// Slider + number field, after Mitos's InputNumber: drag or click anywhere on
// the track to scrub, or type an exact value. Integers only.

type InputNumberProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Optional unit/description shown after the label. */
  hint?: string
}

export function InputNumber({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: InputNumberProps) {
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // Typed text is kept separate so a half-typed value ("1") isn't clamped
  // mid-edit; it commits on blur or Enter.
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))

  const valueAt = (clientX: number) => {
    const bounds = trackRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return value
    const t = (clientX - bounds.left) / bounds.width
    return clamp(min + (max - min) * t)
  }

  const set = (v: number) => {
    const next = clamp(v)
    if (next !== value) onChange(next)
  }

  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [dragging])

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(parsed)) set(parsed)
    setDraft(null)
  }

  const t = max > min ? (value - min) / (max - min) : 0

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-mono-xs text-tertiary flex items-baseline gap-1.5"
      >
        {label}
        {hint && <span className="text-quaternary">{hint}</span>}
      </label>
      <div className="grid grid-cols-[1fr_3.5rem] items-center gap-3">
        <div className="relative">
          {/* Keyboard and assistive tech get a native range input; the pointer
              scrubs the drawn track below, which maps edge to edge. */}
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            className="peer sr-only"
          />
          <div
            ref={trackRef}
            aria-hidden
            className="group peer-focus-visible:ring-accent-secondary relative flex h-6 cursor-pointer touch-none items-center rounded-sm peer-focus-visible:ring-2"
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              setDragging(true)
              set(valueAt(e.clientX))
            }}
            onPointerMove={(e) => {
              if (dragging) set(valueAt(e.clientX))
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <div className="bg-tertiary relative h-0.5 w-full rounded-full">
              <div
                className="bg-accent-inverse absolute inset-y-0 left-0 rounded-full opacity-60"
                style={{ width: `${t * 100}%` }}
              />
            </div>
            <div
              className={clsx(
                'bg-accent-inverse pointer-events-none absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-[1px] shadow-[0_0_0_2px_var(--surface-default)] transition-[height]',
                dragging ? 'h-4' : 'group-hover:h-4',
              )}
              style={{ left: `calc(${t} * (100% - 0.25rem))` }}
            />
          </div>
        </div>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitDraft()
              e.currentTarget.blur()
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              setDraft(null)
              set(value + (e.key === 'ArrowUp' ? step : -step))
            } else if (e.key === 'Escape') {
              setDraft(null)
              e.currentTarget.blur()
            }
          }}
          className="text-sans-sm text-default border-default bg-default hover:border-raise focus:border-accent h-6 w-full rounded-sm border px-1 text-center tabular-nums outline-none"
        />
      </div>
    </div>
  )
}
