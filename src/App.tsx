import { OpenLink12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'

import {
  activeTour,
  landingOpen,
  navigationMode,
  sceneReady,
  selectedId,
  specificationsOpen,
} from './atoms'
import { Card } from './components/Card'
import { GuidedTourOutline } from './components/GuidedTourOutline'
import { GuidedTourPanel } from './components/GuidedTourPanel'
import { SidebarIcon } from './components/Icons'
import { LandingModal } from './components/LandingModal'
import { Outline } from './components/Outline'
import { OutlineSkeleton, SpecificationsSkeleton } from './components/Skeletons'
import { Specifications } from './components/Specifications'
import { StepPips } from './components/StepPips'
import { getNode } from './data/componentTree'
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

        <header className="pointer-events-auto relative z-10 flex w-full items-center justify-between px-4 pt-4">
          <div className="flex flex-1 flex-col">
            <div className="text-raise text-mono-xs opacity-40">Oxide Computer Co.</div>
            <div className="text-sans-sm text-default">3D Rack Explorer</div>
          </div>
          <div className="text-secondary flex flex-1 items-center justify-center gap-2">
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
          <button className="flex flex-1 justify-end">
            <div className="text-mono-xs text-secondary bg-default hover:bg-hover flex h-8 w-40 items-center gap-1.5 rounded p-3">
              <PrevArrow12Icon className="text-quaternary -rotate-90" /> Options
            </div>
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 grow justify-between">
          <nav className="pointer-events-auto flex h-full w-64 flex-col gap-2 p-4">
            <Card
              title="Explore the hardware"
              open={currentNavigationMode === 'free'}
              onClick={isLandingOpen ? undefined : () => navigationMode.set('free')}
            >
              {isLandingOpen ? <OutlineSkeleton /> : <Outline />}
            </Card>
            <Card
              title="Guided tour & help"
              open={isGuided}
              onClick={
                isLandingOpen
                  ? undefined
                  : () => {
                      navigationMode.set('guided')
                      selectedId.set('oxide-rack')
                    }
              }
            >
              {isLandingOpen ? <OutlineSkeleton /> : <GuidedTourOutline />}
            </Card>
          </nav>

          <motion.button
            initial={false}
            animate={{ right: specsOpen ? 22 : 16 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            onClick={toggleSpecifications}
            className={clsx(
              'hover:bg-hover pointer-events-auto absolute top-5 z-10 rounded border p-0.5 transition-colors',
              specsOpen ? 'border-transparent' : 'border-default',
            )}
          >
            <SidebarIcon className="text-tertiary h-4 w-4" />
          </motion.button>

          <motion.div
            initial={false}
            animate={{
              width: specsOpen ? 256 : 200,
              opacity: specsOpen ? 1 : 0,
            }}
            transition={{ type: 'spring', duration: 0.325, bounce: 0 }}
            style={{ minWidth: 0 }}
            className="pointer-events-auto flex w-64 flex-col gap-2 overflow-hidden p-4"
          >
            <Card title={isGuided ? 'Guide' : 'Specifications'} open>
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
              className="hover:bg-hover/80 block overflow-clip rounded-md bg-transparent p-2.5 ring ring-neutral-900/10 backdrop-blur-lg transition-colors"
            >
              <div className="text-mono-xs text-tertiary flex items-center justify-between">
                Contact Sales <OpenLink12Icon className="text-quaternary" />
              </div>
              <p className="text-default text-sans-sm mt-1 w-50">
                Discuss your computing requirements and business goals with our team of
                experts.
              </p>
            </a>
          </motion.div>
        </div>

        {/* Bottom center step pips for guided tours */}
        <AnimatePresence>
          {isGuided && currentTour && !isLandingOpen && (
            <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <StepPips />
            </div>
          )}
        </AnimatePresence>

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
