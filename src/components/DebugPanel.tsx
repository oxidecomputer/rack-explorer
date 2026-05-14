/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pane } from 'tweakpane'

import {
  debugMode,
  environmentIntensity,
  fitFractionMultiplier,
  hdriRotationX,
  hdriRotationY,
  hdriRotationZ,
  maxZoomMultiplier,
  requestCanvasExport,
  showcaseRotationSpeed,
  showHdriBackground,
  showHitboxes,
} from '../atoms'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

export function DebugPanel() {
  const isDebug = useValue(debugMode)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDebug || !containerRef.current) return
    const pane = new Pane({ container: containerRef.current, title: 'Debug' })

    const params = {
      hdriX: hdriRotationX.get() * RAD_TO_DEG,
      hdriY: hdriRotationY.get() * RAD_TO_DEG,
      hdriZ: hdriRotationZ.get() * RAD_TO_DEG,
      envIntensity: environmentIntensity.get(),
      fitMult: fitFractionMultiplier.get(),
      maxZoom: maxZoomMultiplier.get(),
      rotSpeed: showcaseRotationSpeed.get(),
      showHitboxes: showHitboxes.get(),
      showHdriBg: showHdriBackground.get(),
    }

    const hdri = pane.addFolder({ title: 'hdri rotation' })
    hdri
      .addBinding(params, 'hdriX', { label: 'x°', min: -180, max: 180, step: 1 })
      .on('change', (ev) => hdriRotationX.set(ev.value * DEG_TO_RAD))
    hdri
      .addBinding(params, 'hdriY', { label: 'y°', min: 0, max: 360, step: 1 })
      .on('change', (ev) => hdriRotationY.set(ev.value * DEG_TO_RAD))
    hdri
      .addBinding(params, 'hdriZ', { label: 'z°', min: -180, max: 180, step: 1 })
      .on('change', (ev) => hdriRotationZ.set(ev.value * DEG_TO_RAD))
    hdri
      .addBinding(params, 'showHdriBg', { label: 'show bg' })
      .on('change', (ev) => showHdriBackground.set(ev.value))

    const lighting = pane.addFolder({ title: 'lighting' })
    lighting
      .addBinding(params, 'envIntensity', {
        label: 'env intensity',
        min: 0,
        max: 6,
        step: 0.05,
      })
      .on('change', (ev) => environmentIntensity.set(ev.value))

    const camera = pane.addFolder({ title: 'camera' })
    camera
      .addBinding(params, 'fitMult', {
        label: 'fit ×',
        min: 0.5,
        max: 2,
        step: 0.01,
      })
      .on('change', (ev) => fitFractionMultiplier.set(ev.value))
    camera
      .addBinding(params, 'maxZoom', {
        label: 'max zoom ×',
        min: 1,
        max: 10,
        step: 0.1,
      })
      .on('change', (ev) => maxZoomMultiplier.set(ev.value))
    camera
      .addBinding(params, 'rotSpeed', {
        label: 'rot speed',
        min: 0,
        max: 1,
        step: 0.01,
      })
      .on('change', (ev) => showcaseRotationSpeed.set(ev.value))

    const overlays = pane.addFolder({ title: 'overlays' })
    overlays
      .addBinding(params, 'showHitboxes', { label: 'hitboxes' })
      .on('change', (ev) => showHitboxes.set(ev.value))

    const exportFolder = pane.addFolder({ title: 'export' })
    exportFolder
      .addButton({ title: 'save canvas (4×, transparent)' })
      .on('click', () => requestCanvasExport())

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
