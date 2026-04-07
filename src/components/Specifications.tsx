import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'

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
    <AnimatePresence mode="wait">
      <motion.div
        key={nearestSpecId}
        className="flex flex-col gap-3"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
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
      </motion.div>
    </AnimatePresence>
  )
}
