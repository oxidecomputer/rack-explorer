import {
  Close8Icon,
  Compass16Icon,
  NextArrow12Icon,
  PrevArrow12Icon,
  Question16Icon,
  Show16Icon,
} from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect } from 'react'

import {
  activeTour,
  activeTourStepIndex,
  activeVideoTour,
  activeVideoTourStepIndex,
  exitGuidedMode,
  goToTourStep,
  isVideoTour,
  landingOpen,
  mobileOutlineOpen,
  navigationMode,
  restartFreeTutorial,
  sceneReady,
  seekVideo,
  selectedId,
  specificationsOpen,
  startTour,
  tourStartScreen,
} from './atoms'
import { Card } from './components/Card'
import { ContactSales } from './components/ContactSales'
import { FreeTutorial } from './components/FreeTutorial'
import { GuidedTourOutline } from './components/GuidedTourOutline'
import { GuidedTourPanel } from './components/GuidedTourPanel'
import { SidebarIcon } from './components/Icons'
import { LandingModal } from './components/LandingModal'
import { MobileOutlineOverlay } from './components/MobileOutlineOverlay'
import { MobileSpecsDrawer } from './components/MobileSpecsDrawer'
import { OptionsDropdown } from './components/OptionsDropdown'
import { Outline } from './components/Outline'
import { Bar, OutlineSkeleton, SpecificationsSkeleton } from './components/Skeletons'
import { Specifications } from './components/Specifications'
import { StepPips } from './components/StepPips'
import { TourStartScreen } from './components/TourStartScreen'
import { VideoTourPlayer } from './components/VideoTourPlayer'
import { VideoTourTimeline } from './components/VideoTourTimeline'
import { getNode, inheritInstanceIndex } from './data/componentTree'
import { getFirstStandardTour } from './data/guidedTours'
import { Scene } from './Scene'
import { useKeyboardNavigation } from './useKeyboardNavigation'

function findPath(targetId: string | null): { id: string; label: string }[] | null {
  if (!targetId) return null

  const [base, indexStr] = targetId.split(':')
  const entry = getNode(base)
  if (!entry) return null

  // Build path from ancestors + self (skip root since breadcrumb always shows "Oxide Rack")
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
  const isLandingOpen = useValue(landingOpen)
  const isSceneReady = useValue(sceneReady)
  const currentTour = useValue(activeTour)
  const currentStepIndex = useValue(activeTourStepIndex)
  const currentVideoTour = useValue(activeVideoTour)
  const currentVideoStepIndex = useValue(activeVideoTourStepIndex)
  const isGuided = currentNavigationMode === 'guided'
  const isVideo = useValue(isVideoTour)
  const isStartScreen = useValue(tourStartScreen)
  const isStandardTour = isGuided && !isVideo

  const handleVideoSkipPrev = useCallback(() => {
    if (!currentVideoTour) return
    const prevIndex = Math.max(0, currentVideoStepIndex - 1)
    seekVideo(currentVideoTour.steps[prevIndex].timestamp)
  }, [currentVideoTour, currentVideoStepIndex])

  const handleVideoSkipNext = useCallback(() => {
    if (!currentVideoTour) return
    const nextIndex = Math.min(currentVideoTour.steps.length - 1, currentVideoStepIndex + 1)
    seekVideo(currentVideoTour.steps[nextIndex].timestamp)
  }, [currentVideoTour, currentVideoStepIndex])

  const toggleSpecifications = () => {
    specificationsOpen.set(!specsOpen)
  }

  useKeyboardNavigation()

  // Mobile only has guided tours. On mount and on any resize that drops
  // below the breakpoint, push users out of free explore into the first tour.
  useEffect(() => {
    const mm = window.matchMedia('(min-width: 1000px)')
    const apply = () => {
      if (mm.matches) return
      const inFree = navigationMode.get() === 'free'
      if (!landingOpen.get() && !inFree) return
      startTour(getFirstStandardTour().id)
      landingOpen.set(false)
    }
    apply()
    mm.addEventListener('change', apply)
    return () => mm.removeEventListener('change', apply)
  }, [])

  const breadcrumbPath = findPath(currentSelectedId)

  const breadcrumbsEnabled = !isGuided

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="fixed top-0 left-0 h-dvh w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: isSceneReady ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Scene />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 flex h-dvh flex-col">
        {/* Blur overlay — behind sidebars */}
        <AnimatePresence>
          {isLandingOpen && (
            <motion.div
              className="pointer-events-none absolute inset-0 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        <header className="pointer-events-auto relative z-30 flex w-full items-center justify-between px-4 pt-4">
          <div className="flex w-64 flex-col">
            <div className="text-raise text-mono-xs opacity-40">Oxide Computer Co.</div>
            <div className="text-sans-sm text-default">3D Rack Explorer</div>
          </div>
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
              Oxide Rack
            </button>
            {breadcrumbPath &&
              breadcrumbPath.length > 0 &&
              breadcrumbPath[0].label !== 'Oxide Rack' && (
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
          <div className="flex w-64 items-center justify-end gap-2">
            <OptionsDropdown />
            {!isLandingOpen && !isGuided && (
              <button
                onClick={restartFreeTutorial}
                className="hover:bg-hover/80 target-8 max-1000:hidden text-tertiary hover:text-default flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-900/10 bg-transparent transition-colors"
                aria-label="Replay tutorial"
              >
                <Question16Icon className="h-4 w-4" />
              </button>
            )}
            {!isLandingOpen && !(isGuided && isStartScreen) && (
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
                isLandingOpen ? (
                  <Bar className="h-3 w-28" />
                ) : isGuided ? (
                  'Guided tour & help'
                ) : (
                  'Explore the hardware'
                )
              }
              contentKey={isLandingOpen ? 'skeleton' : isGuided ? 'guided' : 'free'}
            >
              {isLandingOpen ? (
                <OutlineSkeleton />
              ) : isGuided ? (
                <GuidedTourOutline />
              ) : (
                <Outline />
              )}
            </Card>
            {!isLandingOpen && (
              <button
                onClick={() => {
                  if (isGuided) {
                    exitGuidedMode()
                  } else {
                    const first = getFirstStandardTour()
                    startTour(first.id)
                  }
                }}
                className="group text-accent hover:bg-accent-hover text-mono-xs bg-accent hover:bg-accent-secondary-hover flex w-full items-center justify-between rounded-md border border-current/5 px-2.5 py-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isGuided ? <Show16Icon /> : <Compass16Icon />}
                  {isGuided ? 'Free Explore' : 'Guided tour'}
                </div>
                <div className="translate-x-0 transition-transform group-hover:translate-x-0.5">
                  <NextArrow12Icon />
                </div>
              </button>
            )}
          </nav>

          {/* Center area between sidebars — tour controls live here */}
          <div className="relative min-h-0 min-w-0 grow">
            {/* Standard tour: pips + prev/next arrows */}
            {isStandardTour && currentTour && !isLandingOpen && !isStartScreen && (
              <>
                <div className="max-1000:hidden max-1000:bottom-[216px] pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                  <StepPips />
                </div>

                {[
                  {
                    Icon: PrevArrow12Icon,
                    pos: 'left-4',
                    step: currentStepIndex - 1,
                    disabled: currentStepIndex === 0,
                  },
                  {
                    Icon: NextArrow12Icon,
                    pos: specsOpen ? 'right-4' : 'right-0',
                    step: currentStepIndex + 1,
                    disabled:
                      currentTour.type !== 'video' &&
                      currentStepIndex === currentTour.steps.length - 1,
                  },
                ].map(({ Icon, pos, step, disabled }) => (
                  <button
                    key={pos}
                    className={`target-16 max-1000:top-[calc(50%-100px)] pointer-events-auto absolute top-1/2 ${pos} z-30 -translate-y-1/2 rounded-md text-center hover:bg-neutral-800/30 hover:backdrop-blur-sm disabled:pointer-events-none disabled:opacity-30`}
                    disabled={disabled}
                    onClick={() => {
                      goToTourStep(step)
                      const pip = document.querySelector<HTMLElement>(
                        `[data-step="${step}"]`,
                      )
                      pip?.focus()
                    }}
                  >
                    <Icon className="m-1 size-6" />
                  </button>
                ))}
              </>
            )}

            <AnimatePresence>{isGuided && <TourStartScreen />}</AnimatePresence>

            {/* Video tour: timeline + player */}
            {isVideo && currentVideoTour && !isLandingOpen && !isStartScreen && (
              <>
                <div className="pointer-events-auto absolute top-0 right-0 z-20">
                  <AnimatePresence>
                    <VideoTourPlayer />
                  </AnimatePresence>
                </div>
                <div className="1000:pl-4 pointer-events-auto absolute right-0 bottom-0 left-0 z-20">
                  <div className="bg-default/80 rounded-lg px-4 py-3 backdrop-blur-md">
                    <VideoTourTimeline
                      onSeek={seekVideo}
                      onSkipPrev={handleVideoSkipPrev}
                      onSkipNext={handleVideoSkipNext}
                    />
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
                isLandingOpen ? (
                  <Bar className="h-3 w-20" />
                ) : isStandardTour ? (
                  'Guide'
                ) : (
                  'Specifications'
                )
              }
              contentKey={isLandingOpen ? 'skeleton' : isStandardTour ? 'guide' : 'specs'}
            >
              {isLandingOpen ? (
                <SpecificationsSkeleton />
              ) : isStandardTour ? (
                <GuidedTourPanel />
              ) : (
                <Specifications />
              )}
            </Card>
            <ContactSales
              loading={isLandingOpen}
              className="hover:bg-hover/80 block w-64 rounded-md border border-neutral-900/10 bg-transparent p-2.5 backdrop-blur-md transition-colors"
            />
          </motion.div>
        </div>

        {!isLandingOpen && !isVideo && !(isGuided && isStartScreen) && (
          <motion.button
            initial={false}
            animate={{ x: specsOpen ? -6 : 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            onClick={toggleSpecifications}
            className={clsx(
              'hover:bg-hover target-8 max-1000:hidden pointer-events-auto absolute top-17 right-4 z-10 rounded border p-0.5 transition-colors',
              specsOpen ? 'border-transparent' : 'border-default',
            )}
          >
            <SidebarIcon className="text-tertiary h-4 w-4" />
          </motion.button>
        )}

        {!isLandingOpen && <MobileSpecsDrawer />}
        <MobileOutlineOverlay />
        <FreeTutorial />

        <AnimatePresence>
          {isLandingOpen && (
            <div className="absolute inset-0 z-20">
              <LandingModal />
            </div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

export default App
