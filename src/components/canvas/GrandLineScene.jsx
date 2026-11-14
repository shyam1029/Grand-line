/**
 * Scene graph shell: lighting, atmosphere, the Log Pose, the archipelago and
 * the camera rig. Also owns scene-wide side effects (input listeners and
 * disposal of the shared material kit).
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ArchipelagoNodes } from './ArchipelagoNodes.jsx';
import { CameraRig } from './CameraRig.jsx';
import { LogPoseModel } from './LogPoseModel.jsx';
import { disposeToonKit } from './ToonMaterials.jsx';
import { SCENE } from './sceneConfig.js';
import { attachInput } from '../../lib/input.js';

export function GrandLineScene({ islands }) {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => attachInput(canvas), [canvas]);
  useEffect(() => disposeToonKit, []);

  return (
    <>
      <color attach="background" args={[SCENE.horizonColor]} />
      <fog attach="fog" args={[SCENE.horizonColor, SCENE.fogNear, SCENE.fogFar]} />

      <ambientLight intensity={SCENE.ambientIntensity} color="#fff5e0" />
      <hemisphereLight args={['#bfe6ff', '#2a6f9c', SCENE.hemisphereIntensity]} />
      <directionalLight position={SCENE.sunPosition} intensity={SCENE.sunIntensity} color="#ffffff" />

      <CameraRig islands={islands} />
      <LogPoseModel islands={islands} />
      <ArchipelagoNodes islands={islands} />
    </>
  );
}
