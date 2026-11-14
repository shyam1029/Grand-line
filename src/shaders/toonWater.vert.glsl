// Grand Line ocean — vertex stage.
//
// Four directional Gerstner waves displace a flat grid (horizontally as well
// as vertically, which is what gives crests their pinch), with an analytic
// normal accumulated from each wave's partial derivatives. A damped ring
// ripple radiates from wherever the pointer meets the sea.

uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerStrength;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vWaveHeight;
varying float vRipple;

struct Wave {
  vec2 direction;
  float amplitude;
  float frequency;
  float speed;
  float steepness;
};

vec3 gerstnerWave(Wave wave, vec3 point, inout vec3 tangent, inout vec3 binormal) {
  float theta = dot(wave.direction, point.xz) * wave.frequency + uTime * wave.speed;
  float c = cos(theta);
  float s = sin(theta);

  float wa = wave.frequency * wave.amplitude;
  float qwa = wave.steepness * wa;
  vec2 d = wave.direction;

  tangent += vec3(-d.x * d.x * qwa * s, d.x * wa * c, -d.x * d.y * qwa * s);
  binormal += vec3(-d.x * d.y * qwa * s, d.y * wa * c, -d.y * d.y * qwa * s);

  float horizontal = wave.steepness * wave.amplitude * c;
  return vec3(d.x * horizontal, wave.amplitude * s, d.y * horizontal);
}

void main() {
  // The plane geometry is pre-rotated into XZ, so `position` is already world-aligned.
  vec3 gridPoint = position;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 displaced = gridPoint;

  Wave swell = Wave(normalize(vec2(1.0, 0.5)), 0.17, 0.4, 1.1, 0.55);
  Wave crossSwell = Wave(normalize(vec2(-0.4, 0.8)), 0.1, 0.8, 1.6, 0.5);
  Wave chop = Wave(normalize(vec2(0.2, -1.0)), 0.05, 1.5, 2.3, 0.4);
  Wave ripple = Wave(normalize(vec2(-0.8, -0.3)), 0.03, 2.0, 2.9, 0.3);

  displaced += gerstnerWave(swell, gridPoint, tangent, binormal);
  displaced += gerstnerWave(crossSwell, gridPoint, tangent, binormal);
  displaced += gerstnerWave(chop, gridPoint, tangent, binormal);
  displaced += gerstnerWave(ripple, gridPoint, tangent, binormal);

  // Pointer proximity ripple: outward-travelling rings that die off with distance.
  float pointerDistance = distance(gridPoint.xz, uPointer);
  float ring = sin(pointerDistance * 3.2 - uTime * 5.0) * exp(-pointerDistance * 0.42);
  vRipple = ring * uPointerStrength;

  vWaveHeight = displaced.y;
  displaced.y += vRipple * 0.13;
  vNormal = normalize(cross(binormal, tangent));

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
