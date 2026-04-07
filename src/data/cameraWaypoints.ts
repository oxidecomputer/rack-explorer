type Vec3 = [number, number, number]

export type CameraWaypointEntry = {
  position: Vec3
  target: Vec3
}

export type CameraWaypointMulti = {
  position: Vec3
  targets: Vec3[]
}

export type CameraWaypoint = CameraWaypointEntry | CameraWaypointMulti

function isMulti(wp: CameraWaypoint): wp is CameraWaypointMulti {
  return 'targets' in wp
}

export function getWaypointEntry(
  waypoint: CameraWaypoint,
  index: number,
): CameraWaypointEntry {
  if (isMulti(waypoint)) {
    return { position: waypoint.position, target: waypoint.targets[index] }
  }
  return waypoint
}

export function getWaypointEntries(waypoint: CameraWaypoint): CameraWaypointEntry[] {
  if (isMulti(waypoint)) {
    return waypoint.targets.map((target) => ({ position: waypoint.position, target }))
  }
  return [waypoint]
}

function generateSledTargets(): Vec3[] {
  const targets: Vec3[] = []
  const cols = 2
  const rowsPerHalf = 8
  const xOffset = 0.13 // half-width offset for two columns
  const rowHeight = 0.1 // Y spacing between rows
  const topStart = 2.084 // Y of the first row in the top half
  const bottomStart = 0.86 // Y of the first row in the bottom half
  const z = 0.035

  for (const startY of [topStart, bottomStart]) {
    for (let row = 0; row < rowsPerHalf; row++) {
      const y = startY - row * rowHeight
      for (let col = 0; col < cols; col++) {
        const x = col === 0 ? -xOffset : xOffset
        targets.push([x, y, z])
      }
    }
  }

  return targets
}

export const cameraWaypoints: Record<string, CameraWaypoint> = {
  'oxide-rack': {
    position: [5, 5, 10],
    target: [0, 1.2, 0],
  },
  'compute-sled': {
    position: [1, 2, 4],
    targets: generateSledTargets(),
  },
  'disk-group': {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  disk: {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  'cpu-nested': {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  cpu: {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  ram: {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  fans: {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  connectors: {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  'airflow-shroud': {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  'network-switch': {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
  'power-shelf': {
    position: [1, 1.5, 4],
    targets: [
      [0, 1.2, 0.035],
      [0, 1.1, 0.035],
    ],
  },
  'patch-panel': {
    position: [1, 2.15, 4],
    target: [0, 2.2, 0],
  },
}
