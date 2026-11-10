/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { createContext } from 'react'
import type * as THREE from 'three'

export const NO_SELECTION: THREE.Object3D[] = []

/** Meshes currently selected for the outline effect. Provided by
 *  ModifiedSelection, read by PostProcessing and handed to <Outline selection>. */
export const SelectedObjectsContext =
  /* @__PURE__ */ createContext<THREE.Object3D[]>(NO_SELECTION)
