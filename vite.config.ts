/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function analyticsPlugin(domain: string | undefined): Plugin {
  return {
    name: 'inject-analytics',
    transformIndexHtml(html) {
      if (!domain) return html.replace('<!--analytics-->', '')
      const tag = `<script defer data-domain="${domain}" src="/js/viewscript.js"></script>`
      return html.replace('<!--analytics-->', tag)
    },
  }
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return []
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

/** Fills public/sw.js's placeholders with every built file (plus the remote
 *  fonts) and a content hash, so the offline cache is complete and refreshes
 *  on each deploy. */
function precachePlugin(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'precache-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(root, config.build.outDir)
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      const hash = createHash('sha256')
      const files: string[] = []
      for (const path of listFiles(outDir).sort()) {
        if (path === swPath) continue
        files.push('/' + relative(outDir, path).split(sep).join('/'))
        hash.update(path).update(readFileSync(path))
      }
      const fontsCss = readFileSync(resolve(root, 'src/styles/fonts.css'), 'utf8')
      const fonts = [...fontsCss.matchAll(/url\('(https:[^']+\.woff2)'\)/g)].map(
        (m) => m[1],
      )
      const sw = readFileSync(swPath, 'utf8')
        .replace('__PRECACHE_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('/* __PRECACHE_FILES__ */ []', JSON.stringify([...files, ...fonts]))
      writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      analyticsPlugin(env.VITE_ANALYTICS_DOMAIN),
      precachePlugin(),
    ],
  }
})
