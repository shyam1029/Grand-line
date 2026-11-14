/**
 * Camera rig.
 *
 * A GSAP-driven "base pose" (position + look target) is layered with three
 * frame-rate-independent offsets, all applied by mutating the camera inside
 * `useFrame`:
 *
 *   1. drag orbit   — yaw / pitch around the look target (touch + mouse drag)
 *   2. zoom         — wheel / pinch, free-explore mode only
 *   3. parallax     — the camera slides against the pointer while `lookAt`
 *                     stays locked, which is what sells the depth
 *
 * Base poses:
 *   home    composed view of the Log Pose with the archipelago behind it
 *   island  a three-quarter vantage beside the selected island
 *   free    a high, wide overview that slowly orbits
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { MAX_DELTA } from './sceneConfig.js';
import { input, prefersReducedMotion } from '../../lib/input.js';
import { $cameraResetTick, $freeExplore, $selectedIsland } from '../../stores/navigationStore.js';

const { damp, clamp } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

/** Radius around the Log Pose that a camera flight must not cut through. */
const KEEP_OUT_RADIUS = 4.4;
const FLYOVER_HEIGHT = 9.4;

function homePose(aspect) {
  // Narrow viewports pull back so the Log Pose keeps some sea around it.
  const k = clamp(1.5 / aspect, 1, 2.1);
  return {
    position: new THREE.Vector3(0, 8.4 * k, 12.6 * k),
    target: new THREE.Vector3(0, 3.9, -4),
  };
}

function freePose(aspect) {
  const k = clamp(1.5 / aspect, 1, 1.8);
  return {
    position: new THREE.Vector3(0, 16 * k, 27 * k),
    target: new THREE.Vector3(0, 1.5, -7),
  };
}

function islandPose({ x, y, z }, aspect) {
  const k = clamp(1.15 / aspect, 1, 1.7);
  const island = new THREE.Vector3(x, y, z);
  // Stand on the Log Pose side of the island, nudged toward the home camera,
  // so the island is seen in gentle three-quarter view against open sea and
  // its neighbours stay out at the edges of the frame.
  const outward = new THREE.Vector3(x, 0, z).normalize();
  outward.applyAxisAngle(UP, x >= 0 ? 0.22 : -0.22);
  return {
    position: island.clone().addScaledVector(outward, -12.5 * k).add(new THREE.Vector3(0, 4.6 * k, 0)),
    target: island.clone().add(new THREE.Vector3(0, 2.3, 0)),
  };
}

/**
 * How much to lift the midpoint of a flight so it arcs over the Log Pose
 * instead of clipping through it.
 */
function flyoverLift(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 1e-6) return 0;
  // Parameter of the point on the segment closest to the Log Pose axis.
  const t = clamp(-(from.x * dx + from.z * dz) / lengthSq, 0, 1);
  const closest = Math.hypot(from.x + dx * t, from.z + dz * t);
  if (closest > KEEP_OUT_RADIUS) return 0.6;
  const heightThere = from.y + (to.y - from.y) * t;
  const needed = Math.max(0, FLYOVER_HEIGHT - heightThere);
  return clamp(needed / Math.max(Math.sin(Math.PI * t), 0.35), 0.6, 7);
}

export function CameraRig({ islands }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const aspect = size.width / size.height;

  const bySlug = useMemo(() => new Map(islands.map((island) => [island.slug, island])), [islands]);

  const rig = useRef(null);
  if (rig.current === null) {
    rig.current = {
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      tween: null,
      initialised: false,
      aspect,
      // Drag orbit / zoom: current values chase their targets.
      yaw: 0,
      yawTarget: 0,
      pitch: 0,
      pitchTarget: 0,
      zoom: 1,
      zoomTarget: 1,
      // Smoothed pointer for parallax, and smoothed view offset in px.
      px: 0,
      py: 0,
      viewX: 0,
      viewY: 0,
    };
  }

  const scratch = useMemo(
    () => ({ offset: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() }),
    [],
  );

  /* ---------------- Base pose resolution & flights ---------------- */
  useEffect(() => {
    const state = rig.current;
    state.aspect = aspect;

    const resolvePose = () => {
      if ($freeExplore.get()) return freePose(state.aspect);
      const island = bySlug.get($selectedIsland.get());
      return island ? islandPose(island.coordinates, state.aspect) : homePose(state.aspect);
    };

    const flyTo = (pose, duration) => {
      state.tween?.kill();
      // Unwind any free-orbit turns so the reset takes the short way round.
      state.yaw = ((((state.yaw + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      state.yawTarget = 0;
      state.pitchTarget = 0;
      state.zoomTarget = 1;

      const fromPosition = state.position.clone();
      const fromTarget = state.target.clone();
      const lift = flyoverLift(fromPosition, pose.position);
      const progress = { t: 0 };

      state.tween = gsap.to(progress, {
        t: 1,
        duration: prefersReducedMotion() ? 0.01 : duration,
        ease: 'power3.inOut',
        onUpdate: () => {
          state.position.lerpVectors(fromPosition, pose.position, progress.t);
          state.position.y += Math.sin(Math.PI * progress.t) * lift;
          state.target.lerpVectors(fromTarget, pose.target, progress.t);
        },
      });
    };

    if (!state.initialised) {
      // First mount: start composed, no flight.
      const pose = resolvePose();
      state.position.copy(pose.position);
      state.target.copy(pose.target);
      state.initialised = true;
    } else {
      // Viewport changed shape: recompose quickly.
      flyTo(resolvePose(), 0.6);
    }

    const unsubscribe = [
      $selectedIsland.listen(() => flyTo(resolvePose(), 2.4)),
      $freeExplore.listen(() => flyTo(resolvePose(), 2.0)),
      $cameraResetTick.listen(() => flyTo(resolvePose(), 1.4)),
    ];

    return () => {
      unsubscribe.forEach((off) => off());
      state.tween?.kill();
    };
  }, [aspect, bySlug]);

  /* ---------------- Per-frame composition ---------------- */
  useFrame((frame, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    const state = rig.current;
    const free = $freeExplore.get();
    const calm = prefersReducedMotion();

    // 1. Consume drag / zoom input.
    if (free) {
      state.yawTarget -= input.dragDX * 0.005;
      state.pitchTarget = clamp(state.pitchTarget + input.dragDY * 0.003, -0.3, 0.45);
      state.zoomTarget = clamp(state.zoomTarget * (1 + input.wheel * 0.0009), 0.45, 1.5);
      if (!input.dragging && !calm) state.yawTarget += dt * 0.045; // idle auto-orbit
    } else {
      state.yawTarget = clamp(state.yawTarget - input.dragDX * 0.004, -1.15, 1.15);
      state.pitchTarget = clamp(state.pitchTarget + input.dragDY * 0.0025, -0.12, 0.3);
    }
    input.dragDX = 0;
    input.dragDY = 0;
    input.wheel = 0;

    state.yaw = damp(state.yaw, state.yawTarget, 5, dt);
    state.pitch = damp(state.pitch, state.pitchTarget, 5, dt);
    state.zoom = damp(state.zoom, state.zoomTarget, 5, dt);

    // 2. Orbit the base offset around the look target.
    const { offset, right, up } = scratch;
    offset.copy(state.position).sub(state.target);
    offset.applyAxisAngle(UP, state.yaw);
    right.crossVectors(UP, offset).normalize();
    offset.applyAxisAngle(right, -state.pitch);
    offset.multiplyScalar(state.zoom);

    camera.position.copy(state.target).add(offset);
    camera.lookAt(state.target);

    // 3. Counter-parallax: slide against the pointer, keep looking at the target.
    const strength = calm ? 0.2 : 1;
    state.px = damp(state.px, input.x * strength, 3, dt);
    state.py = damp(state.py, input.y * strength, 3, dt);
    const distance = offset.length();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(right, -state.px * distance * 0.085);
    camera.position.addScaledVector(up, -state.py * distance * 0.05);
    camera.lookAt(state.target);

    // 4. Shift the projection so the subject stays clear of the lore drawer:
    //    right of the docked panel on desktop, above the bottom sheet on mobile.
    const { width, height } = frame.size;
    const framed = !free && $selectedIsland.get() !== null;
    const wide = width >= 1024;
    const targetX = framed && wide ? -(Math.min(416, width * 0.42) + 24) / 2 : 0;
    const targetY = framed && !wide ? height * 0.2 : 0;
    state.viewX = damp(state.viewX, targetX, 4, dt);
    state.viewY = damp(state.viewY, targetY, 4, dt);

    if (Math.abs(state.viewX) > 0.5 || Math.abs(state.viewY) > 0.5) {
      camera.setViewOffset(width, height, state.viewX, state.viewY, width, height);
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
  });

  return null;
}
