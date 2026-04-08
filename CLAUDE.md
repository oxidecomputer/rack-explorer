# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rack Explorer is an interactive 3D web application for visualizing Oxide Rack hardware architecture. Users navigate a hierarchical component tree (rack → sleds → CPUs/disks/etc.) with smooth camera animations, and can take guided tours with step-by-step walkthroughs.

## Commands

- **Dev server:** `bun run dev` (Vite)
- **Build:** `bun run build` (runs `tsc -b && vite build`)
- **Lint:** `bun run lint` (ESLint)
- **Preview prod build:** `bun run preview`
- **Type check only:** `bunx tsc -b`

Package manager is **Bun**.

## Architecture

### State Management

Uses `@tldraw/state` reactive atoms (not Redux/Zustand). Core state lives in `src/atoms.ts`:
- `selectedId` / `hoveredId` — current selection and hover
- `navigationMode` — `'free'` (exploration) or `'guided'` (tour mode)
- `activeTourId` / `activeTourStepIndex` — guided tour state
- Computed atoms derive values (e.g., `activeTour`, `activeTourStep`)

Read atoms in React with `useValue()` from `@tldraw/state-react`.

### Component Tree (`src/data/componentTree.ts`)

Central data structure defining the hardware hierarchy. Each `ComponentNode` has:
- ID, label, model path (GLB), children, camera waypoint, specs reference
- Optional `instances: Vec3[]` for repeated components (e.g., 32 compute sleds in a 2×16 grid)

**ID convention:** `"component-id"` for single items, `"component-id:0"`, `"component-id:1"` for instances.

### 3D Rendering (`src/Scene.tsx`)

- React Three Fiber canvas with `CameraControls` for orbit/pan
- `SelectableGLBModel` — renders a single GLB model
- `InstancedGLBModel` — efficient instanced rendering for repeated components (single draw call for ~32 instances)
- GPU tier detection (`@pmndrs/detect-gpu`) adjusts DPR and post-processing
- DRACO-compressed GLB models loaded via `src/loaders.ts`
- Post-processing (selection outlines, AO) lazy-loaded via `React.lazy`

### Selection & Navigation Flow

1. User clicks 3D model → `selectedId` atom updates
2. Camera animates to the component's waypoint
3. Outline tree (left sidebar) highlights and expands to selection
4. Specifications panel (right sidebar) shows hardware specs
5. Keyboard: Escape = parent, Arrow Up/Down = siblings
6. Double-click background = navigate up the tree

### Guided Tours (`src/data/guidedTours.ts`)

Data-driven tour definitions with steps containing title, description, selectedId, and optional custom waypoints. In guided mode, direct interaction (clicks, keyboard nav) is disabled — navigation is through tour controls only.

### UI Layer

- **Tailwind CSS 4** with Oxide Design System (`@oxide/design-system`) for colors, typography, and icons
- **Motion (Framer Motion)** for animations — consistent spring config: `type: 'spring', duration: 0.5, bounce: 0`
- Key UI components: `Outline.tsx` (tree browser), `Specifications.tsx` (specs panel), `GuidedTourPanel.tsx`, `LandingModal.tsx`

## Conventions

- Prettier with 92 print width, import sorting (third-party → local `~/` → relative `./`)
- Strict TypeScript (`tsconfig.app.json`)
- Instance disposal: `InstancedGLBModel` manually disposes Three.js geometries/materials on unmount to prevent VRAM leaks
