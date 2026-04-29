type Vec3 = [number, number, number]

export type TourAnnotation = {
  label: string
  description: string
  /** 3D position where the annotation appears in the scene */
  position: Vec3
}

export type TourStep = {
  title: string
  description: string
  /** If set, selects this element in the scene (uses same IDs as componentTree) */
  selectedId?: string
  /** If set, moves the camera to this position/target instead of using the element's waypoint */
  waypoint?: {
    position: Vec3
    target: Vec3
  }
  /** Annotations displayed in the 3D scene during this step */
  annotations?: TourAnnotation[]
}

/** A step in a video-driven tour, triggered by timestamp */
export type VideoTourStep = {
  title: string
  /** Timestamp in seconds when this step activates */
  timestamp: number
  /** If set, selects this element in the scene */
  selectedId?: string
  /** If set, moves the camera to this position/target */
  waypoint?: {
    position: Vec3
    target: Vec3
  }
  /** Annotations displayed in the 3D scene during this step */
  annotations?: TourAnnotation[]
}

export type StandardTour = {
  id: string
  title: string
  description: string
  type: 'standard'
  steps: TourStep[]
}

export type VideoTour = {
  id: string
  title: string
  type: 'video'
  description: string
  videoUrl: string
  /** Total duration in seconds */
  duration: number
  steps: VideoTourStep[]
}

export type GuidedTour = StandardTour | VideoTour

export const guidedTours: GuidedTour[] = [
  {
    id: 'overview',
    title: 'The Oxide Rack',
    description:
      'A top-to-bottom tour of the Oxide rack: a fully integrated rack-scale computer.',
    type: 'standard',
    steps: [
      {
        title: 'A Rack-Scale Computer',
        description:
          'The Oxide rack is a single integrated computer designed at rack scale, with hardware and software co-designed and the rack itself as the unit of purchase. A populated rack contains up to 32 compute sleds, two Sidecar network switches, two power shelves, and a fiber patch panel, all interconnected by a single cabled backplane.',
        selectedId: 'oxide-rack',
      },
      {
        title: 'Compute Sleds',
        description:
          'Up to 32 sleds slide into the rack like drawers, with two sleds per cubby across sixteen cubbies. When a sled is seated, it blind-mates into power, networking, and management, so the operator does not connect cables to individual sleds.',
        selectedId: 'compute-sled:31',
      },
      {
        title: 'Inside a Sled',
        description:
          'Each sled is a self-contained server with its own CPU, memory, storage, and cooling, built around a single AMD EPYC socket on a board designed by Oxide. The sled has no separate BIOS or BMC; all firmware is delivered and updated as part of the rack.',
        selectedId: 'compute-inner:31',
        annotations: [
          {
            label: 'CPU',
            description: 'Single AMD EPYC, up to 192 cores.',
            position: [0.08, 0, -0.05],
          },
          {
            label: 'NVMe Bays',
            description: '10 front-accessible U.2 SSDs.',
            position: [-0.08, 0, 0.35],
          },
          {
            label: 'Backplane',
            description: 'Blind-mates power, network, and management.',
            position: [0, 0, -0.4],
          },
        ],
      },
      {
        title: 'Airflow Shroud',
        description:
          'A molded shroud channels air from the rear fans across the hottest components, primarily the CPU and DIMMs. It was designed together with the sled and lifts off without tools when a technician services the sled.',
        selectedId: 'airflow-shroud:31',
      },
      {
        title: 'The CPU',
        description:
          'A single AMD EPYC processor (Zen 5 Turin) with up to 192 cores and 384 threads. Each sled is single-socket; additional compute capacity is provisioned by populating more sleds.',
        selectedId: 'cpu:31',
      },
      {
        title: 'Memory',
        description:
          'Twelve DDR5 DIMM slots flank the CPU, supporting up to 1.5 TiB at 6400 MT/s, with ECC throughout. Memory training is performed by Oxide-controlled firmware as part of the host boot sequence.',
        selectedId: 'ram:31',
      },
      {
        title: 'Storage',
        description:
          'Ten hot-swappable NVMe U.2 bays per sled, with drives up to 30 TB. Across the rack, all 320 drives form a single shared pool managed by Crucible, which replicates each distributed disk across three different sleds and encrypts data in transit. Drives can be replaced while the sled is online; the control plane adopts new drives automatically.',
        selectedId: 'disks:31',
      },
      {
        title: 'Cooling',
        description:
          "Rear-mounted fans pull air front-to-back across the shroud. Fan control is handled by the sled's service processor running Hubris, integrated with the rack's firmware update path. Maximum thermal output for the full rack is 122,832 BTU/hr.",
        selectedId: 'fans:31',
      },
      {
        title: 'The Cabled Backplane',
        description:
          'When a sled is seated, it blind-mates into DC power, two redundant network links, and the management network simultaneously. The external cabling for the rack consists of the AC inputs on the power shelves and the fiber uplinks at the patch panel.',
        selectedId: 'connectors:31',
      },
      {
        title: 'Network Switch',
        description:
          'Two Sidecar switches each provide 12.8 Tbit/s of switching capacity on Intel Tofino 2 ASICs, programmed in P4. Every sled has one physical link to each Sidecar, providing redundancy without operator-installed cabling. The switch operating system ships and updates as part of the rack.',
        selectedId: 'network-switch:0',
      },
      {
        title: 'Inside the Switch',
        description:
          'A Sidecar has no host CPU of its own. The Tofino is connected over an external PCIe cable to an adjacent sled (a "Scrimlet") that runs Dendrite, the user-space switch control plane. Two front RJ-45 technician ports provide a management entry point for initial setup and support.',
        selectedId: 'switch-inner:0',
      },
      {
        title: 'Power Shelf',
        description:
          'Two power shelves at the base of the rack hold six 3600 W rectifiers each, configurable as 1+1 redundant (~21.6 kW) or 2+0 (~30 kW). Their DC output runs up a single copper busbar to every sled, consolidating what would otherwise be 64 individual AC power supplies and their associated cabling.',
        selectedId: 'power-shelf:0',
      },
      {
        title: 'Fiber Patch Panel',
        description:
          'All fiber uplinks terminate at a single panel at the top of the rack, with 32 front QSFP cages per Sidecar supporting 40, 100, or 200 GbE optics. Consolidating uplinks at the top of the rack allows a failed transceiver to be reseated from the front.',
        selectedId: 'patch-panel',
      },
      {
        title: 'The Whole System',
        description:
          'External cabling for the rack consists of AC inputs at the power shelves and fiber uplinks at the patch panel. Compared to a traditional rack-and-stack approach, the integrated design provides roughly twice the compute density per watt and can be deployed from crate to running workload in single-digit hours, with firmware and telemetry managed locally by the rack.',
        selectedId: 'oxide-rack',
      },
    ],
  },
  {
    id: 'oxide-rack-overview-video',
    title: 'Oxide Rack Deep Dive',
    type: 'video',
    description:
      'A guided video walkthrough of the Oxide rack architecture, covering compute sleds, networking, power delivery, and storage.',
    videoUrl: '/tours/oxide-rack-overview.mp4',
    duration: 29,
    steps: [
      {
        title: 'Introduction',
        timestamp: 0,
        selectedId: 'oxide-rack',
      },
      {
        title: 'Compute Sleds',
        timestamp: 5,
        selectedId: 'compute-sled:18',
      },
      {
        title: 'Inside a Sled',
        timestamp: 10,
        selectedId: 'compute-inner:18',
        annotations: [
          {
            label: 'CPU',
            description: 'AMD EPYC processor with up to 192 cores.',
            position: [0.08, 0, -0.05],
          },
          {
            label: 'NVMe Bays',
            description: '10 front-accessible U.2 SSD bays.',
            position: [-0.08, 0.0, 0.35],
          },
        ],
      },
      {
        title: 'CPU & Memory',
        timestamp: 15,
        selectedId: 'cpu:18',
      },
      {
        title: 'Network Switches',
        timestamp: 20,
        selectedId: 'network-switch:0',
      },
      {
        title: 'Summary',
        timestamp: 25,
        selectedId: 'oxide-rack',
      },
    ],
  },
]

/** Get a tour by its ID */
export function getTour(tourId: string): GuidedTour | undefined {
  return guidedTours.find((t) => t.id === tourId)
}

/** Get the first standard tour */
export function getFirstStandardTour(): StandardTour {
  return guidedTours.find((t) => t.type === 'standard') as StandardTour
}

/** Get the active step index for a video tour given the current time */
export function getVideoTourStepAtTime(tour: VideoTour, time: number): number {
  for (let i = tour.steps.length - 1; i >= 0; i--) {
    if (time >= tour.steps[i].timestamp) return i
  }
  return 0
}
