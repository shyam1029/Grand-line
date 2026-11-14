/**
 * Image-space finishing pass.
 *
 * The manga ink lines themselves are geometric (inverted hulls — see
 * ToonMaterials.jsx), which keeps them crisp at any resolution. This pass
 * adds the "animation cel under a camera" polish on top:
 *   Bloom        only the hottest pixels: foam glints, beacons, the locked needle tip
 *   Vignette     pulls the eye to the Log Pose and seats the HUD
 *   ToneMapping  Khronos Neutral — compresses highlights without washing out
 *                the saturated flat colours the way filmic curves do
 *
 * The canvas is created with `flat` (no renderer tone mapping), so tone
 * mapping happens exactly once, here, after bloom.
 */
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export function PostProcessingEffects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.92} luminanceSmoothing={0.08} radius={0.7} />
      <Vignette offset={0.3} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
