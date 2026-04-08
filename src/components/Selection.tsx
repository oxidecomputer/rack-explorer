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

export const selectContext = /* @__PURE__ */ createContext<Api | null>(null)

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
  }, [enabled, children, api])
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
  const selectApiRef = useRef({ selected, select, enabled })
  const selectApi = selectApiRef.current

  selectApi.selected = selected
  selectApi.select = select
  selectApi.enabled = enabled

  const selectionApi = useMemo(
    () => ({ selected, select, enabled }),
    [selected, select, enabled],
  )

  return (
    <selectContext.Provider value={selectApiRef.current}>
      <selectionContext.Provider value={selectionApi}>{children}</selectionContext.Provider>
    </selectContext.Provider>
  )
}
