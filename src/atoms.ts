import { atom, computed } from '@tldraw/state'

import { guidedTours, getVideoTourStepAtTime, type VideoTour } from './data/guidedTours'

export const selectedId = atom('selectedId', 'oxide-rack')
export const hoveredId = atom<string | null>('hoveredId', null)

type NavigationMode = 'free' | 'guided'
export const navigationMode = atom<NavigationMode>('navigationMode', 'free')

export const specificationsOpen = atom('specificationsOpen', true)
export const landingOpen = atom('landingOpen', true)
export const sceneReady = atom('sceneReady', false)

// Options
export const lowQuality = atom('lowQuality', false)
export const showcaseMode = atom('showcaseMode', false)

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

// Video tour playback state
export const videoTourPlaying = atom('videoTourPlaying', false)
export const videoTourCurrentTime = atom('videoTourCurrentTime', 0)
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
