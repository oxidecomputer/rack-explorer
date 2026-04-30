import { atom, computed } from '@tldraw/state'

import { guidedTours, getVideoTourStepAtTime, type VideoTour } from './data/guidedTours'

export const selectedId = atom('selectedId', 'oxide-rack')
export const hoveredId = atom<string | null>('hoveredId', null)

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
}

// Video tour playback state
export const videoTourPlaying = atom('videoTourPlaying', false)
export const videoTourCurrentTime = atom('videoTourCurrentTime', 0)

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
  } else {
    freeTutorialStepIndex.set(next)
  }
}

export function dismissFreeTutorial() {
  freeTutorialStepIndex.set(null)
  try {
    localStorage.setItem(FREE_TUTORIAL_SEEN_KEY, '1')
  } catch {
    // localStorage unavailable — tutorial will reappear next visit, acceptable.
  }
}
