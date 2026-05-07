import { useValue } from '@tldraw/state-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pane } from 'tweakpane'

import { debugMode, hdriRotationX, hdriRotationY, hdriRotationZ } from '../atoms'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

export function DebugPanel() {
  const isDebug = useValue(debugMode)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDebug || !containerRef.current) return
    const pane = new Pane({ container: containerRef.current, title: 'Debug' })

    const env = pane.addFolder({ title: 'HDRI Rotation' })
    const params = {
      x: hdriRotationX.get() * RAD_TO_DEG,
      y: hdriRotationY.get() * RAD_TO_DEG,
      z: hdriRotationZ.get() * RAD_TO_DEG,
    }
    env
      .addBinding(params, 'x', { label: 'X°', min: -180, max: 180, step: 1 })
      .on('change', (ev) => hdriRotationX.set(ev.value * DEG_TO_RAD))
    env
      .addBinding(params, 'y', { label: 'Y°', min: 0, max: 360, step: 1 })
      .on('change', (ev) => hdriRotationY.set(ev.value * DEG_TO_RAD))
    env
      .addBinding(params, 'z', { label: 'Z°', min: -180, max: 180, step: 1 })
      .on('change', (ev) => hdriRotationZ.set(ev.value * DEG_TO_RAD))

    return () => {
      pane.dispose()
    }
  }, [isDebug])

  if (!isDebug) return null
  // Portal to body so we escape the Scene's stacking context (motion opacity
  // creates one, which traps z-index values inside it).
  return createPortal(
    <div ref={containerRef} className="fixed top-14 right-4 z-100 w-64" />,
    document.body,
  )
}
