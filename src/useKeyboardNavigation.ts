import { useEffect } from 'react'

import {
  activeTour,
  activeTourStepIndex,
  goToTourStep,
  navigationMode,
  selectedId,
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
      if (navigationMode.get() === 'guided') {
        const tour = activeTour.get()
        if (!tour) return
        const stepIndex = activeTourStepIndex.get()
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
        return
      }
      const handler = keyHandlers[e.key]
      if (!handler) return

      e.preventDefault()
      handler(selectedId.get())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
