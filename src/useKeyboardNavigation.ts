import { useEffect } from 'react'
import { selectedId } from './atoms'
import { outlineItems } from './components/Outline'

type TreeItem = {
  id: string
  label: string
  children?: TreeItem[]
}

const allItems: TreeItem[] = [
  {
    id: 'oxide-rack',
    label: 'Oxide Rack',
    children: outlineItems,
  },
]

/** Find the parent item and sibling list for a given id in the tree */
function findContext(
  items: TreeItem[],
  targetId: string,
  parent: TreeItem | null = null,
): { parent: TreeItem | null; siblings: TreeItem[]; index: number } | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === targetId) {
      return { parent, siblings: items, index: i }
    }
    if (items[i].children) {
      const found = findContext(items[i].children!, targetId, items[i])
      if (found) return found
    }
  }
  return null
}

const keyHandlers: Record<string, (currentId: string) => void> = {
  Escape(currentId) {
    const base = currentId.split(':')[0]
    const ctx = findContext(allItems, base)
    if (ctx?.parent) {
      selectedId.set(ctx.parent.id)
    }
  },

  ArrowDown(currentId) {
    const base = currentId.split(':')[0]
    const ctx = findContext(allItems, base)
    if (!ctx) return
    const { siblings, index } = ctx
    const nextIndex = (index + 1) % siblings.length
    selectedId.set(siblings[nextIndex].id)
  },

  ArrowUp(currentId) {
    const base = currentId.split(':')[0]
    const ctx = findContext(allItems, base)
    if (!ctx) return
    const { siblings, index } = ctx
    const prevIndex = (index - 1 + siblings.length) % siblings.length
    selectedId.set(siblings[prevIndex].id)
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
