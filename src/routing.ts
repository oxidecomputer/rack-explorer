/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// The sidebar tabs as URLs:
//   /                 free explore (Components)
//   /tours/<tour-id>  a guided tour (Tours)
//   /configurator     the rack configurator (Configure)
// The atoms stay the source of truth: the URL follows navigationMode and
// activeTourId, and loading a URL or going back/forward sets them.
// New paths also need a rewrite in vercel.json.

import { react } from '@tldraw/state'

import {
  activeTourId,
  exitGuidedMode,
  navigationMode,
  startConfigure,
  startTour,
} from './atoms'
import { getFirstStandardTour, getTour } from './data/guidedTours'

type Route = { mode: 'free' } | { mode: 'configure' } | { mode: 'guided'; tourId: string }

function parseRoute(pathname: string): Route {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (first === 'configurator') return { mode: 'configure' }
  if (first === 'tours') {
    return {
      mode: 'guided',
      tourId: getTour(second ?? '')?.id ?? getFirstStandardTour().id,
    }
  }
  return { mode: 'free' }
}

function currentPath(): string {
  const mode = navigationMode.get()
  if (mode === 'configure') return '/configurator'
  if (mode === 'guided') return `/tours/${activeTourId.get() ?? getFirstStandardTour().id}`
  return '/'
}

/** Free explore and the configurator are desktop-only (see App). */
const isNarrow = () => !window.matchMedia('(min-width: 1000px)').matches

function applyRoute(requested: Route) {
  const route: Route =
    isNarrow() && requested.mode !== 'guided'
      ? { mode: 'guided', tourId: getFirstStandardTour().id }
      : requested
  const mode = navigationMode.get()
  if (route.mode === 'configure') {
    if (mode !== 'configure') startConfigure()
  } else if (route.mode === 'guided') {
    if (mode !== 'guided' || activeTourId.get() !== route.tourId) startTour(route.tourId)
  } else if (mode !== 'free') {
    exitGuidedMode()
  }
}

/** Legacy deep links (`?tour=<id>`, `?configure`) become routes. */
function legacyRoute(url: URL): Route | null {
  const tourId = url.searchParams.get('tour')
  const configure = url.searchParams.has('configure')
  url.searchParams.delete('tour')
  url.searchParams.delete('configure')
  if (configure) return { mode: 'configure' }
  if (tourId) {
    const tour = getTour(tourId)
    if (tour) return { mode: 'guided', tourId: tour.id }
  }
  return null
}

/** Apply the URL the page loaded with. Runs at module load, before the first
 *  React render, so the first paint already shows the right mode. */
export function applyInitialRoute() {
  const url = new URL(window.location.href)
  const route = legacyRoute(url) ?? parseRoute(url.pathname)
  applyRoute(route)
  // Normalise (unknown tour ids, trailing slashes, legacy params) in place.
  window.history.replaceState(null, '', currentPath() + url.search + url.hash)
}

/** Keep the URL in step with the mode from here on. Switching tab adds a
 *  history entry; moving between tours replaces it, so Back leaves the tours
 *  rather than stepping through each one. */
export function startRouting(): () => void {
  let lastMode = navigationMode.get()
  const stop = react('sync url', () => {
    const path = currentPath()
    const mode = navigationMode.get()
    if (path !== window.location.pathname) {
      const url = path + window.location.search + window.location.hash
      if (mode === lastMode) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    }
    lastMode = mode
  })
  const onPopState = () => applyRoute(parseRoute(window.location.pathname))
  window.addEventListener('popstate', onPopState)
  return () => {
    stop()
    window.removeEventListener('popstate', onPopState)
  }
}
