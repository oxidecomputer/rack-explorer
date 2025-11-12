import { OpenLink12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'
import { useValue } from '@tldraw/state-react'
import clsx from 'clsx'
import { navigationMode, specificationsOpen, selectedId } from './atoms'
import { Scene } from './Scene'
import { Card } from './components/Card'
import { Outline, outlineItems } from './components/Outline'
import { Specifications } from './components/Specifications'
import { SidebarIcon } from './components/Icons'
import { motion } from 'motion/react'

type OutlineItemProps = {
  label: string
  id: string
  children?: OutlineItemProps[]
}

function findPath(
  items: OutlineItemProps[],
  targetId: string | null,
  path: OutlineItemProps[] = [],
): OutlineItemProps[] | null {
  if (!targetId) return null

  for (const item of items) {
    if (item.id === targetId) {
      return [...path, item]
    }
    if (item.children) {
      const result = findPath(item.children, targetId, [...path, item])
      if (result) return result
    }
  }
  return null
}

function App() {
  const currentNavigationMode = useValue(navigationMode)
  const specsOpen = useValue(specificationsOpen)
  const currentSelectedId = useValue(selectedId)

  const toggleSpecifications = () => {
    specificationsOpen.set(!specsOpen)
  }

  const allItems = [{ id: 'oxide-rack', label: 'Oxide Rack' }, ...outlineItems]
  const breadcrumbPath = findPath(allItems, currentSelectedId)

  return (
    <>
      <Scene />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex w-full items-center justify-between px-4 pt-4">
          <div className="flex flex-1 flex-col">
            <div className="text-raise text-mono-xs opacity-40">Oxide Computer</div>
            <div className="text-sans-sm text-default">3D Rack Explorer</div>
          </div>
          <div className="text-secondary flex flex-1 items-center justify-center gap-2">
            <button
              onClick={() => selectedId.set('oxide-rack')}
              className="hover:text-default text-mono-xs transition-colors"
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
                        onClick={() => selectedId.set(item.id)}
                        className="hover:text-default text-mono-xs transition-colors"
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

        <div className="flex grow justify-between">
          <nav className="pointer-events-auto flex h-full w-64 flex-col gap-2 p-4">
            <Card
              title="Explore the hardware"
              open={currentNavigationMode === 'free'}
              onClick={() => navigationMode.set('free')}
            >
              <Outline />
            </Card>
            <Card
              title="Guided tour"
              open={currentNavigationMode === 'guided'}
              onClick={() => navigationMode.set('guided')}
            >
              Guided Tour
            </Card>
          </nav>

          <motion.button
            initial={false}
            animate={{ right: specsOpen ? 22 : 12 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
            onClick={toggleSpecifications}
            className={clsx(
              'hover:bg-hover pointer-events-auto absolute top-[calc(var(--header-height)+30px)] z-10 rounded border p-0.5 transition-colors',
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
              translateX: specsOpen ? 0 : 16,
            }}
            transition={{ type: 'spring', duration: 0.325, bounce: 0 }}
            style={{ minWidth: 0 }}
            className="pointer-events-auto flex w-64 flex-col gap-2 overflow-hidden p-4"
          >
            <Card title="Specifications" open>
              <Specifications />
            </Card>
            <a
              href="https://oxide.computer/contact"
              className="hover:bg-hover/80 border-default block overflow-clip rounded-lg border bg-transparent p-2.5 text-nowrap backdrop-blur-lg transition-colors"
            >
              <div className="text-mono-xs text-tertiary flex items-center justify-between">
                Contact Sales <OpenLink12Icon className="text-quaternary" />
              </div>
              <p className="text-default text-sans-sm mt-1 w-50 text-wrap">
                Discuss your computing requirements and business goals with our team of
                experts.
              </p>
            </a>
          </motion.div>
        </div>
      </div>
    </>
  )
}

export default App
