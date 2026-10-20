/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { OpenLink12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'

import { kioskMode } from '../atoms'
import { CTASkeleton } from './Skeletons'

/** QR code for https://oxide.computer/contact (error correction M, no quiet
 *  zone), drawn as one horizontal stroke per run of dark modules. */
const QR_PATH =
  'M0 0.5h7m1 0h1m8 0h2m1 0h1m1 0h7M0 1.5h1m5 0h1m9 0h2m1 0h2m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m2 0h3m1 0h1m1 0h5m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h5m1 0h3m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h2m1 0h1m1 0h1m3 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m2 0h5m1 0h3m2 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M8 7.5h1m5 0h1m2 0h2m1 0h1M0 8.5h1m3 0h1m1 0h4m2 0h6m1 0h7m2 0h1M0 9.5h1m1 0h1m1 0h1m4 0h1m1 0h1m5 0h2m3 0h7M1 10.5h3m1 0h3m1 0h2m2 0h3m2 0h1m3 0h2m4 0h1M2 11.5h4m2 0h1m3 0h2m1 0h4m1 0h1m1 0h1m2 0h1m1 0h2M0 12.5h4m1 0h2m4 0h3m3 0h1m1 0h1m7 0h1M1 13.5h1m2 0h2m3 0h1m1 0h1m1 0h2m1 0h3m3 0h7M3 14.5h1m1 0h2m1 0h3m5 0h1m1 0h1m1 0h1m4 0h2m1 0h1M5 15.5h1m2 0h5m1 0h1m2 0h1m2 0h2m1 0h2m2 0h2M1 16.5h1m1 0h4m4 0h7m1 0h1m1 0h1m5 0h1M0 17.5h1m1 0h1m1 0h2m1 0h2m2 0h2m9 0h4m1 0h2M2 18.5h1m1 0h3m2 0h2m2 0h3m1 0h2m2 0h3m2 0h1m1 0h1M3 19.5h2m2 0h1m1 0h2m1 0h2m1 0h3m5 0h2m2 0h2M0 20.5h2m1 0h4m2 0h1m1 0h3m3 0h1m1 0h7m2 0h1M8 21.5h7m1 0h1m1 0h1m1 0h1m3 0h1m3 0h1M0 22.5h7m1 0h2m1 0h1m4 0h2m1 0h2m1 0h1m1 0h3m1 0h1M0 23.5h1m5 0h1m3 0h3m1 0h1m2 0h4m3 0h1m2 0h1M0 24.5h1m1 0h3m1 0h1m1 0h1m3 0h4m1 0h1m1 0h7m1 0h2M0 25.5h1m1 0h3m1 0h1m2 0h1m3 0h1m4 0h1m1 0h2m1 0h1m3 0h1M0 26.5h1m1 0h3m1 0h1m4 0h1m1 0h1m1 0h2m2 0h3m3 0h4M0 27.5h1m5 0h1m4 0h1m2 0h2m1 0h2m1 0h1m3 0h2m1 0h2M0 28.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m2 0h4m1 0h1m1 0h1'

export function ContactSales({
  loading,
  className,
}: {
  loading?: boolean
  className?: string
}) {
  const isKiosk = useValue(kioskMode)

  // A kiosk can't follow links out, so hand visitors a QR code for their phone.
  // The hover styles callers pass are inert on touch devices.
  if (isKiosk && !loading) {
    return (
      <div className={clsx(className, 'flex items-center gap-3')}>
        <div className="min-w-0 grow">
          <div className="text-mono-xs text-tertiary">Contact Sales</div>
          <p className="text-default text-sans-sm mt-1 pr-1">
            Discuss your needs and business goals with our team of experts.
          </p>
        </div>
        <svg
          viewBox="0 0 29 29"
          shapeRendering="crispEdges"
          role="img"
          aria-label="QR code linking to oxide.computer/contact"
          className="text-secondary h-18 w-18 shrink-0"
        >
          <path stroke="currentColor" d={QR_PATH} />
        </svg>
      </div>
    )
  }

  return (
    <a href="https://oxide.computer/contact" target="_blank" className={className}>
      {loading ? (
        <CTASkeleton />
      ) : (
        <>
          <div className="text-mono-xs text-tertiary flex items-center justify-between">
            Contact Sales <OpenLink12Icon className="text-quaternary" />
          </div>
          <p className="text-default text-sans-sm mt-1 max-w-90 pr-2">
            Discuss your computing requirements and business goals with our team of experts.
          </p>
        </>
      )}
    </a>
  )
}
