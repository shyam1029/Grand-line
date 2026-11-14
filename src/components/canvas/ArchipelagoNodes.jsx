/**
 * The archipelago: one floating island beacon per arc in the content
 * collection, positioned from its `coordinates` frontmatter.
 *
 * Pointer events are handled declaratively by R3F on an invisible hit volume
 * per island. They only write to Nano Stores — the Log Pose needle, the
 * camera rig and the HTML HUD each react on their own.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { navigate } from 'astro:transitions/client';
import * as THREE from 'three';
import { Inked, createToonMaterial, outlineMaterial, toonMaterial, vertexToonMaterial } from './ToonMaterials.jsx';
import { buildIsland, disposeIslandPrimitives } from './islandBlueprints.js';
import { MAX_DELTA } from './sceneConfig.js';
import { $activeTarget, $hoveredIsland, $selectedIsland, arcPath, hoverIsland, selectIsland } from '../../stores/navigationStore.js';

const { damp } = THREE.MathUtils;
const noRaycast = () => null;
const LABEL_STYLE = { pointerEvents: 'none', userSelect: 'none' };

/** Geometry shared by every island's beacon and bubbles. */
function useSharedGeometry() {
  const shared = useMemo(
    () => ({
      beacon: new THREE.OctahedronGeometry(0.3, 0),
      halo: new THREE.TorusGeometry(0.52, 0.035, 6, 32),
      bubble: new THREE.SphereGeometry(1, 16, 12),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(shared).forEach((geometry) => geometry.dispose());
      disposeIslandPrimitives();
    },
    [shared],
  );
  return shared;
}

/** Resin bubbles drifting up through the mangroves (Sabaody). */
function ResinBubbles({ geometry, count = 7, height = 5.2 }) {
  const refs = useRef([]);
  // Opaque cel bubbles: a translucent fill would show the ink hull through itself.
  const material = toonMaterial('#e6fbff');
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + i * 0.7,
        radius: 0.7 + ((i * 37) % 10) * 0.14,
        speed: 0.32 + ((i * 53) % 10) * 0.03,
        offset: (i * 0.618) % 1,
        size: 0.16 + ((i * 29) % 10) * 0.022,
      })),
    [count],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const bubble = refs.current[i];
      if (!bubble) return;
      const rise = (time * seed.speed * 0.2 + seed.offset) % 1;
      const sway = seed.angle + Math.sin(time * 0.6 + i) * 0.35;
      bubble.position.set(Math.sin(sway) * seed.radius, 0.4 + rise * height, Math.cos(sway) * seed.radius);
      // Swell out of the roots, pop near the canopy.
      bubble.scale.setScalar(seed.size * Math.min(1, rise * 6) * (rise > 0.94 ? (1 - rise) / 0.06 : 1));
    });
  });

  return seeds.map((_, i) => (
    <mesh key={i} ref={(node) => (refs.current[i] = node)} geometry={geometry} material={material} raycast={noRaycast}>
      <mesh geometry={geometry} material={outlineMaterial(0.0018)} raycast={noRaycast} />
    </mesh>
  ));
}

function IslandNode({ island, index, shared, portal }) {
  const { slug, title, arcOrder, coordinates } = island;
  const group = useRef();
  const beacon = useRef();
  const halo = useRef();
  const label = useRef();
  const highlight = useRef(0);
  const wasActive = useRef(false);

  const { geometry, meta } = useMemo(() => buildIsland(slug, coordinates.y), [slug, coordinates.y]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Per-island instance: emissive intensity is animated on hover.
  const beaconMaterial = useMemo(
    () => createToonMaterial({ color: '#f6c945', emissive: '#ffb030', emissiveIntensity: 0.5, flatShading: true }),
    [],
  );
  useEffect(() => () => beaconMaterial.dispose(), [beaconMaterial]);

  const [hitRadius, hitHeight, hitCentre] = meta.hit;
  const phase = index * 1.7;

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    const time = state.clock.elapsedTime;
    const active = $activeTarget.get() === slug;

    highlight.current = damp(highlight.current, active ? 1 : 0, 6, dt);
    const h = highlight.current;

    // Gentle bob on the swell, and a small swell of its own when targeted.
    group.current.position.y = coordinates.y + Math.sin(time * 0.8 + phase) * 0.07;
    group.current.scale.setScalar(1 + h * 0.07);

    beacon.current.rotation.y += dt * (0.9 + h * 3.2);
    beacon.current.position.y = meta.beaconHeight + Math.sin(time * 1.6 + phase) * 0.12 + h * 0.2;
    beacon.current.scale.setScalar(1 + h * 0.45);
    beaconMaterial.emissiveIntensity = 0.5 + h * 2.6;

    halo.current.position.y = beacon.current.position.y;
    halo.current.rotation.z = time * 0.7 + phase;
    halo.current.scale.setScalar(0.85 + h * 0.75 + Math.sin(time * 2.4 + phase) * 0.05);

    // Flip the label's data attribute only when the state actually changes.
    if (active !== wasActive.current && label.current) {
      label.current.dataset.active = String(active);
      wasActive.current = active;
    }
  });

  const handleOver = (event) => {
    event.stopPropagation();
    hoverIsland(slug);
    document.body.style.cursor = 'pointer';
  };

  const handleOut = () => {
    if ($hoveredIsland.get() === slug) hoverIsland(null);
    document.body.style.cursor = '';
  };

  const handleClick = (event) => {
    event.stopPropagation();
    // A drag that happens to end on an island is an orbit, not a selection.
    if (event.delta > 6) return;
    document.body.style.cursor = '';
    if ($selectedIsland.get() === slug) return;
    // Update the store first so the needle and camera react this frame,
    // then let Astro swap the page content in with a view transition.
    selectIsland(slug);
    navigate(arcPath(slug));
  };

  return (
    <group ref={group} position={[coordinates.x, coordinates.y, coordinates.z]}>
      <Inked geometry={geometry} material={vertexToonMaterial()} thickness={0.0034} raycast={noRaycast} />

      {meta.bubbles && <ResinBubbles geometry={shared.bubble} />}

      {/* Floating beacon */}
      <Inked ref={beacon} geometry={shared.beacon} material={beaconMaterial} thickness={0.0028} raycast={noRaycast} />
      <mesh ref={halo} geometry={shared.halo} material={toonMaterial('#fff1c2')} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast} />

      <Html portal={portal} position={[0, meta.beaconHeight + 0.95, 0]} center zIndexRange={[5, 0]} style={LABEL_STYLE}>
        <div ref={label} className="island-label" data-active="false">
          <span className="opacity-60">{String(arcOrder).padStart(2, '0')}</span> {title}
        </div>
      </Html>

      {/* Invisible, generous pointer target */}
      <mesh
        visible={false}
        position={[0, hitCentre, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <cylinderGeometry args={[hitRadius, hitRadius, hitHeight, 10]} />
      </mesh>
    </group>
  );
}

export function ArchipelagoNodes({ islands }) {
  const shared = useSharedGeometry();
  // A stable portal target: without it drei's <Html> re-creates its React root
  // as soon as R3F connects its event layer, one frame after mount.
  const container = useThree((state) => state.gl.domElement.parentNode);
  const portal = useMemo(() => ({ current: container }), [container]);
  return islands.map((island, index) => (
    <IslandNode key={island.slug} island={island} index={index} shared={shared} portal={portal} />
  ));
}
