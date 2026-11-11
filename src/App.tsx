/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { Close8Icon, Question16Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

import {
  activeTour,
  activeTourStepIndex,
  activeVideoTour,
  activeVideoTourStepIndex,
  goToNextTour,
  goToTourStep,
  isVideoTour,
  kioskMode,
  maybeStartFreeTutorial,
  mobileOutlineOpen,
  navigationMode,
  restartFreeTutorial,
  sceneReady,
  seekVideo,
  selectedId,
  setKioskMode,
  sidebarTab,
  specificationsOpen,
  startConfigure,
  startIdleTour,
  startTour,
  tourStartScreen,
} from './atoms'
import { IdleTourOverlay } from './components/IdleTourOverlay'
import { useFrostedPanel } from './components/canvasBlur'
import { Card } from './components/Card'
import {
  ConfiguratorPanel,
  ConfiguratorSummary,
  RackCountStepper,
} from './components/Configurator'
import { ContactSales } from './components/ContactSales'
import { CookiePopup } from './components/CookiePopup'
import { FreeTutorial } from './components/FreeTutorial'
import { GuidedTourOutline } from './components/GuidedTourOutline'
import { GuidedTourPanel } from './components/GuidedTourPanel'
import { SidebarIcon } from './components/Icons'
import { MobileOutlineOverlay } from './components/MobileOutlineOverlay'
import { MobileSpecsDrawer } from './components/MobileSpecsDrawer'
import { OptionsDropdown } from './components/OptionsDropdown'
import { Outline } from './components/Outline'
import { PerformanceNotice } from './components/PerformanceNotice'
import { SidebarTabs, TourCard } from './components/SidebarNav'
import { Bar, OutlineSkeleton, SpecificationsSkeleton } from './components/Skeletons'
import { Specifications } from './components/Specifications'
import { StepPips } from './components/StepPips'
import { TourNavArrow } from './components/TourNavArrow'
import { TourStartScreen } from './components/TourStartScreen'
import { VideoCaptions } from './components/VideoCaptions'
import { VideoPlayPauseFlash } from './components/VideoPlayPauseFlash'
import { VideoTourPlayer } from './components/VideoTourPlayer'
import { VideoTourTimeline } from './components/VideoTourTimeline'
import { getNode, inheritInstanceIndex } from './data/componentTree'
import { getFirstStandardTour, getTour } from './data/guidedTours'
import { Scene } from './Scene'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { useKiosk } from './useKiosk'

// Deep link: `?tour=<id>` jumps straight into the named tour. Runs at module load — before the first React render — so the
// initial paint already reflects the tour state and the right sidebar doesn't
// animate from "open" to "hidden". The param is stripped so a refresh doesn't
// trap the user in it.
{
  const url = new URL(window.location.href)
  const tourId = url.searchParams.get('tour')
  if (tourId) {
    const tour = getTour(tourId)
    if (tour) startTour(tour.id)
    url.searchParams.delete('tour')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
}

// Deep link: `?configure` opens the rack configurator. Stripped like `?tour=`.
{
  const url = new URL(window.location.href)
  if (url.searchParams.has('configure')) {
    startConfigure()
    url.searchParams.delete('configure')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
}

// `?kiosk=1` / `?kiosk=0` turns kiosk mode on or off (persisted), then the
// param is stripped. A kiosk boots straight into the idle tour, unless a deep
// link already chose where to start.
{
  const url = new URL(window.location.href)
  const kiosk = url.searchParams.get('kiosk')
  if (kiosk !== null) {
    setKioskMode(kiosk !== '0')
    url.searchParams.delete('kiosk')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
  if (kioskMode.get() && navigationMode.get() === 'free') startIdleTour()
}

/** Kiosk mode's exit hatch: the header (and Options with it) is hidden from
 *  visitors, so holding the top-left corner for this long turns kiosk mode off. */
const KIOSK_EXIT_HOLD_MS = 3_000

function findPath(targetId: string | null): { id: string; label: string }[] | null {
  if (!targetId) return null

  const [base, indexStr] = targetId.split(':')
  const entry = getNode(base)
  if (!entry) return null

  // Build path from ancestors + self (skip root since breadcrumb always shows "Cloud Computer")
  const path = [...entry.ancestors.slice(1), entry.node].map((n) => ({
    id: n.id,
    label: n.label,
  }))

  // Append instance index to the instanced ancestor's label
  if (indexStr != null) {
    for (let i = 0; i < path.length; i++) {
      const node = getNode(path[i].id)
      if (node?.node.instances) {
        path[i] = { ...path[i], label: `${path[i].label} ${indexStr}` }
        break
      }
    }
  }

  return path
}

function App() {
  const currentNavigationMode = useValue(navigationMode)
  const specsOpen = useValue(specificationsOpen)
  const currentSelectedId = useValue(selectedId)
  const isSceneReady = useValue(sceneReady)
  // Panels show skeletons until the scene has loaded.
  const isLoading = !isSceneReady
  const currentTour = useValue(activeTour)
  const currentStepIndex = useValue(activeTourStepIndex)
  const currentVideoTour = useValue(activeVideoTour)
  const currentVideoStepIndex = useValue(activeVideoTourStepIndex)
  const isGuided = currentNavigationMode === 'guided'
  const isConfigure = currentNavigationMode === 'configure'
  const isFree = currentNavigationMode === 'free'
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const isStandardTour = isGuided && !isVideo
  const isKiosk = useValue(kioskMode)
  const currentTab = useValue(sidebarTab)
  const exitHoldTimer = useRef<number | null>(null)

  const cancelExitHold = () => {
    if (exitHoldTimer.current !== null) window.clearTimeout(exitHoldTimer.current)
    exitHoldTimer.current = null
  }

  const handleVideoSkipPrev = useCallback(() => {
    if (!currentVideoTour) return
    const prevIndex = Math.max(0, currentVideoStepIndex - 1)
    seekVideo(currentVideoTour.steps[prevIndex].timestamp)
  }, [currentVideoTour, currentVideoStepIndex])

  const handleVideoSkipNext = useCallback(() => {
    if (!currentVideoTour) return
    if (currentVideoStepIndex === currentVideoTour.steps.length - 1) {
      goToNextTour()
      return
    }
    const nextIndex = currentVideoStepIndex + 1
    seekVideo(currentVideoTour.steps[nextIndex].timestamp)
  }, [currentVideoTour, currentVideoStepIndex])

  const toggleSpecifications = () => {
    specificationsOpen.set(!specsOpen)
  }

  // Panels over the canvas frosted by PanelBlurEffect (see canvasBlur.ts).
  const [timelineFrostRef, frosted] = useFrostedPanel<HTMLDivElement>()
  const [contactFrostRef] = useFrostedPanel<HTMLElement>()

  useKeyboardNavigation()
  useKiosk()

  // Mobile only has guided tours. On mount and on any resize that drops
  // below the breakpoint, push users out of free explore into the first tour.
  useEffect(() => {
    const mm = window.matchMedia('(min-width: 1000px)')
    const apply = () => {
      if (mm.matches) return
      // Free explore and the configurator are desktop-only.
      if (navigationMode.get() === 'guided') return
      startTour(getFirstStandardTour().id)
    }
    apply()
    mm.addEventListener('change', apply)
    return () => mm.removeEventListener('change', apply)
  }, [])

  // First visit on desktop: once the scene is up, point out the controls.
  useEffect(() => {
    if (!isSceneReady || navigationMode.get() !== 'free') return
    if (!window.matchMedia('(min-width: 1000px)').matches) return
    const timer = window.setTimeout(maybeStartFreeTutorial, 400)
    return () => window.clearTimeout(timer)
  }, [isSceneReady])

  const breadcrumbPath = findPath(currentSelectedId)

  const breadcrumbsEnabled = isFree

  return (
    <MotionConfig reducedMotion="user">
      <h1 className="sr-only">Oxide Cloud Computer 3D Explorer</h1>
      <motion.div
        className="fixed top-0 left-0 h-dvh w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: isSceneReady ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Scene />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 flex h-dvh flex-col">
        {/* Hidden kiosk exit hatch */}
        {isKiosk && (
          <div
            className="pointer-events-auto absolute top-0 left-0 z-60 h-16 w-16"
            onPointerDown={() => {
              cancelExitHold()
              exitHoldTimer.current = window.setTimeout(
                () => setKioskMode(false),
                KIOSK_EXIT_HOLD_MS,
              )
            }}
            onPointerUp={cancelExitHold}
            onPointerLeave={cancelExitHold}
            onPointerCancel={cancelExitHold}
          />
        )}

        {/* Kiosk mode drops the header on wide layouts, but the narrow layout
            (e.g. an iPad in portrait) keeps it for its "Open outline" button. */}
        <header
          className={clsx(
            'pointer-events-auto relative z-30 flex w-full items-center justify-between px-4 pt-4',
            isKiosk && '1000:hidden',
          )}
        >
          {/* No outbound link in kiosk mode */}
          <a
            className="group flex w-64 flex-col select-none"
            href={isKiosk ? undefined : 'https://oxide.computer'}
            target={isKiosk ? undefined : '_blank'}
          >
            <div className="text-raise text-mono-xs group-hover:text-raise group-hover:link-with-underline opacity-40">
              Oxide Computer Company
            </div>
            <div className="text-sans-sm text-default">3D Explorer</div>
          </a>
          {isConfigure && (
            <div className="text-mono-xs text-secondary max-1000:hidden flex flex-1 items-center justify-center select-none">
              Rack configurator
            </div>
          )}
          {isFree && (
            <div className="text-secondary max-1000:hidden flex flex-1 items-center justify-center gap-2 select-none">
              <button
                disabled={!breadcrumbsEnabled}
                onClick={() => {
                  selectedId.set('oxide-rack')
                }}
                className={clsx(
                  'text-mono-xs transition-colors',
                  breadcrumbsEnabled && 'hover:text-default',
                )}
              >
                Cloud Computer
              </button>
              {breadcrumbPath &&
                breadcrumbPath.length > 0 &&
                breadcrumbPath[0].label !== 'Cloud Computer' && (
                  <>
                    {breadcrumbPath.map((item, i) => {
                      const isLast = i === breadcrumbPath.length - 1
                      return (
                        <span key={item.id} className="flex items-center gap-2">
                          <span className="text-raise text-mono-xs opacity-20">/</span>
                          <div
                            className={clsx(
                              'flex items-center gap-2',
                              isLast
                                ? 'flex items-center gap-2 rounded-md bg-neutral-800/30 px-1'
                                : '',
                            )}
                          >
                            <button
                              disabled={!breadcrumbsEnabled || isLast}
                              onClick={() => {
                                selectedId.set(
                                  inheritInstanceIndex(selectedId.get(), item.id),
                                )
                              }}
                              className={clsx(
                                'text-mono-xs transition-colors',
                                isLast && 'text-default',
                                breadcrumbsEnabled && !isLast && 'hover:text-default',
                              )}
                            >
                              {item.label}
                            </button>
                            {isLast && breadcrumbsEnabled && (
                              <button
                                onClick={() => {
                                  const current = selectedId.get()
                                  const base = current.split(':')[0]
                                  const entry = getNode(base)
                                  const parentId = entry?.parent?.id ?? 'oxide-rack'
                                  selectedId.set(inheritInstanceIndex(current, parentId))
                                }}
                                className="text-tertiary target-4 hover:text-default -ml-1 transition-colors"
                                aria-label="Go up one level"
                              >
                                <Close8Icon />
                              </button>
                            )}
                          </div>
                        </span>
                      )
                    })}
                  </>
                )}
            </div>
          )}
          <div className="flex w-64 items-center justify-end gap-2">
            <OptionsDropdown />
            {isFree && (
              <button
                onClick={restartFreeTutorial}
                className="hover:bg-hover/80 target-8 max-1000:hidden text-tertiary hover:text-default flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-900/10 bg-transparent transition-colors"
                aria-label="Replay tutorial"
              >
                <Question16Icon className="h-4 w-4" />
              </button>
            )}
            {!(isGuided && isStartScreen) && (
              <button
                onClick={() => mobileOutlineOpen.set(true)}
                className="1000:hidden hover:bg-hover target-8 border-default rounded border p-1.5"
                aria-label="Open outline"
              >
                <SidebarIcon className="text-tertiary h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 grow p-4">
          <nav className="max-1000:hidden pointer-events-auto flex h-full flex-col gap-2">
            <Card
              title={
                isLoading ? (
                  <Bar className="h-3 w-28" />
                ) : (
                  <SidebarTabs />
                )
              }
              contentKey={isLoading ? 'skeleton' : currentTab}
            >
              {isLoading ? (
                <OutlineSkeleton />
              ) : currentTab === 'configure' ? (
                <ConfiguratorPanel />
              ) : currentTab === 'tours' ? (
                <GuidedTourOutline />
              ) : (
                <Outline />
              )}
            </Card>
            <CookiePopup />
            {!isLoading && isFree && <TourCard />}
          </nav>

          {/* Center area between sidebars — tour controls live here */}
          <div className="relative min-h-0 min-w-0 grow">
            {isVideo && !isStartScreen && <VideoPlayPauseFlash />}
            {/* Standard tour: pips + prev/next arrows */}
            {isStandardTour && currentTour && !isStartScreen && (
              <>
                <div className="max-1000:hidden max-1000:bottom-[216px] pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                  <StepPips />
                </div>

                {(['prev', 'next'] as const).map((direction) => {
                  const isAtEnd =
                    direction === 'next' &&
                    currentStepIndex === currentTour.steps.length - 1
                  const step =
                    direction === 'prev' ? currentStepIndex - 1 : currentStepIndex + 1
                  const disabled = direction === 'prev' ? currentStepIndex === 0 : false
                  return (
                    <TourNavArrow
                      key={direction}
                      direction={direction}
                      pos={direction === 'next' && !specsOpen ? 'right-0' : undefined}
                      // On mobile, center inside the space above the specs
                      // drawer (MOBILE_SPECS_PANEL_HEIGHT = 200 → shift -80px).
                      className="max-1000:top-[calc(50%-100px)] top-1/2"
                      disabled={disabled}
                      onClick={() => {
                        if (isAtEnd) {
                          goToNextTour()
                          return
                        }
                        goToTourStep(step)
                        const pip = document.querySelector<HTMLElement>(
                          `[data-step="${step}"]`,
                        )
                        pip?.focus()
                      }}
                    />
                  )
                })}
              </>
            )}

            <AnimatePresence>{isGuided && <TourStartScreen />}</AnimatePresence>

            <PerformanceNotice />

            {isConfigure && (
              <div className="max-1000:hidden pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                <RackCountStepper />
              </div>
            )}

            {/* Video tour: timeline + player */}
            {isVideo && currentVideoTour && !isStartScreen && (
              <>
                <div className="pointer-events-auto absolute top-0 right-0 z-20">
                  <AnimatePresence>
                    <VideoTourPlayer />
                  </AnimatePresence>
                </div>

                {/* Center between the 150px video player at the top and the
                    ~80px timeline at the bottom (offset shift = (150-80)/2). */}
                <TourNavArrow
                  direction="prev"
                  className="max-1000:top-[calc(50%+35px)] top-1/2"
                  disabled={currentVideoStepIndex === 0}
                  onClick={handleVideoSkipPrev}
                />
                <TourNavArrow
                  direction="next"
                  className="max-1000:top-[calc(50%+35px)] top-1/2"
                  onClick={handleVideoSkipNext}
                />

                <div className="absolute right-0 bottom-20 left-0 z-20 px-4">
                  <VideoCaptions />
                </div>
                <div className="1000:pl-4 pointer-events-auto absolute right-0 bottom-0 left-0 z-20">
                  <div
                    ref={timelineFrostRef}
                    className={clsx(
                      'rounded-lg px-4 py-3',
                      frosted ? 'bg-default/80' : 'bg-default/95',
                    )}
                  >
                    <VideoTourTimeline onSeek={seekVideo} />
                  </div>
                </div>
              </>
            )}
          </div>

          <motion.div
            initial={false}
            animate={{
              width: specsOpen && !isVideo && !(isGuided && isStartScreen) ? 256 : 0,
              opacity: specsOpen && !isVideo && !(isGuided && isStartScreen) ? 1 : 0,
            }}
            transition={{ type: 'spring', duration: 0.325, bounce: 0 }}
            className={clsx(
              'max-1000:hidden flex flex-col gap-2 overflow-hidden',
              specsOpen && 'pointer-events-auto',
            )}
          >
            <Card
              title={
                isLoading ? (
                  <Bar className="h-3 w-20" />
                ) : isStandardTour ? (
                  'Guide'
                ) : isConfigure ? (
                  'Summary'
                ) : (
                  'Specifications'
                )
              }
              contentKey={
                isLoading
                  ? 'skeleton'
                  : isStandardTour
                    ? 'guide'
                    : isConfigure
                      ? 'configure'
                      : 'specs'
              }
            >
              {isLoading ? (
                <SpecificationsSkeleton />
              ) : isStandardTour ? (
                <GuidedTourPanel />
              ) : isConfigure ? (
                <ConfiguratorSummary />
              ) : (
                <Specifications />
              )}
            </Card>
            <ContactSales
              loading={isLoading}
              ref={contactFrostRef}
              className={clsx(
                'hover:bg-hover/80 block w-64 rounded-md border border-neutral-900/10 p-2.5 transition-colors',
                frosted ? 'bg-default/25' : 'bg-default/60',
              )}
            />
          </motion.div>
        </div>

        <div className="1000:hidden pointer-events-auto fixed right-3 bottom-3 z-50">
          <CookiePopup />
        </div>

        {!isVideo && !(isGuided && isStartScreen) && (
          <motion.button
            initial={false}
            animate={{ x: specsOpen ? -6 : 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            onClick={toggleSpecifications}
            className={clsx(
              'hover:bg-hover target-8 max-1000:hidden pointer-events-auto absolute right-4 z-10 rounded border p-0.5 transition-colors',
              // Level with the specs card's title, which moves up with no header.
              isKiosk ? 'top-5' : 'top-17',
              specsOpen ? 'border-transparent' : 'border-default',
            )}
          >
            <SidebarIcon className="text-tertiary h-4 w-4" />
          </motion.button>
        )}

        {!isLoading && <MobileSpecsDrawer />}
        <MobileOutlineOverlay />
        <FreeTutorial />

        <IdleTourOverlay />
      </div>
    </MotionConfig>
  )
}

export default App
