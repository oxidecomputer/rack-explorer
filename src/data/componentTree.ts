type Vec3 = [number, number, number]

export type ComponentWaypoint = {
  /** Camera direction from target. Magnitude is ignored — distance is computed
   *  from the component's bounding box at render time. */
  direction: Vec3
  target: Vec3
  /** Focus volume size (width/height/depth) used to drive the fit distance
   *  when the component has no model. Falls back to the model bbox if omitted. */
  scale?: Vec3
  /** Override how much of the frame the component fills, in whichever
   *  dimension is binding (0–1). Defaults to ~0.67 when omitted. */
  fitFraction?: number
}

export type ModelConfig = {
  path: string
  clickable?: boolean
  position?: Vec3
  /** Map of material name → texture path to apply after loading */
  textures?: Record<string, string>
  /** When true, this model remains visible when viewing the node's children */
  showModelInChildView?: boolean
}

export type ComponentNode = {
  id: string
  label: string
  /** Camera waypoint. For instanced components, one per instance is generated from `instances`. */
  waypoint?: ComponentWaypoint
  /** For components with multiple instances (e.g. compute sleds positioned in a grid). */
  instances?: Vec3[]
  /** Instance index to land on when navigating to this component without an explicit index. */
  defaultInstance?: number
  /** Child waypoints are relative offsets from the parent instance position. */
  children?: ComponentNode[]
  /** GLB model(s) to render for this component. Accepts a single config or an array. */
  model?: ModelConfig | ModelConfig[]
  /** Offset applied to the selected instance (e.g. slide out on Z). If omitted, no animation. */
  selectionOffset?: Vec3
  /** Hide this node's models when any of these IDs are selected */
  hiddenWhenSelected?: string[]
}

/** Normalize `model` into an array (empty if not set). */
export function getNodeModels(node: ComponentNode): ModelConfig[] {
  if (!node.model) return []
  return Array.isArray(node.model) ? node.model : [node.model]
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
  waypoint: {
    direction: [5, 3.8, 10],
    target: [0, 1.2, 0],
    scale: [0.64, 2.28, 1.07],
    fitFraction: 0.85,
  },
  model: [
    { path: './models/rack-frame/lod1/body.glb', clickable: false },
    { path: './models/rack-frame/lod1/core.glb', clickable: false },
    {
      path: './models/rack-frame/lod1/cosmo-housing.glb',
      showModelInChildView: true,
    },
    {
      path: './models/rack-frame/lod1/patch-housing.glb',
      showModelInChildView: true,
    },
    {
      path: './models/rack-frame/lod1/power-housing.glb',
      showModelInChildView: true,
    },
  ],
  children: [
    {
      id: 'compute-sled',
      label: 'Compute Sled',
      waypoint: { direction: [1, 2, 3.675], target: [0, 0, 0.325], fitFraction: 0.5 },
      instances: generateSledPositions(),
      defaultInstance: 16,
      selectionOffset: selectionOffset,
      model: [
        {
          path: './models/cosmo/lod1/exterior.glb',
          showModelInChildView: true,
        },
        {
          path: './models/cosmo/lod1/perforations.glb',
          textures: { Perforations: './models/perforations.png' },
          showModelInChildView: true,
        },
      ],
      children: [
        {
          id: 'compute-inner',
          label: 'Inner',
          waypoint: { direction: [1.5, 1, 1.5], target: [0, 0, 0] },
          model: {
            path: './models/cosmo/lod1/interior.glb',
            textures: { PCB_Texture: './models/cosmo/pcb.png' },
          },
          children: [
            {
              id: 'disks',
              label: 'Disks',
              waypoint: {
                direction: [1.25, 0.5, 0.925],
                target: [0, 0, 0.325],
                scale: [0.26, 0.08, 0.3],
              },
            },
            {
              id: 'cpu',
              label: 'CPU',
              waypoint: {
                direction: [0.75, 1.25, 0.75],
                target: [0, 0, 0],
                fitFraction: 0.4,
              },
              model: { path: './models/cosmo/lod1/heatsink.glb' },
            },
            {
              id: 'ram',
              label: 'RAM',
              waypoint: {
                direction: [0.6, 1.5, 0.6],
                target: [0, 0, 0],
                fitFraction: 0.5,
              },
              model: { path: './models/cosmo/lod1/memory.glb' },
            },
            {
              id: 'connectors',
              label: 'Connectors',
              waypoint: {
                direction: [1, 0.75, -0.65],
                target: [0, 0, -0.35],
                scale: [0.26, 0.08, 0.06],
              },
            },
            {
              id: 'fans',
              label: 'Fans',
              waypoint: { direction: [1.25, 0.95, -1], target: [0, 0.05, -0.25] },
              model: { path: './models/cosmo/lod1/fans.glb' },
            },
            {
              id: 'airflow-shroud',
              label: 'Airflow Shroud',
              hiddenWhenSelected: ['cpu', 'ram'],
              waypoint: {
                direction: [1.25, 1.5, 1.25],
                target: [0, 0, 0],
                fitFraction: 0.5,
              },
              model: { path: './models/cosmo/lod1/shroud.glb', clickable: false },
            },
          ],
        },
      ],
    },
    {
      id: 'network-switch',
      label: 'Network Switch',
      waypoint: { direction: [2, 1.5, 3.5], target: [0, 0, 0.5], fitFraction: 0.75 },
      instances: [
        [0, 0.99, 0.015],
        [0, 1.26, 0.015],
      ],
      selectionOffset: selectionOffset,
      model: [
        {
          path: './models/sidecar/lod1/exterior.glb',
          showModelInChildView: true,
        },
        {
          path: './models/sidecar/lod1/cover.glb',
        },
        {
          path: './models/sidecar/lod1/perforations.glb',
          textures: { Perforations: './models/perforations.png' },
          showModelInChildView: true,
        },
      ],
      children: [
        {
          id: 'switch-inner',
          label: 'Inner',
          waypoint: { direction: [2, 1.5, 2.675], target: [0, 0, 0] },
          model: { path: './models/sidecar/lod1/interior.glb', clickable: false },
        },
      ],
    },
    {
      id: 'power-shelf',
      label: 'Power Shelf',
      waypoint: { direction: [1, 1.5, 3.675], target: [0, 0, 0.325] },
      instances: [
        [0, 1.115, 0.095],
        [0, 1.1623, 0.095],
      ],
      selectionOffset: selectionOffset,
      model: [
        { path: './models/power-shelf/lod1/shelf.glb' },
        {
          path: './models/power-shelf/lod1/perforations.glb',
          textures: { Perforations: './models/perforations.png' },
        },
      ],
    },
    {
      id: 'patch-panel',
      label: 'Patch Panel',
      waypoint: { direction: [1, -0.05, 3.675], target: [0, 2.2, 0.325] },
      model: {
        path: './models/patch-panel/lod1/panel.glb',
        position: [0, 2.2, 0.15],
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
 *  For children of instanced parents, the target is offset by the instance position. */
export function resolveWaypoint(selectedId: string): ComponentWaypoint | null {
  const [baseId, indexStr] = selectedId.split(':')
  const node = flatMap.get(baseId)
  if (!node?.node.waypoint) return null

  const waypoint = node.node.waypoint

  // If this node itself has instances, target the instance position. Tilt the
  // direction so the camera doesn't track 1:1 with the instance height — this
  // keeps top-of-rack and bottom-of-rack instances framed at a similar pitch.
  if (node.node.instances) {
    const idx = indexStr != null ? Number(indexStr) : 0
    const instancePos = node.node.instances[idx]
    if (!instancePos) return null
    return {
      direction: addVec3(waypoint.direction, [0, -0.75 * instancePos[1], 0]),
      target: addVec3(waypoint.target, instancePos),
      scale: waypoint.scale,
      fitFraction: waypoint.fitFraction,
    }
  }

  // Child of an instanced ancestor — shift target only; direction is unchanged.
  const ctx = getInstanceContext(selectedId)
  if (ctx) {
    return {
      direction: waypoint.direction,
      target: addVec3(waypoint.target, ctx.instancePosition),
      scale: waypoint.scale,
      fitFraction: waypoint.fitFraction,
    }
  }

  return waypoint
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** Collect all descendant (node, model) pairs below a given node. */
export function getDescendantModels(
  nodeId: string,
): Array<{ node: ComponentNode; model: ModelConfig }> {
  const entry = flatMap.get(nodeId)
  if (!entry) return []
  const result: Array<{ node: ComponentNode; model: ModelConfig }> = []
  function walk(node: ComponentNode) {
    for (const model of getNodeModels(node)) result.push({ node, model })
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
    const targetAncestor = findInstancedAncestorId(targetBaseId)
    if (!targetAncestor) return targetBaseId
    const defaultIdx = flatMap.get(targetAncestor)?.node.defaultInstance ?? 0
    return `${targetBaseId}:${defaultIdx}`
  }

  // Check if target has an instanced ancestor
  const targetAncestor = findInstancedAncestorId(targetBaseId)
  if (!targetAncestor) return targetBaseId

  // Inherit the index only when both selections share the same instanced
  // ancestor; otherwise default to the first instance so the resulting id
  // still matches the rendered (cloned) selection scene's userData.id.
  const currentBase = currentSelectedId.split(':')[0]
  const currentAncestor = findInstancedAncestorId(currentBase)
  if (currentAncestor === targetAncestor) {
    return `${targetBaseId}:${indexStr}`
  }

  return `${targetBaseId}:0`
}
