import {
  Action16Icon,
  Cpu16Icon,
  LoadBalancer16Icon,
  Networking16Icon,
  Ram16Icon,
  Servers16Icon,
} from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { type ReactNode } from 'react'

import { hoveredId, selectedId } from '../atoms'
import {
  componentTree,
  inheritInstanceIndex,
  type ComponentNode,
} from '../data/componentTree'

/** Map component IDs to icons for the outline */
const iconMap: Record<string, ReactNode> = {
  'oxide-rack': null /*todo: add icons */,
  'compute-sled': <Servers16Icon />,
  'compute-inner': null,
  'switch-inner': null,
  disks: null,
  cpu: <Cpu16Icon />,
  ram: <Ram16Icon />,
  fans: null,
  'power-connectors': null,
  'network-connectors': null,
  'airflow-shroud': null,
  'network-switch': <Networking16Icon />,
  'power-shelf': <Action16Icon />,
  'patch-panel': <LoadBalancer16Icon />,
}

const baseId = (id: string) => id.split(':')[0]

const isSelected = (id: string, sid: string | null): boolean => {
  if (!sid) return false
  return id === sid || id === baseId(sid)
}

const hasSelectedDescendant = (node: ComponentNode, sid: string | null): boolean => {
  if (isSelected(node.id, sid)) return true
  if (!node.children) return false
  return node.children.some((child) => hasSelectedDescendant(child, sid))
}

function OutlineItem({
  node,
  level = 0,
  hideChildren = false,
}: {
  node: ComponentNode
  level?: number
  hideChildren?: boolean
}) {
  const currentSelectedId = useValue(selectedId)
  const currentHoveredId = useValue(hoveredId)
  const hasChildren = node.children && node.children.length > 0
  const selected = isSelected(node.id, currentSelectedId)
  const hovered = node.id === currentHoveredId
  const shouldShowChildren =
    !hideChildren && hasChildren && hasSelectedDescendant(node, currentSelectedId)
  const icon = iconMap[node.id]

  return (
    <>
      <button
        onClick={() => {
          selectedId.set(inheritInstanceIndex(selectedId.get(), node.id))
        }}
        onMouseEnter={() => hoveredId.set(node.id)}
        onMouseLeave={() => hoveredId.set(null)}
        className={clsx(
          'text-sans-sm group relative flex w-full items-center px-2 text-left',
        )}
      >
        <div
          className={clsx(
            'absolute inset-y-0 right-0 w-58 rounded opacity-0 transition-opacity',
            (hovered || selected) && 'opacity-11',
            selected && hovered && 'opacity-20',
            selected ? 'bg-accent-inverse' : 'bg-neutral-700',
          )}
        />
        <div className="relative flex w-full">
          <div className="flex items-center gap-1.5 py-1.25">
            {icon && (
              <span className={selected ? 'text-accent' : 'text-quaternary'}>{icon}</span>
            )}
            <span className={selected ? 'text-accent' : 'text-secondary'}>
              {node.label}
            </span>
          </div>
        </div>
      </button>
      {shouldShowChildren && (
        <div className="border-default mx-2 flex w-full flex-col gap-0.5 border-l px-2">
          {node.children!.map((child) => (
            <OutlineItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </>
  )
}

/** The top-level children (everything under oxide-rack) for use in breadcrumbs / nav */
const outlineItems = componentTree.children ?? []

export function Outline() {
  return (
    <>
      <OutlineItem node={componentTree} hideChildren />
      <div className="my-1 h-px w-full bg-(--stroke-secondary)" />
      <div className="flex flex-col gap-0.5">
        {outlineItems.map((item) => (
          <OutlineItem key={item.id} node={item} />
        ))}
      </div>
    </>
  )
}
