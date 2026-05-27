/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { computed, atom as createAtom, type Atom, type AtomOptions } from '@tldraw/state'

import { findClosestModelAncestorId } from './data/componentTree'
import { getVideoTourStepAtTime, guidedTours, type VideoTour } from './data/guidedTours'

// Preserve atom identity across HMR re-evaluation. This module is non-
// refreshable (no React components), so an edit to it — or to any non-
// refreshable upstream dep like componentTree.ts — causes Vite to re-import it
// and reset every atom to its default. Caching by name on import.meta.hot.data
// hands back the same instance, so atom values (landingOpen, sceneReady,
// selectedId, etc.) survive the reload.
const atomCache: Map<string, Atom<unknown, unknown>> | null = import.meta.hot
  ? (import.meta.hot.data.atomCache ??= new Map())
  : null

function atom<Value, Diff = unknown>(
  name: string,
  initialValue: Value,
  options?: AtomOptions<Value, Diff>,
): Atom<Value, Diff> {
  if (!atomCache) return createAtom(name, initialValue, options)
  const cached = atomCache.get(name)
  if (cached) return cached as Atom<Value, Diff>
  const a = createAtom(name, initialValue, options)
  atomCache.set(name, a as Atom<unknown, unknown>)
  return a
}

export const selectedId = atom('selectedId', 'oxide-rack')
export const hoveredId = atom<string | null>('hoveredId', null)

/** Drives the 3D selection outline. Falls back to the closest ancestor with a
 *  model when the current selection has none (e.g. `disks` → `compute-inner`),
 *  so the outline still has something visible to draw around. */
export const outlineId = computed('outlineId', () =>
  findClosestModelAncestorId(selectedId.get()),
)

/** Open when the current selection's preamble animation (e.g. cosmo handle) has
 *  finished, or there is none. Sibling models (perforations layered over the
 *  exterior) gate their slide-out on this so they stay in lockstep with the
 *  clip-bearing mesh. */
export const selectionAnimGateOpen = atom('selectionAnimGateOpen', true)

type NavigationMode = 'free' | 'guided'
export const navigationMode = atom<NavigationMode>('navigationMode', 'free')

export const specificationsOpen = atom('specificationsOpen', true)
export const landingOpen = atom('landingOpen', true)
export const sceneReady = atom('sceneReady', false)

// Mobile-only UI state
export const mobileOutlineOpen = atom('mobileOutlineOpen', false)

// Options
export const showcaseMode = atom('showcaseMode', false)
export const debugMode = atom('debugMode', false)

/** Debug-only: render the click-hitbox volumes for waypoint-only nodes
 *  (e.g. disks, power-connector) as visible wireframes. */
export const showHitboxes = atom('showHitboxes', false)

/** Debug-only: render the HDRI as the scene background so its rotation/
 *  intensity are visible directly, not just via reflections on the rack. */
export const showHdriBackground = atom('showHdriBackground', false)

/** Bumped to request a high-DPR transparent-BG export of the canvas. The
 *  in-canvas CanvasExporter component watches this and runs the export. */
export const canvasExportRequest = atom('canvasExportRequest', 0)
export function requestCanvasExport() {
  canvasExportRequest.update((v) => v + 1)
}

// Debug-mode tweakables (only visible/effective when debugMode is on)
export const hdriRotationX = atom('hdriRotationX', 0.44)
export const hdriRotationY = atom('hdriRotationY', 0.44)
export const hdriRotationZ = atom('hdriRotationZ', 0)
export const environmentIntensity = atom('environmentIntensity', 2.25)
export const showcaseRotationSpeed = atom('showcaseRotationSpeed', 0.15)
/** Multiplier applied to whatever fit fraction the waypoint resolves to
 *  (per-waypoint or DEFAULT_FIT_FRACTION). 1 = no change. */
export const fitFractionMultiplier = atom('fitFractionMultiplier', 1)

/** Multiplier applied to the camera's max dolly distance (zoom-out cap). 1 =
 *  no change; >1 lets the user dolly past the rack-overview framing. */
export const maxZoomMultiplier = atom('maxZoomMultiplier', 1)

/** Three-level quality scale: 'auto' lets tier detection (and adaptive perf,
 *  for post-processing and DPR) drive the effective value; 'high'/'low' is a
 *  manual override that adaptive perf must respect. */
export type QualityLevel = 'auto' | 'high' | 'low'

/** High = full materials, environment HDRI, grid, full-resolution outline.
 *  Low = MeshLambert + ambient/directional lights, no grid, quarter-res outline.
 *  Auto = tier detection picks. */
export const qualitySetting = atom<QualityLevel>('qualitySetting', 'auto')

/** Screen-space ambient occlusion quality. High = full samples/radius. Low =
 *  reduced samples/radius. Auto = tier detection picks, and adaptive perf can
 *  drop AO entirely under sustained load. */
export const postProcessingSetting = atom<QualityLevel>('postProcessingSetting', 'auto')

/** Render resolution. Auto = adaptive (drops DPR under load via
 *  PerformanceMonitor). High = pinned at the tier's maxDpr. Low = pinned at 1x. */
export const resolutionSetting = atom<QualityLevel>('resolutionSetting', 'auto')

/** Detected GPU tier (0..3). Null until getGPUTier() resolves. */
export const detectedTier = atom<number | null>('detectedTier', null)

/** True when the browser is rendering WebGL via software (SwiftShader/llvmpipe). */
export const softwareRenderingDetected = atom('softwareRenderingDetected', false)

/** True when GLB model components should render with downgraded Lambert
 *  materials. Computed from the high-quality setting + detected tier so manual
 *  overrides win and 'auto' falls back to tier ≥ 2. */
export const lowTierRendering = computed('lowTierRendering', () => {
  const setting = qualitySetting.get()
  if (setting === 'high') return false
  if (setting === 'low') return true
  const tier = detectedTier.get()
  return tier == null ? false : tier < 2
})

// Guided tour state
export const activeTourId = atom<string | null>('activeTourId', null)
export const activeTourStepIndex = atom('activeTourStepIndex', 0)

export const activeTour = computed('activeTour', () => {
  const tourId = activeTourId.get()
  if (!tourId) return null
  return guidedTours.find((t) => t.id === tourId) ?? null
})

/** Whether the currently active tour is a video tour */
export const isVideoTour = computed('isVideoTour', () => {
  const tour = activeTour.get()
  return tour?.type === 'video'
})

/** The active tour narrowed to VideoTour, or null if not a video tour */
export const activeVideoTour = computed('activeVideoTour', () => {
  const tour = activeTour.get()
  if (!tour || tour.type !== 'video') return null
  return tour as VideoTour
})

export const activeTourStep = computed('activeTourStep', () => {
  const tour = activeTour.get()
  if (!tour) return null
  if (tour.type === 'video') {
    const index = activeVideoTourStepIndex.get()
    return tour.steps[index] ?? null
  }
  const index = activeTourStepIndex.get()
  return tour.steps[index] ?? null
})

/** Navigate to a specific step in the active standard tour */
export function goToTourStep(index: number) {
  activeTourStepIndex.set(index)
  const tour = activeTour.get()
  if (!tour || tour.type === 'video') return
  const step = tour.steps[index]
  if (step?.selectedId) {
    selectedId.set(step.selectedId)
  }
}

/** Advance to the next tour, cycling back to the first when at the end. Lands
 *  on the next tour's start screen so the user gets its intro before stepping
 *  into the content. */
export function goToNextTour() {
  const current = activeTourId.get()
  const idx = guidedTours.findIndex((t) => t.id === current)
  const next = guidedTours[(idx + 1) % guidedTours.length]
  startTour(next.id)
  cycledFromPreviousTour.set(true)
}

// Video tour playback state
export const videoTourPlaying = atom('videoTourPlaying', false)
export const videoTourCurrentTime = atom('videoTourCurrentTime', 0)

export const VIDEO_TOUR_PLAYBACK_RATES = [1.0, 1.3, 1.8] as const
export type VideoTourPlaybackRate = (typeof VIDEO_TOUR_PLAYBACK_RATES)[number]
export const videoTourPlaybackRate = atom<VideoTourPlaybackRate>('videoTourPlaybackRate', 1)
export function cycleVideoTourPlaybackRate() {
  const current = videoTourPlaybackRate.get()
  const idx = VIDEO_TOUR_PLAYBACK_RATES.indexOf(current)
  const next = VIDEO_TOUR_PLAYBACK_RATES[(idx + 1) % VIDEO_TOUR_PLAYBACK_RATES.length]
  videoTourPlaybackRate.set(next)
}

/** Last user-driven play/pause toggle. The center-of-screen flash watches this
 *  and shows the matching icon for ~700ms. Bumped only by canvas clicks (not
 *  by every play-state change) so auto-pauses don't trigger a flash. */
export const playPauseFlash = atom<{ key: number; isPlaying: boolean } | null>(
  'playPauseFlash',
  null,
)
/** Toggle videoTourPlaying and trigger the flash overlay. */
export function togglePlayWithFlash() {
  const next = !videoTourPlaying.get()
  videoTourPlaying.set(next)
  playPauseFlash.set({ key: Date.now(), isPlaying: next })
}
/** Whether the tour start screen is showing (before the user begins the tour) */
export const tourStartScreen = atom('tourStartScreen', true)

/** True when the start screen is being shown as a result of advancing past the
 *  previous tour's last step (rather than picking a tour from the sidebar or
 *  landing). Used to surface a "Contact Sales" CTA below the start screen as a
 *  subtle touchpoint at the natural break between tours. */
export const cycledFromPreviousTour = atom('cycledFromPreviousTour', false)

export const activeVideoTourStepIndex = computed('activeVideoTourStepIndex', () => {
  const tour = activeVideoTour.get()
  if (!tour) return 0
  return getVideoTourStepAtTime(tour, videoTourCurrentTime.get())
})

/** Seek the video tour player to a specific time */
export function seekVideo(time: number) {
  const video = document.querySelector<HTMLVideoElement>('[data-video-tour-player] video')
  if (video) video.currentTime = time
  videoTourCurrentTime.set(time)
}

/** Start a tour by ID — sets up all the right state */
export function startTour(tourId: string) {
  const tour = guidedTours.find((t) => t.id === tourId)
  if (!tour) return

  navigationMode.set('guided')
  showcaseMode.set(false)
  activeTourId.set(tourId)
  videoTourPlaying.set(false)
  tourStartScreen.set(true)
  cycledFromPreviousTour.set(false)

  if (tour.type === 'video') {
    videoTourCurrentTime.set(0)
  } else {
    activeTourStepIndex.set(0)
  }

  const firstStep = tour.steps[0]
  if (firstStep?.selectedId) {
    selectedId.set(firstStep.selectedId)
  }
}

/** Exit guided mode entirely */
export function exitGuidedMode() {
  navigationMode.set('free')
  selectedId.set('oxide-rack')
  activeTourId.set(null)
  activeTourStepIndex.set(0)
  videoTourPlaying.set(false)
  videoTourCurrentTime.set(0)
  tourStartScreen.set(true)
}

// Free-explore tutorial: 3-step coachmark sequence shown on first visit.
// Index null = inactive; 0..2 = visible step.
const FREE_TUTORIAL_SEEN_KEY = 'rack-explorer:free-tutorial-seen'

function readTutorialSeen(): boolean {
  try {
    return localStorage.getItem(FREE_TUTORIAL_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export const freeTutorialStepIndex = atom<number | null>('freeTutorialStepIndex', null)

export const FREE_TUTORIAL_STEP_COUNT = 3

/** Start the tutorial if it hasn't been seen before. */
export function maybeStartFreeTutorial() {
  if (readTutorialSeen()) return
  freeTutorialStepIndex.set(0)
}

/** Force-start the tutorial from the help icon, regardless of seen state. */
export function restartFreeTutorial() {
  freeTutorialStepIndex.set(0)
}

export function advanceFreeTutorial() {
  const current = freeTutorialStepIndex.get()
  if (current === null) return
  const next = current + 1
  if (next >= FREE_TUTORIAL_STEP_COUNT) {
    dismissFreeTutorial()
    return
  }
  // drill into a compute sled
  if (next === 2 && selectedId.get().split(':')[0] === 'oxide-rack') {
    selectedId.set('compute-sled:16')
  }
  freeTutorialStepIndex.set(next)
}

export function dismissFreeTutorial() {
  freeTutorialStepIndex.set(null)
  try {
    localStorage.setItem(FREE_TUTORIAL_SEEN_KEY, '1')
  } catch {
    // localStorage unavailable — tutorial will reappear next visit, acceptable.
  }
}
