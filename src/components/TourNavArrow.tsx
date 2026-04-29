import { NextArrow12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'

/** Large floating prev/next arrow used by both the standard and video tours. */
export function TourNavArrow({
  direction,
  pos,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  /** Tailwind class for horizontal position. Defaults to `left-4` / `right-4`. */
  pos?: string
  disabled?: boolean
  onClick: () => void
}) {
  const Icon = direction === 'prev' ? PrevArrow12Icon : NextArrow12Icon
  const defaultPos = direction === 'prev' ? 'left-4' : 'right-4'
  return (
    <button
      className={`target-16 max-1000:top-[calc(50%-100px)] pointer-events-auto absolute top-1/2 ${pos ?? defaultPos} z-30 -translate-y-1/2 rounded-md text-center hover:bg-neutral-800/30 hover:backdrop-blur-sm disabled:pointer-events-none disabled:opacity-15`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="m-1 size-6" />
    </button>
  )
}
