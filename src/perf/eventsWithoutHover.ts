/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { events as createPointerEvents } from '@react-three/fiber'
import type { RootStore } from '@react-three/fiber/dist/declarations/src/core/store'

/** R3F event factory that limits raycasting to the three events the app
 *  actually consumes: click, dblclick, pointerdown. R3F's default raycasts
 *  on every event in its interaction set (pointermove, wheel, pointerup,
 *  contextmenu, etc.) regardless of whether any object has a handler for
 *  that specific event — this burns CPU on dense scenes. The wheel one is
 *  particularly bad: it fires continuously during camera dolly.
 *
 *  Reverting any of the no-ops below means callers in that event class will
 *  silently stop receiving R3F synthetic events. */
export const eventsWithoutHover = (store: RootStore) => {
  const e = createPointerEvents(store)
  if (e.handlers) {
    const noop = (() => {}) as EventListener
    e.handlers.onPointerMove = noop
    e.handlers.onPointerLeave = noop
    e.handlers.onPointerCancel = noop
    e.handlers.onPointerUp = noop
    e.handlers.onContextMenu = noop
    e.handlers.onWheel = noop
    e.handlers.onLostPointerCapture = noop
  }
  // `update` would re-fire a synthetic pointermove (used by things like camera
  // animations to refresh hover targets). We don't track hover, so it'd just
  // burn raycasts.
  return { ...e, update: undefined }
}
