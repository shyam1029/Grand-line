/**
 * Shared navigation state (Nano Stores).
 *
 * This module is the single bridge between three worlds that never import
 * each other:
 *   - the persistent R3F canvas island (reads stores imperatively inside
 *     `useFrame` / store listeners, so React never re-renders at 60 FPS),
 *   - the static Astro HUD (plain `<script>` tags that subscribe and patch DOM),
 *   - the router glue in BaseLayout (maps URL <-> selected island).
 *
 * Islands are referenced by slug everywhere; the heavy island records are
 * passed to each consumer once and looked up locally.
 */
import { atom, computed } from 'nanostores';

/** Slug of the island under the pointer (or focused in the quick-jump list). */
export const $hoveredIsland = atom(null);

/** Slug of the island whose arc page is open (or about to be). */
export const $selectedIsland = atom(null);

/** The island the Log Pose needle should point at: hover wins over selection. */
export const $activeTarget = computed(
  [$hoveredIsland, $selectedIsland],
  (hovered, selected) => hovered ?? selected,
);

/** True once the needle has finished its swing and settled on the target. */
export const $needleLocked = atom(false);

/** 'recording' while drifting or mid-swing, 'locked' once settled on a target. */
export const $lockStatus = computed([$activeTarget, $needleLocked], (target, locked) =>
  target && locked ? 'locked' : 'recording',
);

/** Free-orbit camera mode (drag 360°, wheel/pinch zoom, slow auto-orbit). */
export const $freeExplore = atom(false);

/** Incremented to ask the camera rig to return to its composed pose. */
export const $cameraResetTick = atom(0);

/** Procedural audio is opt-in and starts muted. */
export const $soundEnabled = atom(false);

/** Device-orientation tilt drives the parallax instead of the pointer. */
export const $gyroEnabled = atom(false);

/** Flipped once the WebGL scene has presented its first frame. */
export const $sceneReady = atom(false);

/* ------------------------------- actions ------------------------------- */

export function hoverIsland(slug) {
  $hoveredIsland.set(slug ?? null);
}

export function selectIsland(slug) {
  const next = slug ?? null;
  // Choosing a destination always hands the camera back to the guided rig.
  if (next) $freeExplore.set(false);
  $selectedIsland.set(next);
}

export function setNeedleLocked(locked) {
  $needleLocked.set(Boolean(locked));
}

export function setFreeExplore(enabled) {
  $freeExplore.set(Boolean(enabled));
}

export function resetCamera() {
  $freeExplore.set(false);
  $cameraResetTick.set($cameraResetTick.get() + 1);
}

export function setSoundEnabled(enabled) {
  $soundEnabled.set(Boolean(enabled));
}

export function setGyroEnabled(enabled) {
  $gyroEnabled.set(Boolean(enabled));
}

export function markSceneReady() {
  $sceneReady.set(true);
}

/* ------------------------------- helpers ------------------------------- */

/** `/arcs/alabasta/` -> `alabasta`; anything else -> null. */
export function slugFromPath(pathname) {
  return pathname.match(/^\/arcs\/([^/]+)\/?$/)?.[1] ?? null;
}

/** Compass bearing (0–359°) of a point seen from the Log Pose; -Z is "north". */
export function bearingOf({ x, z }) {
  const degrees = (Math.atan2(x, -z) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360);
}
