/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// Rack configurator: the options a buyer can choose (2nd Gen sleds only), the totals
// they add up to, and where extra racks sit on the data center floor.

import { getNode, type ComponentWaypoint } from './componentTree'

type Vec3 = [number, number, number]

export type ConfigOption = {
  id: string
  label: string
  detail: string
}

// ——— Options ———

/** Sled slots that can be populated: every bay in the rack. (The published
 *  spec lists up to 24 2nd Gen sleds per rack.) */
export const MAX_SLEDS = 32
export const MIN_SLEDS = 8
/** Sleds are added in pairs. */
export const SLED_STEP = 2

export const MAX_DRIVES_PER_SLED = 10
export const MIN_DRIVES_PER_SLED = 1

export const MAX_RACKS = 100
export const MIN_RACKS = 1

/** Per-sled CPU. One SKU for now; the spec only quotes the top bin. */
export const CPU = {
  label: 'AMD EPYC 9005 Series',
  cores: 192,
  threads: 384,
}

/** `watts` is the estimated draw of all 12 DIMMs in a sled. */
export const MEMORY_OPTIONS: (ConfigOption & { gib: number; watts: number })[] = [
  { id: '768', label: '768 GiB', detail: '12 × 64 GiB DDR5', gib: 768, watts: 60 },
  { id: '1152', label: '1152 GiB', detail: '12 × 96 GiB DDR5', gib: 1152, watts: 84 },
  { id: '1536', label: '1.5 TiB', detail: '12 × 128 GiB DDR5', gib: 1536, watts: 108 },
]

/** `watts` is the estimated active draw of one drive. */
export const DRIVE_OPTIONS: (ConfigOption & { tb: number; watts: number })[] = [
  { id: '3.84', label: '3.84 TB', detail: 'U.2 NVMe', tb: 3.84, watts: 12 },
  { id: '7.68', label: '7.68 TB', detail: 'U.2 NVMe', tb: 7.68, watts: 13 },
  { id: '15.36', label: '15.36 TB', detail: 'U.2 NVMe', tb: 15.36, watts: 14 },
  { id: '30.72', label: '30.72 TB', detail: 'U.2 NVMe', tb: 30.72, watts: 16 },
]

// ——— Power ———
// Rough estimates for a loaded rack, not measurements. Tune these against
// real numbers before quoting them to anyone.

/** Switches, power shelf conversion losses, and other per-rack overhead. */
const RACK_BASE_WATTS = 1500
/** Board, fans, NICs and service processor in each sled. */
const SLED_BASE_WATTS = 150
/** CPU under sustained load. */
const CPU_WATTS = 400

/** Published maximum with 1+1 redundant power shelves. */
export const MAX_RATED_RACK_KW = 21.6

export type RackConfig = {
  sleds: number
  memoryId: string
  driveId: string
  drivesPerSled: number
  racks: number
}

export const DEFAULT_CONFIG: RackConfig = {
  sleds: 16,
  memoryId: '1152',
  driveId: '7.68',
  drivesPerSled: 10,
  racks: 1,
}

// ——— Totals ———

export type RackTotals = {
  cores: number
  threads: number
  memoryGiB: number
  storageTB: number
  drives: number
  powerKW: number
}

const getMemory = (id: string) =>
  MEMORY_OPTIONS.find((o) => o.id === id) ?? MEMORY_OPTIONS[0]
const getDrive = (id: string) => DRIVE_OPTIONS.find((o) => o.id === id) ?? DRIVE_OPTIONS[0]

export function getRackTotals(config: RackConfig): RackTotals {
  const memory = getMemory(config.memoryId)
  const drive = getDrive(config.driveId)
  const drives = config.sleds * config.drivesPerSled
  const sledWatts =
    SLED_BASE_WATTS + CPU_WATTS + memory.watts + config.drivesPerSled * drive.watts
  return {
    cores: config.sleds * CPU.cores,
    threads: config.sleds * CPU.threads,
    memoryGiB: config.sleds * memory.gib,
    storageTB: drives * drive.tb,
    drives,
    powerKW: (RACK_BASE_WATTS + config.sleds * sledWatts) / 1000,
  }
}

export function scaleTotals(totals: RackTotals, factor: number): RackTotals {
  return {
    cores: totals.cores * factor,
    threads: totals.threads * factor,
    memoryGiB: totals.memoryGiB * factor,
    storageTB: totals.storageTB * factor,
    drives: totals.drives * factor,
    powerKW: totals.powerKW * factor,
  }
}

const numberFormat = new Intl.NumberFormat('en-US')
const decimalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export const formatCount = (n: number) => numberFormat.format(n)

export function formatMemory(gib: number): string {
  if (gib >= 1024) return `${decimalFormat.format(gib / 1024)} TiB`
  return `${numberFormat.format(gib)} GiB`
}

export function formatStorage(tb: number): string {
  if (tb >= 1000) return `${decimalFormat.format(tb / 1000)} PB`
  return `${decimalFormat.format(tb)} TB`
}

// ——— Physical layout ———

/** Rack envelope in scene units, matching the rack wireframe used elsewhere
 *  (centered on x/z, resting on the floor). */
export const RACK_SIZE: Vec3 = [0.64, 2.28, 1.07]
export const RACK_CENTER: Vec3 = [0, 1.205, 0]

/** Published dimensions, for labels. The scene envelope above is the model's
 *  bounding box, which is close to but not exactly these. */
export const RACK_DIMENSIONS_MM = { height: 2354, width: 600, depth: 1060 }

/** Racks per row before starting the next row. */
export const RACKS_PER_ROW = 10
/** Side-by-side pitch: racks in a row stand flush against each other. */
const RACK_PITCH_X = RACK_SIZE[0]
/** Row pitch: four floor tiles (each one rack wide), i.e. a two-tile rack
 *  footprint plus a two-tile (~1.2 m) aisle, so every row sits centered on
 *  the floor grid the same way the modelled rack does. */
const ROW_PITCH_Z = 4 * RACK_SIZE[0]

/** Floor position of rack `i`. Rack 0 (the modelled one) sits at the origin,
 *  at the end of the front row; the row grows away to the left and further
 *  rows sit behind it, so the wireframes never block the real rack. */
export function getRackPosition(i: number): Vec3 {
  const row = Math.floor(i / RACKS_PER_ROW)
  const col = i % RACKS_PER_ROW
  return [-col * RACK_PITCH_X, 0, -row * ROW_PITCH_Z]
}

/** Bounds of every rack in the layout, padded so the dimension labels on the
 *  modelled rack stay in frame. */
export function getLayoutBounds(racks: number): { min: Vec3; max: Vec3 } {
  const cols = Math.min(racks, RACKS_PER_ROW)
  const rows = Math.ceil(racks / RACKS_PER_ROW)
  const [w, h, d] = RACK_SIZE
  const pad = 0.25
  return {
    min: [-(cols - 1) * RACK_PITCH_X - w / 2, 0, -(rows - 1) * ROW_PITCH_Z - d / 2],
    max: [w / 2 + pad, RACK_CENTER[1] + h / 2, d / 2 + pad],
  }
}

/** Camera framing for the whole layout: the rack overview angle, pulled back
 *  until every rack fits. */
export function getLayoutWaypoint(racks: number): ComponentWaypoint {
  const { min, max } = getLayoutBounds(racks)
  return {
    direction: [5, 3.8, 10],
    target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    scale: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    fitFraction: 0.8,
  }
}

// ——— Sled fill order ———

/** Sled bays in the order they're populated: from the middle of the rack
 *  (next to the switches) outwards, alternating the halves above and below,
 *  so a partial rack keeps its weight centred. Indexes into the compute-sled
 *  instance list. */
const SLED_FILL_ORDER: number[] = (() => {
  const positions = getNode('compute-sled')?.node.instances ?? []
  const ys = positions.map((p) => p[1])
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2
  // Rounded so rows mirrored about the middle tie, letting the stable sort
  // keep the lower one (lower index) first.
  const distance = (y: number) => Math.round(Math.abs(y - middle) * 1e4)
  return positions.map((_, i) => i).sort((a, b) => distance(ys[a]) - distance(ys[b]))
})()

export function getFilledSledSlots(sleds: number): ReadonlySet<number> {
  return new Set(SLED_FILL_ORDER.slice(0, sleds))
}
