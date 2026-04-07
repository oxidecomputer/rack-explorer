import { useEffect } from 'react'
import { selectedId } from './atoms'
import { getNode, getSiblings, inheritInstanceIndex } from './data/componentTree'

const keyHandlers: Record<string, (currentId: string) => void> = {
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
      const handler = keyHandlers[e.key]
      if (!handler) return

      e.preventDefault()
      handler(selectedId.get())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
