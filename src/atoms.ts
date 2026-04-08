import { atom, computed } from '@tldraw/state'

import { guidedTours } from './data/guidedTours'

export const selectedId = atom('selectedId', 'oxide-rack')
export const hoveredId = atom<string | null>('hoveredId', null)

type NavigationMode = 'free' | 'guided'
export const navigationMode = atom<NavigationMode>('navigationMode', 'free')

export const specificationsOpen = atom('specificationsOpen', true)
export const landingOpen = atom('landingOpen', true)
export const sceneReady = atom('sceneReady', false)

// Guided tour state
export const activeTourId = atom<string | null>('activeTourId', null)
export const activeTourStepIndex = atom('activeTourStepIndex', 0)

export const activeTour = computed('activeTour', () => {
  const tourId = activeTourId.get()
  if (!tourId) return null
  return guidedTours.find((t) => t.id === tourId) ?? null
})

export const activeTourStep = computed('activeTourStep', () => {
  const tour = activeTour.get()
  if (!tour) return null
  const index = activeTourStepIndex.get()
  return tour.steps[index] ?? null
})

/** Navigate to a specific step in the active tour */
export function goToTourStep(index: number) {
  activeTourStepIndex.set(index)
  const tour = activeTour.get()
  const step = tour?.steps[index]
  if (step?.selectedId) {
    selectedId.set(step.selectedId)
  }
}
