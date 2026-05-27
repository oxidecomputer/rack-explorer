/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// Wraps EXT_disjoint_timer_query_webgl2 to measure GPU time per frame.
// Chrome/Edge expose it; Firefox/Safari often don't — returns null when unsupported.
//
// Usage:
//   const timer = new GPUTimer(gl);
//   timer.begin();   // before render
//   // ... draw commands ...
//   timer.end();     // after render
//   const gpuMs = timer.poll();  // returns any queries that have resolved, in order

type AnyGL = WebGLRenderingContext | WebGL2RenderingContext

interface TimerExt {
  TIME_ELAPSED_EXT: number
  GPU_DISJOINT_EXT: number
}

export class GPUTimer {
  private gl: WebGL2RenderingContext | null = null
  private ext: TimerExt | null = null
  private pending: WebGLQuery[] = []
  private active: WebGLQuery | null = null
  private resolved: number[] = []

  constructor(rawGl: AnyGL) {
    // Only WebGL2 path — this project uses a WebGL2 context.
    if (
      !(
        typeof WebGL2RenderingContext !== 'undefined' &&
        rawGl instanceof WebGL2RenderingContext
      )
    ) {
      return
    }
    this.gl = rawGl
    const ext = rawGl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null
    if (!ext) return
    this.ext = ext
  }

  get supported(): boolean {
    return this.ext !== null && this.gl !== null
  }

  begin(): void {
    if (!this.supported || this.active) return
    const gl = this.gl!
    const q = gl.createQuery()
    if (!q) return
    this.active = q
    gl.beginQuery(this.ext!.TIME_ELAPSED_EXT, q)
  }

  end(): void {
    if (!this.supported || !this.active) return
    const gl = this.gl!
    gl.endQuery(this.ext!.TIME_ELAPSED_EXT)
    this.pending.push(this.active)
    this.active = null
  }

  // Poll all in-flight queries, push resolved times to an internal buffer, and
  // return any newly resolved values (ms).
  poll(): number[] {
    if (!this.supported) return []
    const gl = this.gl!
    const drained: number[] = []
    const stillPending: WebGLQuery[] = []
    const disjoint = gl.getParameter(this.ext!.GPU_DISJOINT_EXT)
    for (const q of this.pending) {
      const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)
      if (!available) {
        stillPending.push(q)
        continue
      }
      if (!disjoint) {
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number
        drained.push(ns / 1_000_000)
      }
      gl.deleteQuery(q)
    }
    this.pending = stillPending
    for (const ms of drained) this.resolved.push(ms)
    return drained
  }

  getAllResolved(): number[] {
    return this.resolved.slice()
  }

  dispose(): void {
    if (!this.gl) return
    for (const q of this.pending) this.gl.deleteQuery(q)
    if (this.active) this.gl.deleteQuery(this.active)
    this.pending = []
    this.active = null
  }
}
