/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { NextArrow12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'

/** Large floating prev/next arrow used by both the standard and video tours. */
export function TourNavArrow({
  direction,
  pos,
  className,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  /** Tailwind class for horizontal position. Defaults to `left-4` / `right-4`. */
  pos?: string
  /** Extra classes for vertical positioning. Lets the call site center the
   *  arrow inside the visible canvas region (offsetting for drawers/timelines
   *  that cover parts of the screen on mobile). Defaults to viewport-center. */
  className?: string
  disabled?: boolean
  onClick: () => void
}) {
  const Icon = direction === 'prev' ? PrevArrow12Icon : NextArrow12Icon
  const defaultPos = direction === 'prev' ? 'left-4' : 'right-4'
  return (
    <button
      className={`target-16 pointer-events-auto absolute transition-all duration-150 ${className ?? 'top-1/2'} ${pos ?? defaultPos} z-30 -translate-y-1/2 rounded-md text-center hover:bg-neutral-800/30 hover:backdrop-blur-sm disabled:pointer-events-none disabled:opacity-15`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="m-1 size-6" />
    </button>
  )
}
