import {
  Compass16Icon,
  NextArrow12Icon,
  OpenLink12Icon,
  PrevArrow12Icon,
  Show16Icon,
} from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'

import {
  activeTour,
  activeTourId,
  activeTourStepIndex,
  goToTourStep,
  landingOpen,
  navigationMode,
  sceneReady,
  selectedId,
  showcaseMode,
  specificationsOpen,
} from './atoms'
import { Card } from './components/Card'
import { GuidedTourOutline } from './components/GuidedTourOutline'
import { GuidedTourPanel } from './components/GuidedTourPanel'
import { SidebarIcon } from './components/Icons'
import { LandingModal } from './components/LandingModal'
import { OptionsDropdown } from './components/OptionsDropdown'
import { Outline } from './components/Outline'
import { Bar, OutlineSkeleton, SpecificationsSkeleton } from './components/Skeletons'
import { Specifications } from './components/Specifications'
import { StepPips } from './components/StepPips'
import { getNode } from './data/componentTree'
import { guidedTours } from './data/guidedTours'
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
  const isGuided = currentNavigationMode === 'guided'

  const toggleSpecifications = () => {
    specificationsOpen.set(!specsOpen)
  }

  useKeyboardNavigation()

  const breadcrumbPath = findPath(currentSelectedId)

  const isGuidedMode = navigationMode.get() !== 'guided'

  return (
    <>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: isSceneReady ? 1 : 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      >
        <Scene />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 flex h-screen flex-col">
        {/* Blur overlay for landing state — behind sidebars */}
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
          <div className="flex flex-1 flex-col">
            <div className="text-raise text-mono-xs opacity-40">Oxide Computer Co.</div>
            <div className="text-sans-sm text-default">3D Rack Explorer</div>
          </div>
          <div className="text-secondary flex flex-1 items-center justify-center gap-2 select-none">
            <button
              disabled={isGuidedMode}
              onClick={() => {
                selectedId.set('oxide-rack')
              }}
              className={clsx(
                'text-mono-xs transition-colors',
                isGuidedMode && 'hover:text-default',
              )}
            >
              Oxide Rack
            </button>
            {breadcrumbPath &&
              breadcrumbPath.length > 0 &&
              breadcrumbPath[0].label !== 'Oxide Rack' && (
                <>
                  {breadcrumbPath.map((item) => (
                    <span key={item.id} className="flex items-center gap-2">
                      <span className="text-raise text-mono-xs opacity-20">/</span>
                      <button
                        disabled={isGuidedMode}
                        onClick={() => {
                          selectedId.set(item.id)
                        }}
                        className={clsx(
                          'text-mono-xs transition-colors',
                          isGuidedMode && 'hover:text-default',
                        )}
                      >
                        {item.label}
                      </button>
                    </span>
                  ))}
                </>
              )}
          </div>
          <OptionsDropdown />
        </header>

        <div className="relative z-10 flex min-h-0 grow p-4">
          <nav className="pointer-events-auto flex h-full flex-col gap-2">
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
                    navigationMode.set('free')
                    selectedId.set('oxide-rack')
                    activeTourId.set(null)
                    activeTourStepIndex.set(0)
                  } else {
                    navigationMode.set('guided')
                    showcaseMode.set(false)
                    activeTourStepIndex.set(0)
                    activeTourId.set(guidedTours[0].id)
                    const firstStep = guidedTours[0].steps[0]
                    if (firstStep?.selectedId) {
                      selectedId.set(firstStep.selectedId)
                    }
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
            {isGuided && currentTour && !isLandingOpen && (
              <>
                <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
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
                    disabled: currentStepIndex === currentTour.steps.length - 1,
                  },
                ].map(({ Icon, pos, step, disabled }) => (
                  <button
                    key={pos}
                    className={`target-16 pointer-events-auto absolute top-1/2 ${pos} z-30 -translate-y-1/2 rounded-md text-center hover:bg-neutral-800/30 hover:backdrop-blur-sm disabled:pointer-events-none disabled:opacity-30`}
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
          </div>

          <motion.div
            initial={false}
            animate={{
              width: specsOpen ? 256 : 0,
              opacity: specsOpen ? 1 : 0,
            }}
            transition={{ type: 'spring', duration: 0.325, bounce: 0 }}
            className={clsx(
              'flex flex-col gap-2 overflow-hidden',
              specsOpen && 'pointer-events-auto',
            )}
          >
            <Card
              title={
                isLandingOpen ? (
                  <Bar className="h-3 w-20" />
                ) : isGuided ? (
                  'Guide'
                ) : (
                  'Specifications'
                )
              }
              contentKey={isLandingOpen ? 'skeleton' : isGuided ? 'guide' : 'specs'}
            >
              {isLandingOpen ? (
                <SpecificationsSkeleton />
              ) : isGuided ? (
                <GuidedTourPanel />
              ) : (
                <Specifications />
              )}
            </Card>
            <a
              href="https://oxide.computer/contact"
              className="hover:bg-hover/80 block w-64 rounded-md border border-neutral-900/10 bg-transparent p-2.5 backdrop-blur-md transition-colors"
            >
              <div className="text-mono-xs text-tertiary flex items-center justify-between">
                Contact Sales <OpenLink12Icon className="text-quaternary" />
              </div>
              <p className="text-default text-sans-sm mt-1 pr-2">
                Discuss your computing requirements and business goals with our team of
                experts.
              </p>
            </a>
          </motion.div>
        </div>

        {!isLandingOpen && (
          <motion.button
            initial={false}
            animate={{ right: specsOpen ? 22 : 16 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            onClick={toggleSpecifications}
            className={clsx(
              'hover:bg-hover target-8 pointer-events-auto absolute top-17 z-10 rounded border p-0.5 transition-colors',
              specsOpen ? 'border-transparent' : 'border-default',
            )}
          >
            <SidebarIcon className="text-tertiary h-4 w-4" />
          </motion.button>
        )}

        <AnimatePresence>
          {isLandingOpen && (
            <div className="absolute inset-0 z-20">
              <LandingModal />
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export default App
