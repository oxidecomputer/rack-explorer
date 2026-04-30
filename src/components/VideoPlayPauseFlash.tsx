import { useValue } from '@tldraw/state-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'

import { playPauseFlash } from '../atoms'

const ICON_PX = 56

function PlayIcon() {
  return (
    <svg width={ICON_PX} height={ICON_PX} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l10.7-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width={ICON_PX} height={ICON_PX} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  )
}

export function VideoPlayPauseFlash() {
  const flash = useValue(playPauseFlash)

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => {
      // Only clear if this is still the same flash (avoid clobbering a newer one).
      if (playPauseFlash.get()?.key === flash.key) playPauseFlash.set(null)
    }, 600)
    return () => window.clearTimeout(t)
  }, [flash])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-default/40 text-default absolute inset-0 m-auto flex h-24 w-24 items-center justify-center rounded-xl"
          >
            {flash.isPlaying ? <PlayIcon /> : <PauseIcon />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
