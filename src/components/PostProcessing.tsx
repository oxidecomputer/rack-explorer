/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { EffectComposer, N8AO, Outline } from '@react-three/postprocessing'
import {
  BlendFunction,
  type EffectComposer as PPEffectComposer,
  type OutlineEffect,
} from 'postprocessing'
import { useEffect, useRef, type ReactElement } from 'react'

import { sharedComposerRef } from './composerRef'

export type AOQuality = 'full' | 'low' | 'off'

// Stable identity — passing an inline arrow would force EffectComposer's
// internal useImperativeHandle to tear down and re-attach on every re-render
// of PostProcessing.
const setSharedComposer = (composer: PPEffectComposer | null) => {
  sharedComposerRef.current = composer
}

export const PostProcessing = ({
  aoQuality,
  enableOutline = true,
}: {
  aoQuality: AOQuality
  enableOutline?: boolean
}) => {
  const outlineRef = useRef<OutlineEffect>(null)
  const patched = useRef(false)

  useEffect(() => {
    if (outlineRef.current && !patched.current) {
      // Skip the depth pass — it re-renders the entire scene to distinguish
      // visible vs hidden edges, but we use the same color for both.
      const depthPass = (
        outlineRef.current as unknown as { depthPass?: { render: () => void } }
      ).depthPass
      if (depthPass) {
        depthPass.render = () => {}
      }
      patched.current = true
    }
  }, [])

  const aoEnabled = aoQuality !== 'off'
  const isLow = aoQuality === 'low'

  const effects: ReactElement[] = []
  if (aoEnabled) {
    effects.push(
      <N8AO
        key="ao"
        color="black"
        denoiseSamples={isLow ? 2 : 4}
        denoiseRadius={isLow ? 6 : 12}
        distanceFalloff={0.5}
        aoRadius={0.1}
        intensity={3.3}
        halfRes
      />,
    )
  }
  if (enableOutline) {
    effects.push(
      <Outline
        key="outline"
        ref={outlineRef}
        edgeStrength={2.5}
        blendFunction={BlendFunction.ALPHA}
        visibleEdgeColor={4773271}
        hiddenEdgeColor={4773271}
        resolutionScale={0.5}
      />,
    )
  }

  return (
    <EffectComposer
      ref={setSharedComposer}
      enableNormalPass={aoEnabled}
      autoClear={false}
    >
      {effects}
    </EffectComposer>
  )
}
