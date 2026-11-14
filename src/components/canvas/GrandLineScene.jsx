/**
 * Scene graph shell: lighting, atmosphere and (from stage 2 onward) the
 * Log Pose, archipelago, ocean and post-processing.
 */
import { SCENE } from './sceneConfig.js';

export function GrandLineScene({ islands }) {
  return (
    <>
      <color attach="background" args={[SCENE.horizonColor]} />
      <fog attach="fog" args={[SCENE.horizonColor, SCENE.fogNear, SCENE.fogFar]} />

      <ambientLight intensity={SCENE.ambientIntensity} color="#fff5e0" />
      <hemisphereLight args={['#bfe6ff', '#2a6f9c', SCENE.hemisphereIntensity]} />
      <directionalLight position={SCENE.sunPosition} intensity={SCENE.sunIntensity} color="#ffffff" />
    </>
  );
}
