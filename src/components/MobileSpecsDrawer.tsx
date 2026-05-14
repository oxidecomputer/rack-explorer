import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'

import { isVideoTour, lowTierRendering, navigationMode, tourStartScreen } from '../atoms'
import { GuidedTourPanel } from './GuidedTourPanel'
import { Specifications } from './Specifications'

export const MOBILE_SPECS_PANEL_HEIGHT = 200

export function MobileSpecsDrawer() {
  const isGuided = useValue(navigationMode) === 'guided'
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const isLowTier = useValue(lowTierRendering)

  if (isVideo || (isGuided && isStartScreen)) return null

  const isStandardTour = isGuided && !isVideo

  return (
    <div
      className={clsx(
        '1000:hidden border-secondary 1000:overflow-y-auto pointer-events-auto absolute right-0 bottom-0 left-0 z-30 border-t',
        isLowTier ? 'bg-default' : 'bg-default/90 backdrop-blur-md',
      )}
      style={{
        height: `calc(${MOBILE_SPECS_PANEL_HEIGHT}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="h-full px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isStandardTour ? <GuidedTourPanel /> : <Specifications />}
      </div>
    </div>
  )
}
