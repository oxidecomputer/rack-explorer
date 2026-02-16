export type CameraWaypoint = {
  position: [number, number, number]
  target: [number, number, number]
}

export const cameraWaypoints: Record<string, CameraWaypoint> = {
  'oxide-rack': {
    position: [5, 5, 10],
    target: [0, 1.2, 0],
  },
  'compute-sled': {
    position: [2, 2, 2],
    target: [0, 1, 0],
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
    target: [0, 1.1, 0],
  },
  'patch-panel': {
    position: [2, 2, 2],
    target: [0, 1, 0],
  },
}
