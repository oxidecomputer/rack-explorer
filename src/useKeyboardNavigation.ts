/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useEffect } from 'react'

import {
  activeTour,
  activeTourStepIndex,
  activeVideoTour,
  activeVideoTourStepIndex,
  goToNextTour,
  goToTourStep,
  landingOpen,
  navigationMode,
  seekVideo,
  selectedId,
  togglePlayWithFlash,
  videoTourPlaying,
  tourStartScreen,
} from './atoms'
import { getNode, getSiblings, inheritInstanceIndex } from './data/componentTree'

function drillDown(currentId: string) {
  const base = currentId.split(':')[0]
  const entry = getNode(base)
  const firstChild = entry?.node.children?.[0]
  if (firstChild) {
    selectedId.set(inheritInstanceIndex(currentId, firstChild.id))
  }
}

const keyHandlers: Record<string, (currentId: string) => void> = {
  Enter: drillDown,
  ' ': drillDown,

  Escape(currentId) {
    const base = currentId.split(':')[0]
    const entry = getNode(base)
    if (entry?.parent) {
      selectedId.set(inheritInstanceIndex(currentId, entry.parent.id))
    }
  },

  ArrowDown(currentId) {
    const base = currentId.split(':')[0]
    const siblings = getSiblings(base)
    const index = siblings.findIndex((s) => s.id === base)
    if (index < 0) return
    const nextIndex = (index + 1) % siblings.length
    selectedId.set(inheritInstanceIndex(currentId, siblings[nextIndex].id))
  },

  ArrowUp(currentId) {
    const base = currentId.split(':')[0]
    const siblings = getSiblings(base)
    const index = siblings.findIndex((s) => s.id === base)
    if (index < 0) return
    const prevIndex = (index - 1 + siblings.length) % siblings.length
    selectedId.set(inheritInstanceIndex(currentId, siblings[prevIndex].id))
  },
}

export function useKeyboardNavigation() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable]')) return
      if (target?.matches('button, a') && (e.key === 'Enter' || e.key === ' ')) {
        return
      }

      if (landingOpen.get()) return

      if (navigationMode.get() !== 'guided') {
        // Free mode
        const handler = keyHandlers[e.key]
        if (!handler) return
        e.preventDefault()
        handler(selectedId.get())
        return
      }

      // Dismiss start screen with Enter or Space
      if (tourStartScreen.get()) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          tourStartScreen.set(false)
          if (activeVideoTour.get()) videoTourPlaying.set(true)
        }
        return
      }

      // Guided mode — check if it's a video tour
      const videoTour = activeVideoTour.get()
      if (videoTour) {
        // Space to toggle play/pause — flash the icon like a canvas click.
        if (e.key === ' ') {
          e.preventDefault()
          togglePlayWithFlash()
          return
        }

        const stepIndex = activeVideoTourStepIndex.get()

        // Arrow keys to skip between steps; ArrowRight at the end cycles tours.
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          if (stepIndex === videoTour.steps.length - 1) {
            goToNextTour()
          } else {
            seekVideo(videoTour.steps[stepIndex + 1].timestamp)
          }
        } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
          e.preventDefault()
          seekVideo(videoTour.steps[stepIndex - 1].timestamp)
        }
        return
      }

      // Standard guided tour
      const tour = activeTour.get()
      if (!tour) return
      const stepIndex = activeTourStepIndex.get()
      if (e.key === 'ArrowRight' && stepIndex === tour.steps.length - 1) {
        e.preventDefault()
        goToNextTour()
        return
      }
      let nextStep: number | null = null
      if (e.key === 'ArrowRight' && stepIndex < tour.steps.length - 1) {
        nextStep = stepIndex + 1
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        nextStep = stepIndex - 1
      }
      if (nextStep !== null) {
        e.preventDefault()
        goToTourStep(nextStep)
        const pip = document.querySelector<HTMLElement>(`[data-step="${nextStep}"]`)
        pip?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
