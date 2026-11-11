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
import { useThree } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef, type ReactElement } from 'react'

import { panelBlurActive } from '../atoms'
import { onBlurRegionsChange, setBlurCanvas } from './canvasBlur'
import { sharedComposerRef } from './composerRef'
import { PanelBlurEffect, type PanelBlurQuality } from './PanelBlurEffect'
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
  panelBlurQuality = 'high',
  multisampling = 0,
}: {
  aoQuality: AOQuality
  enableOutline?: boolean
  /** Resolution of the frosted-panel blur (see canvasBlur.ts). */
  panelBlurQuality?: PanelBlurQuality
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

  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  // Frosts the canvas behind registered DOM panels, on every tier: it's three
  // small passes in a composer that runs anyway.
  const panelBlur = useMemo(() => new PanelBlurEffect(panelBlurQuality), [panelBlurQuality])
  useEffect(() => {
    setBlurCanvas(gl.domElement)
    panelBlur.setBackground(getComputedStyle(document.body).backgroundColor)
    panelBlurActive.set(true)
    // Panels move without the scene changing (sidebar toggles, resizes); redraw.
    const unsubscribe = onBlurRegionsChange(invalidate)
    invalidate()
    return () => {
      unsubscribe()
      panelBlurActive.set(false)
      setBlurCanvas(null)
      panelBlur.dispose()
    }
  }, [panelBlur, gl, invalidate])

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

  // Last, so it blurs the finished frame (AO included).
  effects.push(<primitive key="panel-blur" object={panelBlur} dispose={null} />)

  // No enableNormalPass: N8AO reconstructs normals from the composer's depth
  // texture and never reads the NormalPass, which would otherwise re-render
  // the whole scene every frame for nothing.
  return (
    <EffectComposer ref={setSharedComposer} autoClear={false} multisampling={multisampling}>
      {effects}
    </EffectComposer>
  )
}
