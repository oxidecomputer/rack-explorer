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
    title: 'Overview Walkthrough',
    description:
      'A top-to-bottom tour of the Oxide rack covering compute sleds, networking, power delivery, and storage.',
    type: 'standard',
    steps: [
      {
        title: 'The Oxide Rack',
        description:
          'Welcome to the Oxide Rack Explorer. This is a full view of the Oxide rack — a fully integrated compute platform built from the ground up.',
        selectedId: 'oxide-rack',
      },
      {
        title: 'Compute Sleds',
        description:
          'Each rack contains 32 sleds, organized in two columns. Sleds slide in and out like drawers, making service simple without disturbing neighboring hardware.',
        selectedId: 'compute-sled:31',
      },
      {
        title: 'Inside a Sled',
        description:
          "Each compute sled is a self-contained server with its own CPU, memory, storage, and cooling. Let's take a closer look at the key components.",
        selectedId: 'compute-inner:0',
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
        title: 'CPU',
        description:
          'The sled is powered by an AMD EPYC 9005 Series processor with up to 192 cores and 384 threads.',
        selectedId: 'cpu:0',
      },
      {
        title: 'Memory',
        description:
          'Each sled has 12 DDR5 DIMM slots supporting up to 1.5 TiB of memory at 6400 MT/s.',
        selectedId: 'ram:0',
      },
      {
        title: 'Storage',
        description:
          'Each sled holds 10 front-accessible NVMe U.2 SSD bays, each supporting drives up to 30 TB.',
        selectedId: 'disks:0',
      },
      {
        title: 'Network Switch',
        description:
          'Two network switches provide 12.8 Tbit/s of switching capacity using Intel Tofino 2 ASICs, with 32 uplink ports each.',
        selectedId: 'network-switch',
      },
      {
        title: 'Power Shelf',
        description:
          'Two power shelves supply redundant power. Each shelf holds 6 power supplies delivering up to 3600W each.',
        selectedId: 'power-shelf:0',
      },
    ],
  },
  {
    id: 'upgrading-ssd',
    title: 'Upgrading SSD',
    description:
      'Step-by-step instructions for hot-swapping an NVMe drive in a compute sled without powering down the rack.',
    type: 'standard',
    steps: [
      {
        title: 'Introduction',
        description:
          'This guide walks you through replacing an NVMe SSD in a compute sled. The process is straightforward and can be done without powering down the rack.',
        selectedId: 'oxide-rack',
      },
      {
        title: 'Locate the sled',
        description:
          "From the rack's front, locate the correct compute sled. Each rack contains 32 sleds, and each sled holds 10 front-accessible NVMe U.2 SSD bays.",
        selectedId: 'compute-sled:31',
      },
      {
        title: 'Pull out the sled',
        description:
          'Sleds slide in and out like drawers, making service simple without disturbing neighboring hardware.',
        selectedId: 'disks:0',
      },
      {
        title: 'Identify the SSD bay',
        description:
          'Each sled has 10 NVMe U.2/U.3 2.5-inch bays arranged in a row along the front. Identify the bay containing the drive to be replaced.',
        selectedId: 'disks:0',
      },
      {
        title: 'Remove the SSD',
        description:
          'Release the drive latch and slide the SSD out of its bay. NVMe drives are hot-swappable — no tools required.',
        selectedId: 'disks:0',
      },
      {
        title: 'Insert the new SSD',
        description:
          'Slide the replacement NVMe drive into the empty bay until the latch clicks into place. The drive will be automatically detected.',
        selectedId: 'disks:0',
      },
      {
        title: 'Reseat the sled',
        description:
          'Push the sled back into the rack until it locks into position. Ensure the sled is fully seated for proper connectivity.',
        selectedId: 'compute-sled:31',
      },
      {
        title: 'Verify adoption',
        description:
          'The new drive will be detected automatically by the Oxide control plane. Verify its status through the management console.',
        selectedId: 'oxide-rack',
      },
      {
        title: 'Completion',
        description:
          'The SSD upgrade is complete. The drive is now available for use by the system.',
        selectedId: 'oxide-rack',
      },
    ],
  },
  {
    id: 'power-efficiency',
    title: 'Power Efficiency',
    description:
      'Explore how the Oxide rack eliminates unnecessary power conversion stages for better efficiency and less waste heat.',
    type: 'standard',
    steps: [
      {
        title: 'Power Architecture',
        description:
          'The Oxide rack uses a streamlined power architecture that eliminates unnecessary conversion stages, reducing waste heat and improving efficiency.',
        selectedId: 'oxide-rack',
      },
      {
        title: 'Power Shelves',
        description:
          'Two power shelves at the base of the rack can be configured in 1+1 redundant or 2+0 non-redundant mode, delivering up to 21.6 kW redundant or 30 kW non-redundant.',
        selectedId: 'power-shelf:0',
      },
      {
        title: 'Power Distribution',
        description:
          'Each power shelf holds 6 power supplies (5+1 or 3+3 configuration) delivering up to 3600W each. Power is distributed directly to sleds via the backplane.',
        selectedId: 'power-shelf:1',
      },
      {
        title: 'Sled Power Delivery',
        description:
          'Each compute sled receives power through its backplane connector, eliminating the need for individual power cables and reducing points of failure.',
        selectedId: 'connectors:0',
      },
      {
        title: 'Thermal Management',
        description:
          'Integrated fans and airflow shrouds in each sled ensure efficient cooling, with a maximum thermal output of 122,832 BTU/hr for the full rack.',
        selectedId: 'fans:0',
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
        selectedId: 'network-switch',
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
