# Rack Explorer

An interactive 3D view of the [Oxide Cloud Computer](https://oxide.computer), live at
[explorer.oxide.computer](https://explorer.oxide.computer).

Navigate the rack hierarchy — from the chassis down to sleds, CPUs, DIMMs, and disks — or
take a guided tour through how the system fits together.

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev      # start the dev server
bun run build    # type-check and build for production
bun run lint     # oxlint
```

## Analytics

Analytics are off by default. The canonical deploy at `explorer.oxide.computer` sets
`VITE_ANALYTICS_DOMAIN` at build time, which injects a [Plausible](https://plausible.io)
script proxied through the `vercel.json` rewrites. Forks build with the variable unset and
ship no analytics. Setting this var also turns on the cookie popup, so to test the cookie
popup locally, you can use `VITE_ANALYTICS_DOMAIN=localhost bun run dev`.

## Kiosk mode

For running unattended on a shared device, such as an iPad at a conference booth. Turn it on
with the **Kiosk Mode** toggle in Options, or with `?kiosk=1` (`?kiosk=0` turns it off). The
setting is saved in local storage, so the app relaunches straight into it.

In kiosk mode:

- **Idle tour.** On launch, and after 30 seconds without input, the app resets and plays the
  first guided tour on its own: steps advance every 12 seconds while the camera orbits. The
  first touch hands control to the visitor at the current step. A playing video tour counts
  as activity.
- **No way out.** The header and Options are hidden, outbound links are removed, and Contact
  Sales becomes a QR code.
- **No tracking.** The cookie banner and trackers are skipped and Plausible ignores the
  device. The free-explore tutorial is never marked as seen, so every visitor gets it.
- **Touch lockdown.** No long-press selection or callouts, page pinch-zoom or
  rubber-banding. Pinching the 3D view still zooms the camera.
- **Self-refresh.** After 4 hours of uptime, the next idle reset reloads the page to free
  GPU memory and pick up any new deploy.

To leave kiosk mode, **hold the top-left corner of the screen for 3 seconds**.

Timings are constants at the top of `src/useKiosk.ts`.

### Offline cache

When launched as a home-screen app (and only in production builds), a service worker
(`public/sw.js`) precaches every built file, model, video and font — about 16MB — so the app
runs without a network after its first launch. The build fills in the file list and a
content hash, so each deploy installs a fresh cache. A running app picks up a deploy the
next time it fully reloads.

### Setting up an iPad

Install from the production domain, not a preview URL: the saved app and its cache are tied
to one origin.

1. **Save it as an app.** In Safari, open
   [explorer.oxide.computer](https://explorer.oxide.computer) and tap **Share → Add to Home
   Screen** (with **Open as Web App** on, where shown). Launch it from the home-screen icon:
   it runs full screen, with no address bar.
2. **Let it cache.** Leave it open on good Wi-Fi for a minute or two. To confirm, switch on
   airplane mode, force-quit and relaunch, and play the video tour.
3. **Turn on kiosk mode** from Options _inside the saved app_. Home-screen apps don't share
   storage with Safari, and have no address bar for `?kiosk=1`.
4. **Lock the iPad to the app with Guided Access.** In Settings → Accessibility → Guided
   Access, turn it on, set a passcode, set its Display Auto-Lock to Never and turn on the
   Accessibility Shortcut. Then, in the app, triple-click the top (or Home) button. Under
   Options, turn off Motion (locks orientation), Hardware Buttons and Keyboards. Rotate to
   landscape, then tap **Start**.
5. **Quiet the device.** Turn on Do Not Disturb, turn off Siri, Low Power Mode and automatic
   software updates, turn brightness up, and keep it on a charger.

To get out, triple-click and enter the passcode to end Guided Access, then hold the top-left
corner for 3 seconds to leave kiosk mode.

Things to know:

- **Landscape only.** In portrait (under 1000px wide) the app falls back to its mobile
  layout, and some of its controls live in the header that kiosk mode hides.
- **Guided Access ends on restart.** Relaunch the app and triple-click again; kiosk mode
  itself is remembered. For multi-day unattended setups, Single App Mode via Apple
  Configurator or MDM survives restarts but needs a supervised (wiped) iPad.
- **Updating the icon.** iOS caches home-screen icons. After changing
  `public/apple-touch-icon.png`, delete the icon and add it again.

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
- `src/useKiosk.ts` — kiosk idle detection and the idle tour loop
- `public/sw.js` — offline cache for the home-screen app
- `models/`, `public/models/` — GLB assets (LOD0 / LOD1)

## Licensing

Source code is licensed under the [Mozilla Public License 2.0](LICENSE).

The 3D models, textures, images, and other binary assets are licensed under
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). They may not be used
for commercial purposes or in derivative works. See [LICENSE-ASSETS](LICENSE-ASSETS) for
full terms and covered paths.

**Trademark notice:** The Oxide name, logo, and hardware designs are trademarks or trade
dress of Oxide Computer Company. Nothing in these licenses grants the right to use them in
any way that suggests endorsement or affiliation with Oxide Computer Company. Some models
depict third-party components; all third-party trademarks remain the property of their
respective owners and their inclusion does not imply endorsement by those manufacturers.
