import faqFridayPowerShelfVtt from './captions/faq-friday-power-shelf.vtt?raw'
import faqFridayPowerShelfVttUrl from './captions/faq-friday-power-shelf.vtt?url'

type Vec3 = [number, number, number]

export type TourAnnotation = {
  label: string
  description: string
  /** 3D position where the annotation appears in the scene */
  position: Vec3
}

/** A camera waypoint that can target an arbitrary point in space without being
 *  tied to a defined component mesh. Mirrors `ComponentWaypoint`: `direction`
 *  is the camera ray from target to camera (magnitude ignored — distance is
 *  derived from `scale` or the selected mesh bbox). `scale` defines the focus
 *  volume when there is no mesh to fit to. */
export type StepWaypoint = {
  direction: Vec3
  target: Vec3
  scale?: Vec3
  fitFraction?: number
}

export type TourStep = {
  title: string
  description: string
  /** If set, selects this element in the scene (uses same IDs as componentTree) */
  selectedId?: string
  /** If set, overrides the selected component's waypoint with a custom focus. */
  waypoint?: StepWaypoint
  /** Annotations displayed in the 3D scene during this step */
  annotations?: TourAnnotation[]
  /** When true, hides everything outside the selected top-level component
   *  (matches the drilldown isolation used by compute sleds and Sidecars). */
  isolate?: boolean
}

/** A step in a video-driven tour, triggered by timestamp */
export type VideoTourStep = {
  title: string
  /** Timestamp in seconds when this step activates */
  timestamp: number
  /** If set, selects this element in the scene */
  selectedId?: string
  /** If set, overrides the selected component's waypoint with a custom focus. */
  waypoint?: StepWaypoint
  /** Annotations displayed in the 3D scene during this step */
  annotations?: TourAnnotation[]
  /** When true, hides everything outside the selected top-level component. */
  isolate?: boolean
}

/** A single subtitle cue parsed from an SRT file. */
export type VideoCaption = {
  start: number
  end: number
  text: string
}

export type StandardTour = {
  id: string
  title: string
  author?: { portrait: string; name: string; title: string }
  description: string
  type: 'standard'
  steps: TourStep[]
}

export type VideoTour = {
  id: string
  title: string
  author?: { portrait: string; name: string; title: string }
  type: 'video'
  description: string
  videoUrl: string
  /** Total duration in seconds */
  duration: number
  steps: VideoTourStep[]
  /** Optional subtitle cues displayed on-scene during playback. */
  captions?: VideoCaption[]
  /** WebVTT URL for the native <track> element (screen-reader / browser captions UI). */
  captionsUrl?: string
}

export type GuidedTour = StandardTour | VideoTour

/** Parse an VTT string into an array of caption cues. */
export function parseCaptions(text: string): VideoCaption[] {
  const captions: VideoCaption[] = []
  const blocks = text.replace(/^\uFEFF/, '').split(/\r?\n\r?\n/)
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length > 0)
    const tcIndex = lines.findIndex((l) => l.includes('-->'))
    if (tcIndex < 0) continue
    const [startStr, endStr] = lines[tcIndex].split('-->').map((s) => s.trim())
    const start = parseCaptionsTime(startStr)
    const end = parseCaptionsTime(endStr)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const cueText = lines
      .slice(tcIndex + 1)
      .join(' ')
      .trim()
    if (!cueText) continue
    captions.push({ start, end, text: cueText })
  }
  return captions
}

function parseCaptionsTime(s: string): number {
  const m = s.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/)
  if (!m) return NaN
  const [, h, mm, ss, ms] = m
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000
}

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
          'Ten hot-swappable NVMe U.2 bays per sled, with drives up to 30 TB. Across the rack, all 320 drives form a single shared pool managed by Crucible, which replicates each distributed disk across three different sleds and is encrypts data at rest and in transit. Drives can be replaced while the sled is online; the control plane adopts new drives automatically.',
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
          'Two Sidecar switches together provide 12.8 Tbit/s of switching capacity on Intel Tofino 2 ASICs, programmed in P4. Every sled has one physical link to each Sidecar, providing redundancy without operator-installed cabling. The switch operating system ships and updates as part of the rack.',
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
        selectedId: 'power-shelf:1',
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
    id: 'faq-friday-power-shelf',
    title: 'FAQ Friday: Power Shelf',
    type: 'video',
    description:
      'FAQ Friday #42: Bryan Cantrill walks through where AC-to-DC conversion happens in the rack, the Murata rectifiers, and the Oxide-designed power shelf controller.',
    author: { portrait: 'bryan-portrait.jpg', name: 'Bryan Cantrill', title: 'CTO' },
    videoUrl: '/tours/faq-friday-power-shelf.mp4',
    duration: 115,
    captions: parseCaptions(faqFridayPowerShelfVtt),
    captionsUrl: faqFridayPowerShelfVttUrl,
    steps: [
      {
        title: 'Where Are the Power Supplies?',
        timestamp: 0,
        selectedId: 'power-shelf:1',
      },
      {
        title: 'The DC Busbar',
        timestamp: 6,
        selectedId: 'oxide-rack',
        // Pull around to the rear of the rack so the busbar running up the
        // spine is in frame, even though the busbar isn't a separately
        // selectable mesh.
        waypoint: {
          direction: [4, 1.5, -8],
          target: [0, 1.2, -0.2],
          scale: [0.64, 2.28, 0.6],
          fitFraction: 0.85,
        },
        annotations: [
          {
            label: 'DC Busbar',
            description:
              'A single copper busbar runs the height of the rack, carrying 54.5 V DC from the power shelves to every sled — no individual server power cables.',
            position: [0, 1.5, -0.4],
          },
        ],
      },
      {
        title: 'AC to DC Happens Here',
        timestamp: 18,
        selectedId: 'power-shelf:1',
        isolate: true,
      },
      {
        title: 'A Series of Rectifiers',
        timestamp: 22,
        selectedId: 'power-shelf:1',
        isolate: true,
        // Frame the front face of the shelf where the six PSU bays live.
        waypoint: {
          direction: [0.2, 0.6, 2.5],
          target: [0, 1.115, 0.42],
          scale: [0.5, 0.05, 0.05],
          fitFraction: 0.7,
        },
        annotations: [
          {
            label: '6× Murata MWOCP68-3600-D-RM',
            description:
              '3600 W hot-swappable rectifiers. 1+1 redundant (≈21.6 kW) or 2+0 (≈30 kW).',
            position: [-0.1, 0.02, 0.32],
          },
        ],
      },
      {
        title: 'In-Depth Monitoring',
        timestamp: 49,
        selectedId: 'power-shelf:1',
        isolate: true,
        waypoint: {
          direction: [0.2, 0.6, 2.5],
          target: [0, 1.115, 0.42],
          scale: [0.5, 0.05, 0.05],
          fitFraction: 0.7,
        },
        annotations: [
          {
            label: 'PMBus telemetry',
            description:
              'Per-PSU power draw, presence, fault state, and serial / FRUID data.',
            position: [0.1, 0.02, 0.32],
          },
        ],
      },
      {
        title: 'Power Shelf Controller',
        timestamp: 62,
        selectedId: 'power-shelf:1',
        isolate: true,
        // Swing around to the back of the shelf where the PSC plugs into the
        // RMU slot. The PSC is part of the shelf model rather than its own
        // selectable mesh, so the waypoint targets the area directly.
        waypoint: {
          direction: [1.2, 0.8, -2.5],
          target: [0.2, 1.115, -0.24],
          scale: [0.4, 0.06, 0.06],
          fitFraction: 0.7,
        },
        annotations: [
          {
            label: 'PSC',
            description:
              'A custom remote monitoring unit Oxide developed for the shelf, plugged into the rear RMU slot.',
            position: [0.2, 0.02, -0.32],
          },
        ],
      },
      {
        title: 'Service Processor & Management Network',
        timestamp: 78,
        selectedId: 'power-shelf:1',
        isolate: true,
        waypoint: {
          direction: [1.2, 0.8, -2.5],
          target: [0.2, 1.115, -0.24],
          scale: [0.4, 0.06, 0.06],
          fitFraction: 0.7,
        },
        annotations: [
          {
            label: 'Service Processor + RoT',
            description:
              'Same SP and root-of-trust as sleds and Sidecars. Reachable over the rack management network with an Ignition target for presence and faults.',
            position: [0.2, 0.02, -0.32],
          },
        ],
      },
      {
        title: 'Managing Rectifier Firmware',
        timestamp: 86,
        selectedId: 'power-shelf:1',
        isolate: true,
        waypoint: {
          direction: [1.2, 0.8, -2.5],
          target: [0.2, 1.115, -0.24],
          scale: [0.4, 0.06, 0.06],
          fitFraction: 0.7,
        },
        annotations: [
          {
            label: 'PSU firmware over PMBus',
            description:
              'Operators flash rectifier firmware in place via the PSC — no need to physically remove a PSU from the rack.',
            position: [0.2, 0.02, -0.32],
          },
        ],
      },
      {
        title: 'Hardware/Software Co-Design',
        timestamp: 105,
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

/** Get the active caption text for a video tour at the given time, or null. */
export function getCaptionAtTime(tour: VideoTour, time: number): string | null {
  if (!tour.captions) return null
  for (let i = tour.captions.length - 1; i >= 0; i--) {
    const c = tour.captions[i]
    if (time >= c.start && time <= c.end + 0.05) return c.text
  }
  return null
}
