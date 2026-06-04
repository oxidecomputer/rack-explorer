/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Button } from '@oxide/design-system/ui'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { DREAMDATA_COOKIED_SNIPPET, DREAMDATA_COOKIELESS_SNIPPET } from '../util/dreamdata'
import {
  acceptTracking,
  hasAcceptedTracking,
  hasTrackingChoice,
  rejectTracking,
} from '../util/tracking'
import { useValue } from '@tldraw/state-react'
import { lowTierRendering } from '../atoms'

function appendInlineScript(id: string, contents: string) {
  if (document.getElementById(id)) return

  const script = document.createElement('script')
  script.id = id
  script.innerHTML = contents
  document.body.appendChild(script)
}

function initCookielessTrackers() {
  appendInlineScript('init-dreamdata-cl', DREAMDATA_COOKIELESS_SNIPPET)
}

function initTrackers() {
  const script1 = document.createElement('script')
  script1.innerHTML = `_linkedin_partner_id = "6206948"; window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || []; window._linkedin_data_partner_ids.push(_linkedin_partner_id);`

  const script2 = document.createElement('script')
  script2.innerHTML = `(function(l) { if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])}; window.lintrk.q=[]} var s = document.getElementsByTagName("script")[0]; var b = document.createElement("script"); b.type = "text/javascript";b.async = true; b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js"; s.parentNode.insertBefore(b, s);})(window.lintrk);`

  // Strictly speaking, the noscript fallback is dead code here — this whole
  // function only runs from a user gesture in a React app, so JS is on. Kept
  // for parity with the LinkedIn-supplied snippet.
  const noScript = document.createElement('noscript')
  noScript.innerHTML = `<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=6206948&fmt=gif" />`

  document.body.appendChild(script1)
  document.body.appendChild(script2)
  document.body.appendChild(noScript)

  // Dreamdata's cookied snippet only loads here, after consent. Its IIFE
  // self-executes on insert and falls through to dreamdata.init() because we
  // don't seed dataLayer.
  appendInlineScript('init-dreamdata', DREAMDATA_COOKIED_SNIPPET)
}

const tinyButton = 'h-6 px-2! text-mono-xs py-1!'

// Only render when analytics is configured via VITE_ANALYTICS_DOMAIN at build
// time, matching the Plausible injection in vite.config.ts. Unset by default in
// dev and preview, so trackers don't load locally unless you opt in.
export function CookiePopup() {
  if (!import.meta.env.VITE_ANALYTICS_DOMAIN) return null
  return <CookiePopupInner />
}

function CookiePopupInner() {
  const [runTrackers, setRunTrackers] = useState(hasAcceptedTracking())
  const trackingInitialized = useRef(false)
  const isLowTier = useValue(lowTierRendering)

  useEffect(() => {
    // Skip for returning visitors who've already accepted: the cookied snippet
    // will load below, and per Dreamdata's docs the two trackers are alternates
    // routed by consent, not parallel pipelines. Loading both causes the
    // cookied tracker to start a session that the cookieless snippet's auto
    // page() then races, producing "cookieless event detected after session
    // started with anonymous ID" warnings.
    if (hasAcceptedTracking()) return
    initCookielessTrackers()
  }, [])

  useEffect(() => {
    // make sure we only ever do this once
    if (runTrackers && !trackingInitialized.current) {
      trackingInitialized.current = true
      initTrackers()
    }
  }, [runTrackers])

  // show popup only if cookie is not set
  const [show, setShow] = useState(!hasTrackingChoice())
  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie banner"
      className={clsx(
        'block w-64 rounded-md border border-neutral-900/10',
        isLowTier ? 'bg-default/60' : 'bg-default/25 backdrop-blur-md',
      )}
    >
      <div className="text-sans-sm m-3">
        <p>
          We use cookies to improve your experience and assist our marketing team.{' '}
          <a
            href="https://oxide.computer/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="text-secondary hover:text-raise underline"
          >
            Privacy policy
          </a>
        </p>
      </div>
      <hr className="border-neutral-900/10" />
      <div className="m-2 flex justify-end gap-2.5">
        <Button
          size="sm"
          variant="ghost"
          className={tinyButton}
          onClick={() => {
            rejectTracking()
            setShow(false)
          }}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className={tinyButton}
          onClick={() => {
            acceptTracking()
            setShow(false)
            setRunTrackers(true)
          }}
        >
          Accept
        </Button>
      </div>
    </div>
  )
}
