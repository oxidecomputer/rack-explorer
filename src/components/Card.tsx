/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'

import { lowTierRendering } from '../atoms'

export const Card = ({
  title,
  contentKey,
  children,
}: {
  title: React.ReactNode
  contentKey?: string
  children: React.ReactNode
}) => {
  const isLowTier = useValue(lowTierRendering)
  return (
    <div
      className={clsx(
        'flex min-h-0 w-64 flex-1 flex-col overflow-hidden rounded-md select-none',
        isLowTier ? 'bg-default/95' : 'bg-default/70 backdrop-blur-md',
      )}
    >
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
