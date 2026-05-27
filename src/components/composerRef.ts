/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { EffectComposer as PPEffectComposer } from 'postprocessing'

/** PostProcessing.tsx writes its EffectComposer ref here on mount and clears it
 *  on unmount, so the exporter can drive the same composer that's currently
 *  rendering the scene. Null when post-processing is disabled. */
export const sharedComposerRef: { current: PPEffectComposer | null } = { current: null }
