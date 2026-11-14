/**
 * Painted sky: an inverted sphere with a banded gradient shader, plus a small
 * procedural environment map so the Log Pose's glass dome has something to
 * reflect (generated locally — no HDR download).
 */
import { useEffect, useMemo } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import vertexShader from '../../shaders/sky.vert.glsl?raw';
import fragmentShader from '../../shaders/sky.frag.glsl?raw';
import { SCENE } from './sceneConfig.js';

const noRaycast = () => null;

export function SkyDome() {
  const geometry = useMemo(() => new THREE.SphereGeometry(320, 32, 16), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'SkyDome',
        vertexShader,
        fragmentShader,
        uniforms: {
          uHorizon: { value: new THREE.Color(SCENE.horizonColor) },
          uMid: { value: new THREE.Color('#6ec1f7') },
          uZenith: { value: new THREE.Color('#1f73de') },
          uSunDirection: { value: new THREE.Vector3(...SCENE.sunPosition).normalize() },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <>
      <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} raycast={noRaycast} />

      {/* Rendered once into a tiny cube map. */}
      <Environment resolution={64} frames={1}>
        <color attach="background" args={['#7cc4f5']} />
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[6, 10, 5]} scale={[10, 10, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#cfefff" position={[-8, 3, -6]} scale={[14, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#2a8fd6" position={[0, -8, 0]} scale={[20, 20, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}
