// Sky dome — fragment stage.
// A banded anime sky: pale haze on the horizon (matching the scene fog so the
// sea dissolves into it), saturated blue overhead, and a hard-edged sun disc
// with a stepped halo.

uniform vec3 uHorizon;
uniform vec3 uMid;
uniform vec3 uZenith;
uniform vec3 uSunDirection;

varying vec3 vDirection;

void main() {
  vec3 direction = normalize(vDirection);
  float elevation = clamp(direction.y, 0.0, 1.0);

  vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.2, elevation));
  color = mix(color, uZenith, smoothstep(0.16, 0.7, elevation));

  // One soft cel step low in the sky, like a painted background plate.
  color = mix(color, uHorizon, (1.0 - smoothstep(0.045, 0.055, elevation)) * 0.35);

  float sun = dot(direction, normalize(uSunDirection));
  color += vec3(1.0, 0.92, 0.7) * smoothstep(0.985, 0.9855, sun) * 0.12;
  color += vec3(1.0, 0.95, 0.8) * smoothstep(0.993, 0.9935, sun) * 0.18;
  color = mix(color, vec3(1.6, 1.5, 1.2), smoothstep(0.9972, 0.9976, sun));

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
