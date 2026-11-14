/**
 * Ambient set dressing, batched with drei <Instances>:
 *   - cumulus clouds ringing the horizon
 *   - sea rocks scattered between the islands
 *   - brass markers tracing the Log route from island to island
 *
 * Each prop type is two draw calls (cel fill + ink hull) regardless of how
 * many copies there are. Layouts come from a seeded PRNG, so the scene is
 * identical on every visit and across navigations.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { outlineMaterial, smoothGeometry, toonMaterial, createToonMaterial } from './ToonMaterials.jsx';
import { getIslandMeta } from './islandBlueprints.js';
import { MAX_DELTA } from './sceneConfig.js';

const noRaycast = () => null;

/** Small deterministic PRNG (mulberry32). */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A batch of instances drawn twice: toon fill, then inverted-hull ink. */
function InkedInstances({ geometry, material, items, thickness = 0.003 }) {
  const instances = items.map((item, i) => (
    <Instance key={i} position={item.position} scale={item.scale} rotation={item.rotation} />
  ));
  // Static layouts: write the instance matrices once instead of every frame.
  const common = { limit: items.length, frames: 1, frustumCulled: false, raycast: noRaycast, geometry };
  return (
    <>
      <Instances {...common} material={material}>
        {instances}
      </Instances>
      <Instances {...common} material={outlineMaterial(thickness)}>
        {instances}
      </Instances>
    </>
  );
}

function layoutClouds(random) {
  const puffs = [];
  const clusters = 24;
  for (let c = 0; c < clusters; c += 1) {
    const angle = (c / clusters) * Math.PI * 2 + random() * 0.2;
    const radius = 62 + random() * 34;
    // Sit the banks low so they pile up on the horizon behind the islands.
    const centre = [Math.sin(angle) * radius, 3 + random() * 9, Math.cos(angle) * radius];
    const size = 3 + random() * 3.6;
    const count = 3 + Math.floor(random() * 3);
    for (let p = 0; p < count; p += 1) {
      const spread = (p - (count - 1) / 2) * size * 0.85;
      const lift = p % 2 ? size * 0.3 : 0;
      puffs.push({
        // Spread each cluster tangentially so it reads as a bank, not a blob.
        position: [
          centre[0] + Math.cos(angle) * spread,
          centre[1] + lift + random() * 0.6,
          centre[2] - Math.sin(angle) * spread,
        ],
        scale: [size * (0.8 + random() * 0.5), size * (0.5 + random() * 0.25), size * (0.75 + random() * 0.4)],
        rotation: [0, random() * Math.PI, 0],
      });
    }
  }
  return puffs;
}

function layoutRocks(random, islands) {
  const rocks = [];
  let attempts = 0;
  while (rocks.length < 30 && attempts < 400) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = 15 + random() * 30;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const blocked = islands.some(
      ({ slug, coordinates }) => Math.hypot(coordinates.x - x, coordinates.z - z) < getIslandMeta(slug).shoreRadius + 2.2,
    );
    if (blocked) continue;
    const size = 0.28 + random() * 0.6;
    rocks.push({
      position: [x, size * 0.1, z],
      scale: [size * (0.8 + random() * 0.6), size * (0.7 + random() * 0.9), size * (0.8 + random() * 0.6)],
      rotation: [random() * 0.5, random() * Math.PI, random() * 0.5],
    });
  }
  return rocks;
}

/** Evenly spaced markers along a smooth curve through the islands in arc order. */
function layoutRoute(islands) {
  if (islands.length < 2) return [];
  const ordered = [...islands].sort((a, b) => a.arcOrder - b.arcOrder);
  const curve = new THREE.CatmullRomCurve3(
    ordered.map(({ coordinates }) => new THREE.Vector3(coordinates.x, 0.75, coordinates.z)),
    false,
    'centripetal',
  );
  return curve
    .getSpacedPoints(Math.round(curve.getLength() / 1.15))
    .filter((point) =>
      ordered.every(
        ({ slug, coordinates }) =>
          Math.hypot(coordinates.x - point.x, coordinates.z - point.z) > getIslandMeta(slug).shoreRadius + 0.7,
      ),
    )
    .map((point) => ({ position: point.toArray(), scale: [0.13, 0.2, 0.13], rotation: [0, 0, 0] }));
}

export function AmbientProps({ islands }) {
  const cloudBank = useRef();

  const geometry = useMemo(
    () => ({
      cloud: new THREE.IcosahedronGeometry(1, 2),
      rock: smoothGeometry(new THREE.IcosahedronGeometry(1, 0)),
      marker: smoothGeometry(new THREE.OctahedronGeometry(1, 0)),
    }),
    [],
  );
  const routeMaterial = useMemo(
    () => createToonMaterial({ color: '#f6c945', emissive: '#ffb030', emissiveIntensity: 0.9, flatShading: true }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      routeMaterial.dispose();
    },
    [geometry, routeMaterial],
  );

  const clouds = useMemo(() => layoutClouds(seededRandom(1997)), []);
  const rocks = useMemo(() => layoutRocks(seededRandom(722), islands), [islands]);
  const route = useMemo(() => layoutRoute(islands), [islands]);

  // The whole cloud bank drifts as one group: a single matrix update per frame.
  useFrame((_, delta) => {
    cloudBank.current.rotation.y += Math.min(delta, MAX_DELTA) * 0.004;
  });

  return (
    <>
      <group ref={cloudBank}>
        <InkedInstances geometry={geometry.cloud} material={toonMaterial('#ffffff')} items={clouds} thickness={0.0022} />
      </group>
      <InkedInstances
        geometry={geometry.rock}
        material={toonMaterial('#7c8794', { flatShading: true })}
        items={rocks}
        thickness={0.003}
      />
      {route.length > 0 && (
        <Instances limit={route.length} frames={1} frustumCulled={false} raycast={noRaycast} geometry={geometry.marker} material={routeMaterial}>
          {route.map((item, i) => (
            <Instance key={i} position={item.position} scale={item.scale} />
          ))}
        </Instances>
      )}
    </>
  );
}
