import { selectionContext, type Api, type SelectApi } from '@react-three/postprocessing'
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'

const selectContext = /* @__PURE__ */ createContext<Api | null>(null)

export function ModifiedSelect({ enabled = false, children, ...props }: SelectApi) {
  const group = useRef<THREE.Group>(null!)
  const api = useContext(selectContext)
  useEffect(() => {
    if (api && enabled) {
      const current: THREE.Object3D[] = []
      group.current.traverse((o) => {
        if (o.type === 'Mesh') {
          current.push(o)
        }
      })
      api.select((state) => {
        const existing = new Set(state)
        const toAdd = current.filter((o) => !existing.has(o))
        return toAdd.length > 0 ? [...state, ...toAdd] : state
      })
      return () => {
        const toRemove = new Set(current)
        api.select((state) => state.filter((selected) => !toRemove.has(selected)))
      }
    }
  }, [enabled, api])  
  return (
    <group ref={group} {...props}>
      {children}
    </group>
  )
}

export function ModifiedSelection({
  children,
  enabled = true,
}: {
  enabled?: boolean
  children: React.ReactNode
}) {
  const [selected, select] = useState<THREE.Object3D[]>([])
  // Stable-identity api: lets consumers (e.g. ModifiedSelect) keep a single
  // useEffect dep on `api` without re-running on every selection change.
  // Properties are kept in sync via the effect below; consumers only read
  // `select` inside their own effects, never during render.
  const selectApiRef = useRef<Api | null>(null)
  if (selectApiRef.current === null) {
    selectApiRef.current = { selected, select, enabled }
  }

  useEffect(() => {
    const api = selectApiRef.current!
    api.selected = selected
    api.select = select
    api.enabled = enabled
  }, [selected, select, enabled])

  const selectionApi = useMemo(
    () => ({ selected, select, enabled }),
    [selected, select, enabled],
  )

  return (
    // eslint-disable-next-line react-hooks/refs -- stable ref intentionally provided as context value
    <selectContext.Provider value={selectApiRef.current}>
      <selectionContext.Provider value={selectionApi}>{children}</selectionContext.Provider>
    </selectContext.Provider>
  )
}
