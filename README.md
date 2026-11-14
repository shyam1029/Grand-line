# Log Pose · Grand Line Explorer

An interactive 3D Log Pose. Hover an island and the needle swings onto it with a magnetic overshoot; select it and the camera flies there while the arc's lore slides in — without the WebGL scene ever reloading.

Built with **Astro 7**, **React Three Fiber 9**, **Three.js**, **GSAP**, **Nano Stores** and **Tailwind CSS 4**.

> Unofficial fan project. One Piece © Eiichiro Oda / Shueisha, Toei Animation. All models, shaders and sound are procedural; no official artwork or audio is used.

## Quick start

Requires **Node.js ≥ 22.23.4** (Astro 7's minimum; see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:4321
```

```bash
npm run build      # static site in dist/
npm run preview    # serve the production build
```

## How it fits together

```
src/
├── content.config.ts          Zod schema for the `arcs` collection
├── content/arcs/*.mdx         one file per island (frontmatter + lore)
├── layouts/BaseLayout.astro   shell: persistent canvas + persistent HUD + <main>
├── pages/
│   ├── index.astro            chart view
│   └── arcs/[slug].astro      lore page per island
├── components/
│   ├── IslandHUD.astro        lock status, danger skulls, bearing
│   ├── NavigationControls.astro  sound / explore / tilt toggles, quick-jump drawer
│   ├── ArcDrawer.astro        lore panel
│   └── canvas/                the R3F scene
│       ├── GrandLineCanvas.jsx    <Canvas> root, DPR clamp, context-loss handlers
│       ├── GrandLineScene.jsx     scene graph
│       ├── LogPoseModel.jsx       gimbals, glass dome, dual-state needle
│       ├── CameraRig.jsx          GSAP flights, parallax, drag orbit, view offset
│       ├── ArchipelagoNodes.jsx   island beacons + pointer events
│       ├── islandBlueprints.js    procedural low-poly island definitions
│       ├── OceanSurface.jsx       Gerstner ocean (drei shaderMaterial)
│       ├── SkyDome.jsx / AmbientProps.jsx / PostProcessingEffects.jsx
│       └── ToonMaterials.jsx      gradient map, brass rim, ink outline, <Inked>
├── shaders/                   GLSL: toonWater, inkOutline, sky, fresnelRim
├── stores/navigationStore.js  Nano Stores shared by canvas, HUD and router
└── lib/                       input (pointer/touch/gyro), audio, content helpers
```

**Persistence.** The canvas wrapper and the HUD are marked `transition:persist`, so Astro's `<ClientRouter />` moves the same DOM nodes into every page. One WebGL context, one set of compiled shaders, for the whole visit.

**State.** Three consumers share `navigationStore.js` and never import each other: the canvas (reads with `.get()` / `.listen()` inside `useFrame`, so nothing re-renders at 60 FPS), the HUD (plain `<script>` subscriptions that patch the DOM), and the router glue in `BaseLayout` (URL ↔ selected island).

**Needle.** With no target it drifts on summed sine turbulence. With a target, yaw is `Math.atan2(x, z)` from the island's coordinates and GSAP swings it with `back.out(1.7)`; sky islands also pitch the needle upward. The HUD reads "Recording Log…" until the swing completes, then "Log Locked".

**Look.** Cel shading uses a 4-tone `NearestFilter` gradient map on `MeshToonMaterial`. Ink lines are inverted hulls (`inkOutline.*.glsl`) scaled by view distance for constant on-screen weight. The ocean is a custom shader: four Gerstner waves, banded depth colour, Voronoi cel foam, crest caps, shoreline rings and pointer ripples.

## Adding an island

Create `src/content/arcs/NN-your-island.mdx`:

```yaml
---
title: "Your Island"
arcOrder: 7
seaRegion: "New World"        # Paradise | New World | Calm Belt
coordinates: { x: 20, y: 0, z: -8 }   # scene units; Log Pose at origin, -Z is "north"
magneticSignature: "How the Log behaves here"
dangerLevel: 3                # 1–5
summary: "Up to 280 characters."
featuredCharacters: ["…"]
keyLocations: ["…"]
---
```

It gets a route, a beacon, a drawer entry and a shoreline automatically. Without a bespoke entry in `islandBlueprints.js` it renders as a generic rocky island. The ocean shader supports up to 8 shorelines (`MAX_ISLANDS`).

## Controls

| Input | Action |
| --- | --- |
| Move pointer | Parallax; gimbals lean; ripples on the sea |
| Hover island / island link | Needle locks onto it |
| Click / tap island | Fly there and open its arc |
| Drag | Orbit (limited in guided mode, 360° in free mode) |
| Wheel / pinch | Zoom (free mode) |
| **Explore free / Reset camera** | Toggle the free-orbit overview |
| **Tilt** (touch devices) | Steer parallax with the gyroscope |
| **Sound** | Procedural ocean, gimbal clicks and lock chime (off by default) |

## Notes

- Sound is synthesised with the Web Audio API and only starts after it is switched on.
- `prefers-reduced-motion` shortens camera flights and damps parallax.
- No GLB or texture assets ship with the project; `vite.assetsInclude` is already set up for `.glb` / `.ktx2` if you add them.
