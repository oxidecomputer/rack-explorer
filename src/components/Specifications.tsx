import { useValue } from '@tldraw/state-react'
import * as R from 'remeda'

import { selectedId } from '../atoms'
import { specifications } from '../data/specifications'
import { outlineItems } from './Outline'

type OutlineItem = {
  label: string
  id: string
  children?: OutlineItem[]
}

function flattenItems(items: OutlineItem[]): OutlineItem[] {
  return R.flatMap(items, (item) => [
    item,
    ...(item.children ? flattenItems(item.children) : []),
  ])
}

function findAncestors(id: string | null, items: OutlineItem[]): string[] {
  if (!id) return []
  // Strip instance index (e.g. 'compute-sled:0' -> 'compute-sled')
  id = id.split(':')[0]

  const allItems = [{ id: 'oxide-rack', label: 'Oxide Rack', children: items }]
  const flat = flattenItems(allItems)

  const ancestors: string[] = [id]
  let currentId = id

  while (currentId) {
    const parent = flat.find((item) =>
      item.children?.some((child) => child.id === currentId),
    )
    if (!parent) break
    ancestors.push(parent.id)
    currentId = parent.id
  }

  return ancestors
}

export const Specifications = () => {
  const currentSelectedId = useValue(selectedId)

  const ancestors = findAncestors(currentSelectedId, outlineItems)
  const nearestSpecId = ancestors.find((id) => specifications[id])
  const specs =
    specifications[nearestSpecId || 'oxide-rack'] || specifications['oxide-rack']

  return (
    <div className="flex flex-col gap-3">
      {specs.map((spec, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className="text-mono-xs text-quaternary uppercase">{spec.label}</div>
          <div className="text-sans-sm text-secondary">
            {Array.isArray(spec.value)
              ? spec.value.map((line, j) => <div key={j}>{line}</div>)
              : spec.value}
          </div>
        </div>
      ))}
    </div>
  )
}
