import {
  Action16Icon,
  Cpu16Icon,
  Gateway16Icon,
  Images16Icon,
  Instances16Icon,
  LoadBalancer16Icon,
  Networking16Icon,
  Ram16Icon,
  Servers16Icon,
  Ssd16Icon,
} from '@oxide/design-system/icons/react'
import clsx from 'clsx'
import { type ReactNode } from 'react'
import { useValue } from '@tldraw/state-react'
import { selectedId, hoveredId } from '../atoms'

type OutlineItemProps = {
  label: string
  icon?: ReactNode
  level?: number
  children?: OutlineItemProps[]
  id: string
}

const isSelected = (id: string, selectedId: string | null): boolean => {
  return id === selectedId
}

const hasSelectedDescendant = (
  item: OutlineItemProps,
  selectedId: string | null,
): boolean => {
  if (item.id === selectedId) return true
  if (!item.children) return false
  return item.children.some((child) => hasSelectedDescendant(child, selectedId))
}

function OutlineItem({ level = 0, label, icon, children, id }: OutlineItemProps) {
  const currentSelectedId = useValue(selectedId)
  const currentHoveredId = useValue(hoveredId)
  const hasChildren = children && children.length > 0
  const selected = isSelected(id, currentSelectedId)
  const hovered = id === currentHoveredId
  const shouldShowChildren =
    hasChildren && hasSelectedDescendant({ id, label, icon, children }, currentSelectedId)

  return (
    <>
      <button
        onClick={() => selectedId.set(id)}
        onMouseEnter={() => hoveredId.set(id)}
        onMouseLeave={() => hoveredId.set(null)}
        className={clsx(
          'text-sans-sm group relative flex w-full items-center px-2 text-left',
        )}
      >
        <div
          className={clsx(
            'absolute inset-y-0 right-0 w-50 rounded opacity-0 transition-opacity',
            (hovered || selected) && 'opacity-11',
            selected && hovered && 'opacity-20',
            selected ? 'bg-accent' : 'bg-neutral-700',
          )}
        />
        <div className="relative flex w-full">
          <div className="flex items-center gap-1.5 py-1.25">
            {icon && (
              <span className={selected ? 'text-accent' : 'text-quaternary'}>{icon}</span>
            )}
            <span className={selected ? 'text-accent' : 'text-secondary'}>{label}</span>
          </div>
        </div>
      </button>
      {shouldShowChildren && (
        <div className="border-default mx-2 flex w-full flex-col gap-0.5 border-l px-2">
          {children.map((child, i) => (
            <OutlineItem key={i} {...child} level={level + 1} />
          ))}
        </div>
      )}
    </>
  )
}

export const outlineItems: OutlineItemProps[] = [
  {
    id: 'compute-sled',
    label: 'Compute Sled',
    icon: <Servers16Icon />,
    children: [
      {
        id: 'disk-group',
        label: 'Disk',
        icon: <Ssd16Icon />,
        children: [
          { id: 'disk', label: 'Disk', icon: <Action16Icon /> },
          { id: 'cpu-nested', label: 'CPU', icon: <Cpu16Icon /> },
        ],
      },
      { id: 'cpu', label: 'CPU', icon: <Cpu16Icon /> },
      { id: 'ram', label: 'RAM', icon: <Ram16Icon /> },
      { id: 'fans', label: 'Fans', icon: <Instances16Icon /> },
      { id: 'connectors', label: 'Connectors', icon: <Images16Icon /> },
      { id: 'airflow-shroud', label: 'Airflow Shroud', icon: <Gateway16Icon /> },
    ],
  },
  { id: 'network-switch', label: 'Network Switch', icon: <Networking16Icon /> },
  { id: 'power-shelf', label: 'Power Shelf', icon: <Action16Icon /> },
  { id: 'patch-panel', label: 'Patch Panel', icon: <LoadBalancer16Icon /> },
]

export function Outline() {
  return (
    <>
      <OutlineItem label="Oxide Rack" icon={<Servers16Icon />} id="oxide-rack" />
      <div className="my-1 h-px w-full bg-(--stroke-secondary)" />
      <div className="flex flex-col gap-0.5">
        {outlineItems.map((item, i) => (
          <OutlineItem key={i} {...item} />
        ))}
      </div>
    </>
  )
}
