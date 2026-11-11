/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useValue } from '@tldraw/state-react'
import { useCallback } from 'react'

import { panelBlurActive } from '../atoms'

// Frosted panels without CSS backdrop-filter. A backdrop-filter over the WebGL
// canvas makes the browser re-composite and re-blur everything behind each
// panel on every frame the scene redraws (~2.6ms GPU at 2x DPR on an M4 Max,
// more than the scene itself). Instead, panels register here, and
// PanelBlurEffect blurs the rendered frame inside their rects as part of the
// post-processing pass it already runs. The panels keep their translucent tint.
//
// Regions are measured from the DOM only when something may have moved (a
// style/class/childList mutation, a resize), and the canvas is asked to
// redraw when they change, so `frameloop="demand"` keeps working.

export const MAX_BLUR_REGIONS = 8

/** Latest measured regions, in CSS px relative to the canvas, y up (GL
 *  convention). Read by PanelBlurEffect each frame. */
export const blurRegions = {
  count: 0,
  /** x, y, width, height per region. */
  rects: new Float32Array(MAX_BLUR_REGIONS * 4),
  /** Corner radius (CSS px), opacity per region. */
  styles: new Float32Array(MAX_BLUR_REGIONS * 2),
}

type Entry = {
  el: HTMLElement
  /** Ancestors that clip (overflow other than visible). */
  clips: HTMLElement[]
  /** The element and its ancestors, whose opacities multiply. */
  fades: HTMLElement[]
}

const entries = new Set<Entry>()
const listeners = new Set<() => void>()
let canvas: HTMLCanvasElement | null = null
let observer: MutationObserver | null = null
let pollQueued = false

const nextRects = new Float32Array(MAX_BLUR_REGIONS * 4)
const nextStyles = new Float32Array(MAX_BLUR_REGIONS * 2)

function schedulePoll() {
  if (pollQueued) return
  pollQueued = true
  requestAnimationFrame(poll)
}

function poll() {
  pollQueued = false
  let count = 0
  if (canvas) {
    const c = canvas.getBoundingClientRect()
    for (const entry of entries) {
      if (count === MAX_BLUR_REGIONS) break
      const r = entry.el.getBoundingClientRect()
      let left = r.left
      let top = r.top
      let right = r.right
      let bottom = r.bottom
      for (const clip of entry.clips) {
        const cr = clip.getBoundingClientRect()
        left = Math.max(left, cr.left)
        top = Math.max(top, cr.top)
        right = Math.min(right, cr.right)
        bottom = Math.min(bottom, cr.bottom)
      }
      if (right - left < 1 || bottom - top < 1) continue

      let opacity = 1
      for (const el of entry.fades) {
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden') opacity = 0
        else opacity *= Number(style.opacity)
        if (opacity < 0.01) break
      }
      if (opacity < 0.01) continue

      const style = getComputedStyle(entry.el)
      const i = count * 4
      nextRects[i] = left - c.left
      nextRects[i + 1] = c.bottom - bottom
      nextRects[i + 2] = right - left
      nextRects[i + 3] = bottom - top
      nextStyles[count * 2] = parseFloat(style.borderTopLeftRadius) || 0
      nextStyles[count * 2 + 1] = opacity
      count++
    }
  }

  let changed = count !== blurRegions.count
  for (let i = 0; !changed && i < count * 4; i++) {
    if (Math.abs(nextRects[i] - blurRegions.rects[i]) > 0.25) changed = true
  }
  for (let i = 0; !changed && i < count * 2; i++) {
    if (Math.abs(nextStyles[i] - blurRegions.styles[i]) > 0.005) changed = true
  }
  if (!changed) return
  blurRegions.count = count
  blurRegions.rects.set(nextRects)
  blurRegions.styles.set(nextStyles)
  for (const listener of listeners) listener()
}

function start() {
  observer = new MutationObserver(schedulePoll)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden'],
  })
  window.addEventListener('resize', schedulePoll)
}

function stop() {
  observer?.disconnect()
  observer = null
  window.removeEventListener('resize', schedulePoll)
}

/** Track `el` as a frosted region. Returns the unregister function. */
export function registerBlurRegion(el: HTMLElement): () => void {
  const clips: HTMLElement[] = []
  const fades: HTMLElement[] = [el]
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const style = getComputedStyle(a)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(a)
    fades.push(a)
  }
  const entry: Entry = { el, clips, fades }
  if (entries.size === 0) start()
  entries.add(entry)
  schedulePoll()
  return () => {
    entries.delete(entry)
    if (entries.size === 0) stop()
    schedulePoll()
  }
}

/** Ref callback that frosts the element's area of the canvas while mounted. */
export function useCanvasBlur<T extends HTMLElement>() {
  return useCallback((el: T | null) => (el ? registerBlurRegion(el) : undefined), [])
}

/** For a panel over the canvas: a ref that frosts the canvas behind it, and
 *  whether that's happening (so the panel can use a translucent tint, or a
 *  near-opaque fallback when the WebGL blur isn't running). */
export function useFrostedPanel<T extends HTMLElement>(): [
  (el: T | null) => void,
  boolean,
] {
  return [useCanvasBlur<T>(), useValue(panelBlurActive)]
}

/** The canvas the regions are measured against. */
export function setBlurCanvas(el: HTMLCanvasElement | null) {
  canvas = el
  schedulePoll()
}

/** Called whenever the measured regions change. Returns the unsubscribe. */
export function onBlurRegionsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
