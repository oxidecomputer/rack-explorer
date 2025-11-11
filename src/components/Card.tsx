import { NextArrow12Icon } from '@oxide/design-system/icons/react'
import clsx from 'clsx'

export const Card = ({
  title,
  children,
  open,
}: {
  title: string
  children: React.ReactNode
  open?: boolean
}) => {
  return (
    <div className={clsx('bg-default overflow-hidden rounded-lg', open ? 'h-full' : 'h-8')}>
      <button className="text-mono-xs hover:bg-hover text-secondary flex w-full items-center justify-between px-2.5 py-2">
        {title}
        <NextArrow12Icon
          className={clsx('text-tertiary transition-transform', open ? 'rotate-90' : '')}
        />
      </button>
      {open && <div className="border-secondary border-t p-3">{children}</div>}
    </div>
  )
}
