import { atom } from '@tldraw/state'

export const selectedId = atom('selectedId', 'oxide-rack')
export const hoveredId = atom<string | null>('hoveredId', null)

type NavigationMode = 'free' | 'guided'
export const navigationMode = atom<NavigationMode>('navigationMode', 'free')

export const specificationsOpen = atom('specificationsOpen', true)
export const landingOpen = atom('landingOpen', true)
export const sceneReady = atom('sceneReady', false)
