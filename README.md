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
