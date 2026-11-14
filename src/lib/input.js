/**
 * Pointer / touch / gyroscope input, shared as one plain mutable object.
 *
 * This is deliberately NOT a store: it changes on every pointer event and is
 * only ever read inside `useFrame`, so nothing should subscribe or re-render.
 *
 * `x` / `y` are Normalized Device Coordinates in [-1, 1] (y up), tracked on
 * `window` rather than on the canvas so parallax keeps working while the
 * cursor is over the HTML HUD. R3F's own `state.pointer` still drives
 * raycasting against the island beacons.
 */
export const input = {
  x: 0,
  y: 0,
  /** True while a pointer that went down on the canvas is still held. */
  dragging: false,
  /** Accumulated drag / zoom deltas in CSS px; consumed and zeroed by the camera rig. */
  dragDX: 0,
  dragDY: 0,
  wheel: 0,
  /** True while device orientation is steering `x` / `y`. */
  gyro: false,
  /** `performance.now()` of the last pointer movement (drives ocean ripples). */
  lastMove: 0,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Wire DOM listeners. Drags and zoom gestures must start on the canvas so that
 * scrolling the lore drawer never orbits the camera.
 * @param {HTMLCanvasElement} canvas
 * @returns {() => void} cleanup
 */
export function attachInput(canvas) {
  /** pointerId -> last known position, for drag and pinch tracking. */
  const pointers = new Map();
  let pinchDistance = 0;

  const currentPinch = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerMove = (event) => {
    if (!input.gyro || event.pointerType === 'mouse') {
      // PDF spec §3.1 — screen px to NDC.
      input.x = (event.clientX / window.innerWidth) * 2 - 1;
      input.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    input.lastMove = performance.now();

    const tracked = pointers.get(event.pointerId);
    if (!tracked) return;

    if (pointers.size === 1) {
      input.dragDX += event.clientX - tracked.x;
      input.dragDY += event.clientY - tracked.y;
    }
    tracked.x = event.clientX;
    tracked.y = event.clientY;

    if (pointers.size === 2) {
      const distance = currentPinch();
      // Pinch out = zoom in, matching wheel-up.
      input.wheel -= (distance - pinchDistance) * 2.5;
      pinchDistance = distance;
    }
  };

  const onPointerDown = (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    input.dragging = true;
    if (pointers.size === 2) pinchDistance = currentPinch();
  };

  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    input.dragging = pointers.size > 0;
  };

  const onWheel = (event) => {
    input.wheel += event.deltaY;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };
}

/* ----------------------------- gyroscope ----------------------------- */

/** PDF spec §3.5 — beta (pitch) and gamma (roll) normalised to [-1, 1]. */
function handleOrientation(event) {
  if (event.beta == null || event.gamma == null) return;
  // A phone is naturally held tilted back ~45°, so treat that as level.
  input.x = clamp(event.gamma / 45, -1, 1);
  input.y = clamp((event.beta - 45) / 45, -1, 1);
  input.lastMove = performance.now();
}

export function isGyroSupported() {
  return (
    typeof window !== 'undefined' &&
    'DeviceOrientationEvent' in window &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Start steering with device tilt. Must be called from a user gesture:
 * iOS requires an explicit permission prompt.
 * @returns {Promise<boolean>} whether tilt control is now active
 */
export async function enableGyro() {
  if (!isGyroSupported()) return false;
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') return false;
    }
  } catch {
    return false;
  }
  window.addEventListener('deviceorientation', handleOrientation, true);
  input.gyro = true;
  return true;
}

export function disableGyro() {
  window.removeEventListener('deviceorientation', handleOrientation, true);
  input.gyro = false;
  input.x = 0;
  input.y = 0;
}

/** Honour the OS "reduce motion" setting for parallax and camera flights. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
