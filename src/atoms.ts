import { atom } from '@tldraw/state'

export const selectedId = atom('selectedId', 'fans')

type NavigationMode = 'free' | 'guided'
export const navigationMode = atom<NavigationMode>('navigationMode', 'free')

export const specificationsOpen = atom('specificationsOpen', true)
