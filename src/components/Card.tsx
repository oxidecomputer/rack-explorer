import { NextArrow12Icon } from '@oxide/design-system/icons/react'
import clsx from 'clsx'
import { motion } from 'motion/react'

export const Card = ({
  title,
  children,
  open,
  onClick,
}: {
  title: string
  children: React.ReactNode
  open?: boolean
  onClick?: () => void
}) => {
  return (
    <motion.div
      initial={false}
      animate={{
        height: open ? '100%' : 32,
      }}
      transition={{ type: 'spring', duration: 0.325, bounce: 0 }}
      className="bg-default/80 flex flex-col overflow-hidden rounded-md backdrop-blur-lg"
    >
      <button
        onClick={onClick}
        disabled={!onClick}
        className={clsx(
          'text-mono-xs text-secondary flex w-full items-center justify-between px-2.5 py-2',
          onClick && 'hover:bg-hover cursor-pointer',
          !onClick && 'cursor-default',
        )}
      >
        {title}
        {onClick && (
          <NextArrow12Icon
            className={clsx('text-tertiary transition-transform', open ? 'rotate-90' : '')}
          />
        )}
      </button>
      <div className="border-secondary h-full overflow-x-hidden overflow-y-auto border-t p-3 text-nowrap">
        {children}
      </div>
    </motion.div>
  )
}
