import { useValue } from '@tldraw/state-react'

import { isVideoTour, navigationMode, tourStartScreen } from '../atoms'
import { GuidedTourPanel } from './GuidedTourPanel'
import { Specifications } from './Specifications'

export const MOBILE_SPECS_PANEL_HEIGHT = 160

export function MobileSpecsDrawer() {
  const isGuided = useValue(navigationMode) === 'guided'
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)

  if (isVideo || (isGuided && isStartScreen)) return null

  const isStandardTour = isGuided && !isVideo

  return (
    <div
      className="1000:hidden bg-default/90 border-secondary 1000:overflow-y-auto pointer-events-auto absolute right-0 bottom-0 left-0 z-30 border-t backdrop-blur-md"
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
