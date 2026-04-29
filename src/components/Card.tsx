import { AnimatePresence, motion } from 'motion/react'

export const Card = ({
  title,
  contentKey,
  children,
}: {
  title: React.ReactNode
  contentKey?: string
  children: React.ReactNode
}) => {
  return (
    <div className="bg-default/80 flex min-h-0 w-64 flex-1 flex-col overflow-hidden rounded-md backdrop-blur-md select-none">
      <div className="text-mono-xs text-secondary flex w-full items-center justify-between px-2.5 py-2">
        {title}
      </div>
      <div className="border-secondary h-full overflow-x-hidden overflow-y-auto border-t p-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={contentKey}
            className="h-full"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
