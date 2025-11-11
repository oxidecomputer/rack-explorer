import { OpenLink12Icon, PrevArrow12Icon } from '@oxide/design-system/icons/react'
import { Scene } from './Scene'
import { Card } from './components/Card'
import { Outline } from './components/Outline'
import { Specifications } from './components/Specifications'

function App() {
  return (
    <>
      <Scene />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="flex w-full items-center justify-between px-4 pt-4">
          <div className="flex flex-col">
            <div className="text-mono-xs text-tertiary">Oxide Computer</div>
            <div className="text-sans-sm text-default">3D Rack Explorer</div>
          </div>
          <div className="text-secondary text-mono-xs flex gap-2">
            Oxide Rack 0<span className="text-quaternary">/</span>Compute Sled
          </div>
          <div className="text-mono-xs text-secondary flex items-center gap-1.5">
            <PrevArrow12Icon className="text-quaternary" /> Options
          </div>
        </header>

        <div className="flex grow justify-between">
          <nav className="pointer-events-auto flex h-full w-64 flex-col gap-2 p-4">
            <Card title="Explore the hardware" open>
              <Outline />
            </Card>
            <Card title="Guided tour">Guided Tour</Card>
          </nav>

          <div className="pointer-events-auto flex w-64 flex-col gap-2 p-4">
            <Card title="Specifications" open>
              <Specifications />
            </Card>
            <a
              href="https://oxide.computer/contact"
              className="hover:bg-hover border-default block rounded-lg border bg-transparent p-2.5 transition-colors"
            >
              <div className="text-mono-xs text-tertiary flex items-center justify-between">
                Contact Sales <OpenLink12Icon className="text-quaternary" />
              </div>
              <p className="text-default text-sans-sm mt-1">
                Discuss your computing requirements and business goals with our team of
                experts.
              </p>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
