/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/**
 * Frame-rate sampler for adaptive quality, built for `frameloop="demand"`.
 *
 * drei's <PerformanceMonitor> assumes continuous rendering: its sample window
 * stays open across idle gaps, so a 0.4s camera move followed by 3s of idle
 * reads as ~9fps. In demand mode that ratchets quality down during ordinary
 * click-browsing, and an idle device produces no samples at all, which the
 * old tier promotion read as "fast".
 *
 * This monitor is fed only real frame intervals — the gap between two frames
 * where the second was already queued when the first finished (see
 * AdaptivePerformanceMonitor). Short bursts accumulate into one sample until
 * `sampleMs` of actual rendering has been observed, so idle time never
 * counts as slowness, and a device that never renders never produces
 * evidence either way.
 *
 * Decision rule matches drei's: every `iterations` samples, if more than
 * `threshold` of them sit at/above the upper bound the factor steps up; if
 * more than `threshold` sit below the lower bound it steps down.
 */

export type Bounds = (refreshRate: number) => [lower: number, upper: number]

export interface FrameRateMonitorOptions {
  /** Rendering time (ms) aggregated into one fps sample. */
  sampleMs?: number
  /** Samples per incline/decline decision. */
  iterations?: number
  /** Fraction of samples that must agree before the factor moves. */
  threshold?: number
  step?: number
  initialFactor?: number
  bounds?: Bounds
  /** Intervals longer than this are discarded (e.g. a backgrounded tab
   *  resuming with a frame still queued). */
  maxIntervalMs?: number
}

export interface FrameRateSample {
  fps: number
  /** Rendering time this sample covers. */
  sampleMs: number
  /** Sample at/above the upper bound — rendering at full display rate. */
  healthy: boolean
  /** Set when this sample completed a decision that moved the factor. */
  change: 'incline' | 'decline' | null
  factor: number
}

// Interval-derived fps lands fractionally under the display rate (59.9 on a
// 60Hz panel) where drei's frame-count-based fps lands just over it. Without
// a little slack the upper bound would be unreachable.
const UPPER_TOLERANCE = 0.95

const defaultBounds: Bounds = (refreshRate) => (refreshRate > 90 ? [60, 100] : [30, 60])

export class FrameRateMonitor {
  factor: number
  refreshRate = 0

  private readonly sampleMs: number
  private readonly iterations: number
  private readonly threshold: number
  private readonly step: number
  private readonly bounds: Bounds
  private readonly maxIntervalMs: number

  private windowMs = 0
  private windowFrames = 0
  private samples: number[] = []

  constructor(options: FrameRateMonitorOptions = {}) {
    this.sampleMs = options.sampleMs ?? 500
    this.iterations = options.iterations ?? 10
    this.threshold = options.threshold ?? 0.75
    this.step = options.step ?? 0.1
    this.factor = options.initialFactor ?? 1
    this.bounds = options.bounds ?? defaultBounds
    this.maxIntervalMs = options.maxIntervalMs ?? 1000
  }

  /** Drop partial evidence (e.g. after a tier change, so samples taken at
   *  the old settings don't count toward a decision at the new ones). */
  reset(): void {
    this.windowMs = 0
    this.windowFrames = 0
    this.samples = []
  }

  /** Feed one real frame interval. Returns a sample every `sampleMs` of
   *  accumulated rendering, otherwise null. */
  addInterval(ms: number): FrameRateSample | null {
    if (!(ms > 0) || ms > this.maxIntervalMs) return null
    this.windowMs += ms
    this.windowFrames++
    if (this.windowMs < this.sampleMs) return null

    const sampleMs = this.windowMs
    const fps = (this.windowFrames / sampleMs) * 1000
    this.windowMs = 0
    this.windowFrames = 0

    this.refreshRate = Math.max(this.refreshRate, fps)
    const [lower, upper] = this.bounds(this.refreshRate)
    const upperBound = upper * UPPER_TOLERANCE
    this.samples.push(fps)

    let change: FrameRateSample['change'] = null
    if (this.samples.length >= this.iterations) {
      const high = this.samples.filter((v) => v >= upperBound).length
      const low = this.samples.filter((v) => v < lower).length
      const needed = this.iterations * this.threshold
      if (high > needed && this.factor < 1) {
        this.factor = Math.min(1, round(this.factor + this.step))
        change = 'incline'
      } else if (low > needed && this.factor > 0) {
        this.factor = Math.max(0, round(this.factor - this.step))
        change = 'decline'
      }
      this.samples = []
    }

    return { fps, sampleMs, healthy: fps >= upperBound, change, factor: this.factor }
  }
}

// Keep factor on clean tenths so 1 - 0.1 * n comparisons stay exact.
const round = (v: number) => Math.round(v * 1000) / 1000
