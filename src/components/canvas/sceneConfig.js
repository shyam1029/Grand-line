/**
 * Shared scene constants: one place for the numbers that several components
 * (lights, sky, ocean, camera rig, Log Pose) must agree on.
 */
export const SCENE = {
  /** Fog / horizon haze colour. The sky dome and ocean both fade into it. */
  horizonColor: '#cfefff',
  fogNear: 34,
  fogFar: 118,

  /** Key light. The ocean and sky shaders use the same direction. */
  sunPosition: [9, 16, 7],
  sunIntensity: 2.6,
  ambientIntensity: 1.15,
  hemisphereIntensity: 0.9,

  /** World-space centre of the Log Pose globe (it hovers above the sea). */
  logPoseHeight: 3,

  /** Manga ink colour used by every outline. */
  inkColor: '#050505',
};

/** Frame delta clamp: a background tab must not turn into a physics explosion. */
export const MAX_DELTA = 0.05;
