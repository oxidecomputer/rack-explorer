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
import { useContext, useEffect, useRef, type ReactElement } from 'react'

import { sharedComposerRef } from './composerRef'
import { SelectedObjectsContext } from './selectedObjects'

export type AOQuality = 'full' | 'low' | 'off'

// Stable identity — passing an inline arrow would force EffectComposer's
// internal useImperativeHandle to tear down and re-attach on every re-render
// of PostProcessing.
const setSharedComposer = (composer: PPEffectComposer | null) => {
  sharedComposerRef.current = composer
}

// N8AO turns on "transparency aware" mode (and keeps it on) as soon as any
// transparent material is in the scene — here the floor grid, rack shadow and
// hitboxes. That mode adds two extra scene renders into full-res half-float
// targets, two depth copies and four scene traversals every frame. None of our
// transparent objects need AO-correct compositing, so opt out. Setting
// `configuration.transparencyAware = false` alone is a no-op (it already
// starts false and the setter only reacts to changes), hence the direct flag.
const disableAOTransparencyDetection = (
  pass: { autoDetectTransparency: boolean } | null,
) => {
  if (pass) pass.autoDetectTransparency = false
}

export const PostProcessing = ({
  aoQuality,
  enableOutline = true,
  multisampling = 0,
}: {
  aoQuality: AOQuality
  enableOutline?: boolean
  // Composer MSAA samples; 0 disables it. Probed by the caller (probeMaxSamples)
  // so it never exceeds what the GPU can allocate at this resolution.
  multisampling?: number
}) => {
  const outlineRef = useRef<OutlineEffect>(null)
  const patched = useRef(false)
  const selected = useContext(SelectedObjectsContext)

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
        ref={disableAOTransparencyDetection}
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
        selection={selected}
        edgeStrength={2.5}
        blendFunction={BlendFunction.ALPHA}
        visibleEdgeColor={4773271}
        hiddenEdgeColor={4773271}
        resolutionScale={0.5}
      />,
    )
  }

  // No enableNormalPass: N8AO reconstructs normals from the composer's depth
  // texture and never reads the NormalPass, which would otherwise re-render
  // the whole scene every frame for nothing.
  return (
    <EffectComposer ref={setSharedComposer} autoClear={false} multisampling={multisampling}>
      {effects}
    </EffectComposer>
  )
}
