type Vec3 = [number, number, number]

export type ComponentWaypoint = {
  position: Vec3
  target: Vec3
}

export type ModelConfig = {
  path: string
  clickable?: boolean
  position?: Vec3
  /** Map of material name → texture path to apply after loading */
  textures?: Record<string, string>
}

export type ComponentNode = {
  id: string
  label: string
  /** Camera waypoint. For instanced components, one per instance is generated from `instances`. */
  waypoint?: ComponentWaypoint
  /** For components with multiple instances (e.g. compute sleds positioned in a grid). */
  instances?: Vec3[]
  /** Child waypoints are relative offsets from the parent instance position. */
  children?: ComponentNode[]
  /** GLB model to render for this component */
  model?: ModelConfig
  /** Offset applied to the selected instance (e.g. slide out on Z). If omitted, no animation. */
  selectionOffset?: Vec3
}

// ——— Compute sled instance positions ———

function generateSledPositions(): Vec3[] {
  const positions: Vec3[] = []
  const cols = 2
  const rowsPerHalf = 8
  const xOffset = 0.13
  const rowHeight = 0.1
  const topStart = 2.084
  const bottomStart = 0.86
  const z = 0.035

  for (const startY of [bottomStart, topStart]) {
    for (let row = 0; row < rowsPerHalf; row++) {
      const y = startY - (rowsPerHalf - 1 - row) * rowHeight
      for (let col = 0; col < cols; col++) {
        const x = col === 0 ? -xOffset : xOffset
        positions.push([x, y, z])
      }
    }
  }

  return positions
}

const selectionOffset: [number, number, number] = [0, 0, 0.1]

// ——— The tree ———

export const componentTree: ComponentNode = {
  id: 'oxide-rack',
  label: 'Oxide Rack',
  waypoint: { position: [5, 5, 10], target: [0, 1.2, 0] },
  model: { path: './models/rack-frame/rack-frame-lod1.glb', clickable: false },
  children: [
    {
      id: 'compute-sled',
      label: 'Compute Sled',
      waypoint: { position: [1, 2, 4], target: [0, 0, 0.325] },
      instances: generateSledPositions(),
      selectionOffset: selectionOffset,
      model: { path: './models/cosmo/cosmo-lod1.glb' },
      children: [
        {
          id: 'compute-inner',
          label: 'Inner',
          waypoint: { position: [1.5, 1, 1.5], target: [0, 0, 0] },
          model: {
            path: './models/cosmo/cosmo-lod0.glb',
            clickable: false,
            textures: { PCB_Texture: './models/cosmo/pcb.png' },
          },
          children: [
            {
              id: 'disks',
              label: 'Disks',
              waypoint: { position: [1.25, 0.5, 1.25], target: [0, 0, 0.325] },
            },
            {
              id: 'cpu',
              label: 'CPU',
              waypoint: { position: [0.75, 1.25, 0.75], target: [0, 0, 0] },
            },
            {
              id: 'ram',
              label: 'RAM',
              waypoint: { position: [0.6, 1.5, 0.6], target: [0, 0, 0] },
            },
            {
              id: 'connectors',
              label: 'Connectors',
              waypoint: { position: [1, 0.75, -1], target: [0, 0, -0.35] },
            },
            {
              id: 'fans',
              label: 'Fans',
              waypoint: { position: [1.25, 1, -1.25], target: [0, 0.05, -0.25] },
            },
            {
              id: 'airflow-shroud',
              label: 'Airflow Shroud',
              waypoint: { position: [1.25, 1.5, 1.25], target: [0, 0, 0] },
            },
          ],
        },
      ],
    },
    {
      id: 'network-switch',
      label: 'Network Switch',
      waypoint: { position: [2, 1.5, 4], target: [0, 0, 0.5] },
      instances: [
        [0, 0.985, 0.015],
        [0, 1.26, 0.015],
      ],
      selectionOffset: selectionOffset,
      model: { path: './models/sidecar/sidecar-lod1.glb' },
      children: [
        {
          id: 'switch-inner',
          label: 'Inner',
          waypoint: { position: [1.5, 1.5, 1.5], target: [0, 0, 0.325] },
          model: { path: './models/sidecar/sidecar-lod1.glb', clickable: false },
        },
      ],
    },
    {
      id: 'power-shelf',
      label: 'Power Shelf',
      waypoint: { position: [1, 1.5, 4], target: [0, 0, 0.325] },
      instances: [
        [0, 1.1, 0.095],
        [0, 1.15, 0.095],
      ],
      selectionOffset: selectionOffset,
      model: { path: './models/power-shelf/power-shelf-lod1.glb' },
    },
    {
      id: 'patch-panel',
      label: 'Patch Panel',
      waypoint: { position: [1, 2.15, 4], target: [0, 2.2, 0.325] },
      model: {
        path: './models/patch-panel/patch-panel-lod1.glb',
        position: [0, 2.2, 0.015],
      },
    },
  ],
}

/** Build the instance list for a top-level component by id */
export function getInstances(
  id: string,
): { id: string; position: [number, number, number] }[] {
  const node = componentTree.children?.find((c) => c.id === id)
  if (!node?.instances) return []
  return node.instances.map((pos, i) => ({
    id: `${id}:${i}`,
    position: pos as [number, number, number],
  }))
}

// ——— Lookup helpers ———

/** Flattened map for O(1) lookup by id */
export type FlatNode = {
  node: ComponentNode
  parent: ComponentNode | null
  /** Absolute path of ancestor nodes from root */
  ancestors: ComponentNode[]
  depth: number
}

function buildFlatMap(
  node: ComponentNode,
  parent: ComponentNode | null,
  ancestors: ComponentNode[],
  depth: number,
  map: Map<string, FlatNode>,
) {
  map.set(node.id, { node, parent, ancestors, depth })
  if (node.children) {
    for (const child of node.children) {
      buildFlatMap(child, node, [...ancestors, node], depth + 1, map)
    }
  }
}

const flatMap = new Map<string, FlatNode>()
buildFlatMap(componentTree, null, [], 0, flatMap)

export function getNode(id: string): FlatNode | undefined {
  return flatMap.get(id)
}

/** Get siblings of a node (including itself) */
export function getSiblings(id: string): ComponentNode[] {
  const entry = flatMap.get(id)
  if (!entry) return []
  if (entry.parent?.children) return entry.parent.children
  // Root level — return root's children for top-level items, or [root] for root itself
  if (entry.node === componentTree) return [componentTree]
  return componentTree.children ?? []
}

/** Find the nearest instanced ancestor (or self) and its instance index.
 *  Returns the ancestor node and the instance index parsed from selectedId. */
export function getInstanceContext(selectedId: string): {
  instanceAncestor: ComponentNode
  instanceIndex: number
  instancePosition: Vec3
} | null {
  const [baseId, indexStr] = selectedId.split(':')
  const instanceIndex = indexStr != null ? Number(indexStr) : 0

  // Walk up from baseId to find nearest node with instances
  let current = flatMap.get(baseId)
  while (current) {
    if (current.node.instances) {
      const pos = current.node.instances[instanceIndex]
      if (pos) {
        return { instanceAncestor: current.node, instanceIndex, instancePosition: pos }
      }
    }
    current = current.parent ? flatMap.get(current.parent.id) : undefined
  }
  return null
}

/** Resolve the absolute camera waypoint for a selectedId (e.g. 'cpu' or 'compute-sled:5').
 *  For children of instanced parents, offsets are added to the instance position. */
export function resolveWaypoint(selectedId: string): ComponentWaypoint | null {
  const [baseId, indexStr] = selectedId.split(':')
  const node = flatMap.get(baseId)
  if (!node?.node.waypoint) return null

  const waypoint = node.node.waypoint

  // If this node itself has instances, use the instance position as the target
  if (node.node.instances) {
    const idx = indexStr != null ? Number(indexStr) : 0
    const instancePos = node.node.instances[idx]
    if (!instancePos) return null
    const biasedPos: Vec3 = [instancePos[0], instancePos[1] * 0.25, instancePos[2]]
    return {
      position: addVec3(waypoint.position, biasedPos),
      target: addVec3(instancePos, node.node.waypoint.target),
    }
  }

  // Otherwise, check if an ancestor is instanced — make waypoint relative to instance position
  const ctx = getInstanceContext(selectedId)
  if (ctx) {
    return {
      position: addVec3(waypoint.position, ctx.instancePosition),
      target: addVec3(waypoint.target, ctx.instancePosition),
    }
  }

  // No instancing — return as-is
  return waypoint
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Collect all descendant nodes that have a model defined */
export function getDescendantModels(nodeId: string): ComponentNode[] {
  const entry = flatMap.get(nodeId)
  if (!entry) return []
  const result: ComponentNode[] = []
  function walk(node: ComponentNode) {
    if (node.model) result.push(node)
    for (const child of node.children ?? []) walk(child)
  }
  for (const child of entry.node.children ?? []) walk(child)
  return result
}

/** Check if a given baseId is a descendant of a specific ancestor id */
export function isDescendantOf(childId: string, ancestorId: string): boolean {
  const entry = flatMap.get(childId)
  if (!entry) return false
  return entry.ancestors.some((a) => a.id === ancestorId)
}

/** Find the nearest instanced ancestor for a base id (not parsing from selectedId). */
function findInstancedAncestorId(baseId: string): string | null {
  let current = flatMap.get(baseId)
  while (current) {
    if (current.node.instances) return current.node.id
    current = current.parent ? flatMap.get(current.parent.id) : undefined
  }
  return null
}

/** Build a selectedId for a target node, inheriting the instance index from the
 *  current selection if both share the same instanced ancestor.
 *  e.g. current='compute-sled:7', target='cpu' → 'cpu:7' */
export function inheritInstanceIndex(
  currentSelectedId: string,
  targetBaseId: string,
): string {
  const [, indexStr] = currentSelectedId.split(':')
  if (indexStr == null) {
    // Default to first instance if the target is an instanced component
    const targetAncestor = findInstancedAncestorId(targetBaseId)
    return targetAncestor ? `${targetBaseId}:0` : targetBaseId
  }

  // Check if target has an instanced ancestor
  const targetAncestor = findInstancedAncestorId(targetBaseId)
  if (!targetAncestor) return targetBaseId

  // Check if current selection shares the same instanced ancestor
  const currentBase = currentSelectedId.split(':')[0]
  const currentAncestor = findInstancedAncestorId(currentBase)
  if (currentAncestor === targetAncestor) {
    return `${targetBaseId}:${indexStr}`
  }

  return targetBaseId
}
