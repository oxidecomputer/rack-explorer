import { useValue } from '@tldraw/state-react'

import { selectedId } from '../atoms'
import { getNode } from '../data/componentTree'
import { specifications } from '../data/specifications'

export const Specifications = () => {
  const currentSelectedId = useValue(selectedId)
  const baseId = currentSelectedId.split(':')[0]
  const entry = getNode(baseId)

  // Walk from self up through ancestors to find the nearest node with specs
  const candidates = entry ? [entry.node, ...entry.ancestors].map((n) => n.id) : []
  const nearestSpecId = candidates.find((id) => specifications[id]) ?? 'oxide-rack'
  const specs = specifications[nearestSpecId] ?? specifications['oxide-rack']

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
