# Rack Explorer

An interactive 3D view of the [Oxide Cloud Computer](https://oxide.computer), live at [explorer.oxide.computer](https://explorer.oxide.computer).

Navigate the rack hierarchy — from the chassis down to sleds, CPUs, DIMMs, and disks — or take a guided tour through how the system fits together.

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev      # start the dev server
bun run build    # type-check and build for production
bun run lint     # oxlint
```

## Analytics

Analytics are off by default. The canonical deploy at `explorer.oxide.computer` sets `VITE_ANALYTICS_DOMAIN` at build time, which injects a [Plausible](https://plausible.io) script proxied through the `vercel.json` rewrites. Forks build with the variable unset and ship no analytics.

## Stack

- React 19 + Vite
- React Three Fiber / Three.js (with DRACO-compressed glTF)
- `@tldraw/state` for reactive state
- Tailwind CSS 4 + [Oxide Design System](https://github.com/oxidecomputer/design-system)
- Motion (Framer Motion) for animations

## Structure

- `src/Scene.tsx` — 3D scene, camera, selection, instanced rendering
- `src/data/componentTree.ts` — hardware hierarchy (rack → sleds → components)
- `src/data/guidedTours.ts` — tour definitions
- `src/data/specifications.ts` — hardware specs shown in the side panel
- `models/`, `public/models/` — GLB assets (LOD0 / LOD1)

## Licensing

Source code is licensed under the [Mozilla Public License 2.0](LICENSE).

The 3D models, textures, images, and other binary assets are licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). They may not be used for commercial purposes or in derivative works. See [LICENSE-ASSETS](LICENSE-ASSETS) for full terms and covered paths.

**Trademark notice:** The Oxide name, logo, and hardware designs are trademarks or trade dress of Oxide Computer Company. Nothing in these licenses grants the right to use them in any way that suggests endorsement or affiliation with Oxide Computer Company. Some models depict third-party components; all third-party trademarks remain the property of their respective owners and their inclusion does not imply endorsement by those manufacturers.
