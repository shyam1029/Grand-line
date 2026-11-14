/**
 * The Grand Line sea: one large grid driven by a custom Gerstner-wave shader
 * (src/shaders/toonWater.*), wrapped with drei's `shaderMaterial` so uniforms
 * are plain props / properties.
 */
import { useEffect, useMemo, useRef } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import vertexShader from '../../shaders/toonWater.vert.glsl?raw';
import fragmentShader from '../../shaders/toonWater.frag.glsl?raw';
import { getIslandMeta } from './islandBlueprints.js';
import { MAX_DELTA, SCENE } from './sceneConfig.js';
import { input } from '../../lib/input.js';

const { damp } = THREE.MathUtils;

/** Must match MAX_ISLANDS in toonWater.frag.glsl. */
const MAX_ISLANDS = 8;
const OCEAN_SIZE = 260;
const OCEAN_SEGMENTS = 256;
const noRaycast = () => null;

const ToonWaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uPointer: new THREE.Vector2(0, 0),
    uPointerStrength: 0,
    uAbyssalDeep: new THREE.Color('#0b2e73'),
    uOpenSea: new THREE.Color('#1668c9'),
    uTurquoiseShallow: new THREE.Color('#37d3cb'),
    uFoamColor: new THREE.Color('#ffffff'),
    uFogColor: new THREE.Color(SCENE.horizonColor),
    uFogNear: SCENE.fogNear,
    uFogFar: SCENE.fogFar,
    uLightDirection: new THREE.Vector3(...SCENE.sunPosition).normalize(),
    uIslands: Array.from({ length: MAX_ISLANDS }, () => new THREE.Vector3()),
  },
  vertexShader,
  fragmentShader,
);

extend({ ToonWaterMaterial });

export function OceanSurface({ islands }) {
  const material = useRef();

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEGMENTS, OCEAN_SEGMENTS);
    plane.rotateX(-Math.PI / 2); // lie flat: the shader treats position.xz as world XZ
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Shoreline discs for the foam rings: (x, z, radius) per island.
  const shorelines = useMemo(
    () =>
      Array.from({ length: MAX_ISLANDS }, (_, i) => {
        const island = islands[i];
        if (!island) return new THREE.Vector3(0, 0, 0);
        const { x, z } = island.coordinates;
        return new THREE.Vector3(x, z, getIslandMeta(island.slug).shoreRadius);
      }),
    [islands],
  );

  const scratch = useMemo(
    () => ({ raycaster: new THREE.Raycaster(), ndc: new THREE.Vector2(), hit: new THREE.Vector2() }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    const uniforms = material.current.uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;

    // Project the pointer onto the sea plane (y = 0) and let the ripple centre chase it.
    const { raycaster, ndc, hit } = scratch;
    raycaster.setFromCamera(ndc.set(input.x, input.y), state.camera);
    const { origin, direction } = raycaster.ray;
    if (direction.y < -0.01) {
      const t = -origin.y / direction.y;
      hit.set(origin.x + direction.x * t, origin.z + direction.z * t);
      const pointer = uniforms.uPointer.value;
      pointer.x = damp(pointer.x, hit.x, 6, dt);
      pointer.y = damp(pointer.y, hit.y, 6, dt);
    }

    // Ripples swell while the pointer is moving and settle when it rests.
    const moving = performance.now() - input.lastMove < 500;
    uniforms.uPointerStrength.value = damp(uniforms.uPointerStrength.value, moving ? 1 : 0.25, 2.5, dt);
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} raycast={noRaycast}>
      <toonWaterMaterial ref={material} uIslands={shorelines} />
    </mesh>
  );
}
