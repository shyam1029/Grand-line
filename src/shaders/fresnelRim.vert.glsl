// Fresnel rim glow for the Log Pose glass dome — vertex stage.

varying vec3 vViewNormal;
varying vec3 vViewDirection;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewNormal = normalize(normalMatrix * normal);
  vViewDirection = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
