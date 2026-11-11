/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Compass16Icon, NextArrow12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'

import { setSidebarTab, sidebarTab, startTour } from '../atoms'
import { getFirstStandardTour } from '../data/guidedTours'
import { ConfiguratorResetButton } from './Configurator'

const TABS = [
  { id: 'components', label: 'Components' },
  { id: 'tours', label: 'Tours' },
  { id: 'configure', label: 'Configure' },
] as const

/** Title row of the left card: free explore, guided tours, or the rack
 *  configurator. Each tab is a mode (see `setSidebarTab`). */
export function SidebarTabs() {
  const current = useValue(sidebarTab)
  return (
    <div role="tablist" aria-label="Sidebar" className="-mx-1 -my-0.5 flex gap-0.5">
      {TABS.map((tab) => {
        const selected = tab.id === current
        // The configurator's reset sits inside its tab's pill. Buttons can't
        // nest, so the pill is a wrapper around the tab and the reset.
        const showReset = selected && tab.id === 'configure'
        return (
          <div
            key={tab.id}
            className={clsx(
              'flex items-center rounded transition-colors',
              selected
                ? 'text-default bg-neutral-800/10'
                : 'text-tertiary hover:text-secondary',
              showReset && 'pr-1',
            )}
          >
            <button
              role="tab"
              aria-selected={selected}
              onClick={() => setSidebarTab(tab.id)}
              className="text-mono-xs px-1.5 py-0.5"
            >
              {tab.label}
            </button>
            {showReset && <ConfiguratorResetButton />}
          </div>
        )
      })}
    </div>
  )
}

/** Standing invitation into the overview tour, under the sidebar in free mode. */
export function TourCard() {
  return (
    <button
      onClick={() => startTour(getFirstStandardTour().id)}
      className="text-sans-sm group bg-accent hover:bg-accent-hover block w-64 rounded-md border border-current/5 p-2.5 text-left transition-colors"
    >
      <div className="text-accent flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Compass16Icon className="text-accent-secondary h-3 w-3" />
          Take the tour
        </span>
        <NextArrow12Icon className="transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-accent-secondary mt-1 pr-4">
        Follow a step-by-step walkthrough of the rack
      </p>
    </button>
  )
}
