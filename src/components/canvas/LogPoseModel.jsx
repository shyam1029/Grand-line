/**
 * The Log Pose: a double-gimballed brass compass with a glass dome and a
 * magnetic needle, built entirely from procedural geometry.
 *
 * Hierarchy
 *   root (hovers above the sea, drei <Float>)
 *   └─ housing            — tilts with damped pointer inertia
 *      ├─ stand + yoke    — aged brass, fixed
 *      ├─ outer gimbal    — pivots on the yoke (X axis)
 *      │  └─ inner gimbal — pivots on the outer ring (Y axis), counter-rotating
 *      └─ globe           — gyroscopically level: bezel, glass dome, needle
 *         └─ needle yaw → pitch → tremor
 *
 * Nothing here causes a React re-render after mount: stores are read with
 * `.get()` / `.listen()` and every transform is written straight to a ref.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Inked, brassMaterial, createToonMaterial, smoothGeometry, toonMaterial } from './ToonMaterials.jsx';
import { MAX_DELTA, SCENE } from './sceneConfig.js';
import { input, prefersReducedMotion } from '../../lib/input.js';
import { $activeTarget, $needleLocked, setNeedleLocked } from '../../stores/navigationStore.js';
import rimVertexShader from '../../shaders/fresnelRim.vert.glsl?raw';
import rimFragmentShader from '../../shaders/fresnelRim.frag.glsl?raw';

const { damp, clamp } = THREE.MathUtils;

const GLOBE_RADIUS = 0.8;
const OUTER_RADIUS = 1.2;
const INNER_RADIUS = 1.0;
const YOKE_RADIUS = 1.42;
const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

/** One half of the needle: a flattened four-sided spike pointing along ±Z. */
function needleBlade(direction) {
  const blade = new THREE.ConeGeometry(0.085, 0.6, 4);
  blade.rotateX(direction * HALF_PI);
  blade.scale(1, 0.42, 1);
  blade.translate(0, 0, direction * 0.3);
  return smoothGeometry(blade);
}

function buildGeometry() {
  return {
    globe: new THREE.SphereGeometry(GLOBE_RADIUS, 48, 32),
    rimShell: new THREE.SphereGeometry(GLOBE_RADIUS * 1.02, 48, 32),
    outerRing: new THREE.TorusGeometry(OUTER_RADIUS, 0.055, 12, 72),
    innerRing: new THREE.TorusGeometry(INNER_RADIUS, 0.045, 12, 72),
    yoke: new THREE.TorusGeometry(YOKE_RADIUS, 0.065, 12, 48, Math.PI),
    bezel: new THREE.TorusGeometry(GLOBE_RADIUS + 0.005, 0.042, 10, 72),
    stud: new THREE.SphereGeometry(1, 16, 12),
    pin: smoothGeometry(new THREE.CylinderGeometry(1, 1, 1, 12)),
    cap: smoothGeometry(new THREE.CylinderGeometry(0.13, 0.21, 0.1, 20)),
    collar: smoothGeometry(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 16)),
    stem: smoothGeometry(new THREE.CylinderGeometry(0.065, 0.09, 0.34, 12)),
    footTop: smoothGeometry(new THREE.CylinderGeometry(0.16, 0.5, 0.14, 24)),
    footMid: smoothGeometry(new THREE.CylinderGeometry(0.56, 0.64, 0.12, 24)),
    footBase: smoothGeometry(new THREE.CylinderGeometry(0.7, 0.7, 0.07, 24)),
    needleNorth: needleBlade(1),
    needleSouth: needleBlade(-1),
  };
}

function buildMaterials() {
  return {
    brass: brassMaterial('#d9a441'),
    brassPolished: brassMaterial('#f0c25a', '#fff6d8', 0.7),
    brassAged: brassMaterial('#a9772d', '#ffdf9a', 0.4),
    iron: toonMaterial('#2c2f36'),
    needleSouth: toonMaterial('#5d7fa3', { flatShading: true }),
    // Unique instances: their emissive intensity is animated per frame.
    needleNorth: createToonMaterial({ color: '#e0483a', emissive: '#ff5a3c', emissiveIntensity: 0, flatShading: true }),
    tip: createToonMaterial({ color: '#ffe9a8', emissive: '#ffb347', emissiveIntensity: 0.4 }),
    rim: new THREE.ShaderMaterial({
      name: 'FresnelRim',
      vertexShader: rimVertexShader,
      fragmentShader: rimFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color('#bff4ff') },
        uStrength: { value: 0.55 },
        uPower: { value: 2.4 },
      },
      transparent: true,
      depthWrite: false,
      // Premultiplied "add, then ink": colour is added where alpha is 0 and
      // the destination is blacked out where alpha is 1 (the silhouette line).
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  };
}

/** Signed shortest rotation from `from` to `to`, in (-π, π]. */
function shortestArc(from, to) {
  return ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
}

export function LogPoseModel({ islands }) {
  const housing = useRef();
  const outerGimbal = useRef();
  const innerGimbal = useRef();
  const needleYaw = useRef();
  const needlePitch = useRef();
  const needleTremor = useRef();

  const geometry = useMemo(buildGeometry, []);
  const materials = useMemo(buildMaterials, []);
  const targets = useMemo(() => new Map(islands.map((island) => [island.slug, island.coordinates])), [islands]);

  // Geometry and the per-instance materials are owned here; the shared toon
  // kit is disposed by the scene root.
  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      materials.needleNorth.dispose();
      materials.tip.dispose();
      materials.rim.dispose();
    },
    [geometry, materials],
  );

  /* ---------------- Target Lock mode: GSAP swing onto the island ---------------- */
  useEffect(() => {
    const yaw = needleYaw.current.rotation;
    const pitch = needlePitch.current.rotation;
    const swing = prefersReducedMotion() ? 0.2 : 1.4;

    const retarget = (slug) => {
      gsap.killTweensOf([yaw, pitch]);
      setNeedleLocked(false);

      const target = slug ? targets.get(slug) : null;
      if (!target) {
        // Back to Explore mode: level out and let the turbulence take over.
        gsap.to(pitch, { x: 0, duration: 0.9, ease: 'power2.out' });
        return;
      }

      // The needle pivot sits at the Log Pose origin (x = z = 0).
      const dx = target.x;
      const dz = target.z;
      const dy = target.y + 2 - SCENE.logPoseHeight;
      const targetYaw = Math.atan2(dx, dz);
      // Sky islands pull the needle upward; clamp so it stays inside the dome.
      const targetPitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5);

      gsap.to(yaw, {
        // Swing through the shortest arc from wherever the turbulence left it.
        y: yaw.y + shortestArc(yaw.y, targetYaw),
        duration: swing,
        ease: 'back.out(1.7)', // magnetic overshoot, then settle
        overwrite: true,
        onComplete: () => setNeedleLocked(true),
      });
      gsap.to(pitch, { x: targetPitch, duration: swing, ease: 'back.out(1.7)', overwrite: true });
    };

    retarget($activeTarget.get());
    const unsubscribe = $activeTarget.listen(retarget);
    return () => {
      unsubscribe();
      gsap.killTweensOf([yaw, pitch]);
    };
  }, [targets]);

  /* ---------------- Continuous physics (60 FPS, refs only) ---------------- */
  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    const time = state.clock.elapsedTime;
    const px = input.x;
    const py = input.y;

    // Housing: heavy brass leaning a few degrees toward the cursor.
    const housingRotation = housing.current.rotation;
    housingRotation.x = damp(housingRotation.x, -py * 0.1, 3, dt);
    housingRotation.z = damp(housingRotation.z, -px * 0.12, 3, dt);

    // Outer gimbal: pitches with the pointer, plus a slow precession.
    const outer = outerGimbal.current.rotation;
    outer.x = damp(outer.x, 0.38 + py * 0.45 + Math.sin(time * 0.6) * 0.1, 4, dt);

    // Inner gimbal: counter-rotates against the pointer with a gyroscopic wobble.
    const inner = innerGimbal.current.rotation;
    inner.y = damp(inner.y, 0.78 - px * 0.55 + Math.cos(time * 0.45) * 0.14, 5, dt);
    inner.z = damp(inner.z, px * 0.2 + Math.sin(time * 2.0) * 0.05, 5, dt);

    const hasTarget = $activeTarget.get() !== null;
    const locked = hasTarget && $needleLocked.get();

    // Explore mode: unstable Grand Line magnetism — two fast sine terms for
    // the jitter (1.5 Hz / 4.2 Hz, per spec) and a slow one so it wanders.
    if (!hasTarget) {
      const turbulence = Math.sin(time * 1.5) * 0.12 + Math.cos(time * 4.2) * 0.04;
      const wander = Math.sin(time * 0.27) * 0.16;
      needleYaw.current.rotation.y += (turbulence * 3.2 + wander) * dt;
    }

    // Micro-oscillation: lively while searching, a faint hum once locked.
    const tremor = locked ? 0.006 : hasTarget ? 0.02 : 0.035;
    needleTremor.current.rotation.y = Math.sin(time * 11.0) * tremor + Math.sin(time * 6.3) * tremor * 0.6;
    needleTremor.current.rotation.x = Math.cos(time * 7.1) * tremor * 0.5;

    // The north tip glows when the Log is set (picked up by Bloom).
    materials.tip.emissiveIntensity = damp(materials.tip.emissiveIntensity, locked ? 3.2 : 0.4, 6, dt);
    materials.needleNorth.emissiveIntensity = damp(materials.needleNorth.emissiveIntensity, locked ? 0.55 : 0, 6, dt);
  });

  return (
    <group position={[0, SCENE.logPoseHeight, 0]} scale={SCENE.logPoseScale}>
      <Float speed={1.3} rotationIntensity={0.1} floatIntensity={0.6} floatingRange={[-0.1, 0.1]}>
        <group ref={housing}>
          {/* ---- Stand & yoke (aged brass) ---- */}
          <Inked geometry={geometry.yoke} material={materials.brassAged} rotation={[0, 0, Math.PI]} />
          {[-1, 1].map((side) => (
            <Inked
              key={side}
              geometry={geometry.stud}
              material={materials.brassAged}
              position={[side * YOKE_RADIUS, 0, 0]}
              scale={0.105}
            />
          ))}
          <Inked geometry={geometry.collar} material={materials.brassAged} position={[0, -1.48, 0]} />
          <Inked geometry={geometry.stud} material={materials.brass} position={[0, -1.62, 0]} scale={0.15} />
          <Inked geometry={geometry.stem} material={materials.brassAged} position={[0, -1.87, 0]} />
          <Inked geometry={geometry.footTop} material={materials.brass} position={[0, -2.08, 0]} />
          <Inked geometry={geometry.footMid} material={materials.brassAged} position={[0, -2.2, 0]} />
          <Inked geometry={geometry.footBase} material={materials.brass} position={[0, -2.29, 0]} />

          {/* ---- Outer gimbal ring ---- */}
          <group ref={outerGimbal}>
            <Inked geometry={geometry.outerRing} material={materials.brass} />
            {[-1, 1].map((side) => (
              <Inked
                key={side}
                geometry={geometry.pin}
                material={materials.iron}
                position={[side * (OUTER_RADIUS + YOKE_RADIUS) * 0.5, 0, 0]}
                rotation={[0, 0, HALF_PI]}
                scale={[0.035, YOKE_RADIUS - OUTER_RADIUS, 0.035]}
              />
            ))}

            {/* ---- Inner gimbal ring ---- */}
            <group ref={innerGimbal}>
              <Inked geometry={geometry.innerRing} material={materials.brassPolished} />
              {[-1, 1].map((side) => (
                <Inked
                  key={side}
                  geometry={geometry.pin}
                  material={materials.iron}
                  position={[0, side * (INNER_RADIUS + OUTER_RADIUS) * 0.5, 0]}
                  scale={[0.03, OUTER_RADIUS - INNER_RADIUS, 0.03]}
                />
              ))}
            </group>
          </group>

          {/* ---- Globe: bezel, needle and glass. Stays level while the gimbals swing. ---- */}
          <group>
            <Inked geometry={geometry.bezel} material={materials.brassPolished} rotation={[HALF_PI, 0, 0]} thickness={0.0024} />
            <Inked geometry={geometry.cap} material={materials.brass} position={[0, GLOBE_RADIUS, 0]} />
            <Inked geometry={geometry.cap} material={materials.brass} position={[0, -GLOBE_RADIUS, 0]} rotation={[Math.PI, 0, 0]} />
            {/* Cardinal studs on the bezel */}
            {[0, 1, 2, 3].map((quarter) => (
              <Inked
                key={quarter}
                geometry={geometry.stud}
                material={materials.brass}
                position={[
                  Math.sin(quarter * HALF_PI) * (GLOBE_RADIUS + 0.03),
                  0,
                  Math.cos(quarter * HALF_PI) * (GLOBE_RADIUS + 0.03),
                ]}
                scale={0.06}
                thickness={0.0022}
              />
            ))}

            {/* Pivot pin rising from the lower cap */}
            <Inked
              geometry={geometry.pin}
              material={materials.iron}
              position={[0, -GLOBE_RADIUS * 0.5, 0]}
              scale={[0.018, GLOBE_RADIUS, 0.018]}
              thickness={0.002}
            />

            {/* Needle: yaw (target bearing) → pitch (sky islands) → tremor */}
            <group ref={needleYaw}>
              <group ref={needlePitch}>
                <group ref={needleTremor}>
                  <Inked geometry={geometry.needleNorth} material={materials.needleNorth} thickness={0.0022} />
                  <Inked geometry={geometry.needleSouth} material={materials.needleSouth} thickness={0.0022} />
                  <Inked geometry={geometry.stud} material={materials.brassPolished} scale={0.075} thickness={0.0022} />
                  <mesh geometry={geometry.stud} material={materials.tip} position={[0, 0, 0.6]} scale={0.045} />
                </group>
              </group>
            </group>

            {/* Glass dome: crown-glass IOR, low roughness and only a whisper of
                distortion so the needle inside stays crisp. */}
            <mesh geometry={geometry.globe}>
              <MeshTransmissionMaterial
                resolution={1024}
                samples={4}
                transmission={0.95}
                roughness={0.02}
                thickness={0.12}
                ior={1.52}
                chromaticAberration={0.03}
                anisotropicBlur={0}
                distortion={0}
                temporalDistortion={0}
                color="#eefcff"
                attenuationColor="#bfeeff"
                attenuationDistance={3}
              />
            </mesh>
            {/* Rim glow + inked silhouette. The dome gets no inverted hull: the
                transmission pass would refract it into dark bands across the glass. */}
            <mesh geometry={geometry.rimShell} material={materials.rim} />
          </group>
        </group>
      </Float>

      {/* Stray magnetism */}
      <Sparkles count={36} scale={[4.4, 4.2, 4.4]} size={2.6} speed={0.35} opacity={0.75} color="#ffe2a0" />
    </group>
  );
}
