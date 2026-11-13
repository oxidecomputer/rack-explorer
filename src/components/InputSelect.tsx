/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { SelectArrows6Icon } from '@oxide/design-system/icons/react'
import { useId } from 'react'

// Native select, after Mitos's InputSelect, styled to match InputNumber.

type InputSelectProps<T extends string> = {
  label: string
  value: T
  onChange: (value: T) => void
  options: { id: T; label: string }[]
  /** Optional unit/description shown after the label. */
  hint?: string
}

export function InputSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: InputSelectProps<T>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-mono-xs text-tertiary flex items-baseline gap-1.5"
      >
        {label}
        {hint && <span className="text-quaternary">{hint}</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="text-sans-sm text-default border-default bg-default hover:border-raise focus:border-accent h-8 w-full cursor-pointer appearance-none rounded-sm border pr-7 pl-2 outline-none"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <SelectArrows6Icon className="text-quaternary pointer-events-none absolute top-1/2 right-2.5 h-2.5 w-1.5 -translate-y-1/2" />
      </div>
    </div>
  )
}
