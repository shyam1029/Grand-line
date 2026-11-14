// Grand Line ocean — fragment stage.
//
// Everything is quantised: depth tone, lighting and foam are all stepped so
// the sea reads as painted cels rather than a physically shaded surface.
//   1. tone      abyssal blue -> open sea -> turquoise shallows, in 4 bands
//   2. light     two hard steps from the analytic Gerstner normal
//   3. cel foam  drifting Voronoi cell edges (hand-drawn wave lines)
//   4. crests    white caps where the wave height passes a noisy threshold
//   5. shore     a solid foam lip plus expanding rings around every island
//   6. ripples   rings radiating from the pointer

#define MAX_ISLANDS 8

uniform float uTime;
uniform vec3 uAbyssalDeep;
uniform vec3 uOpenSea;
uniform vec3 uTurquoiseShallow;
uniform vec3 uFoamColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uLightDirection;
// xy = island position on the XZ plane, z = shoreline radius (0 = unused slot)
uniform vec3 uIslands[MAX_ISLANDS];

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vWaveHeight;
varying float vRipple;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n + 17.13));
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// Distance to the nearest Voronoi cell border (F2 - F1), with drifting sites.
float cellEdge(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbour = vec2(float(x), float(y));
      vec2 site = 0.5 + 0.5 * sin(uTime * 0.6 + 6.2831 * hash22(cell + neighbour));
      float d = length(neighbour + site - local);
      if (d < nearest) {
        second = nearest;
        nearest = d;
      } else if (d < second) {
        second = d;
      }
    }
  }
  return second - nearest;
}

// Stair-step a 0..1 value, anti-aliasing each riser with screen-space derivatives.
float quantize(float value, float steps) {
  float scaled = value * steps;
  float width = fwidth(scaled) * 0.75 + 1e-4;
  return (floor(scaled) + smoothstep(0.5 - width, 0.5 + width, fract(scaled))) / steps;
}

void main() {
  vec2 xz = vWorldPosition.xz;
  float viewDistance = distance(vWorldPosition, cameraPosition);

  // ---- distance to the nearest shoreline ----
  float shore = 1000.0;
  for (int i = 0; i < MAX_ISLANDS; i++) {
    float radius = uIslands[i].z;
    if (radius > 0.0) shore = min(shore, distance(xz, uIslands[i].xy) - radius);
  }
  float wobble = valueNoise(xz * 0.9 + uTime * 0.15) - 0.5;

  // ---- 1. banded depth tone ----
  float shallows = 1.0 - smoothstep(0.0, 6.5, shore + wobble * 1.2);
  float lagoon = 1.0 - smoothstep(3.0, 13.0, length(xz)); // under the Log Pose
  float height = clamp(vWaveHeight / 0.7 + 0.5, 0.0, 1.0);
  float drift = (valueNoise(xz * 0.12 + vec2(uTime * 0.02, 0.0)) - 0.5) * 0.22;
  float tone = height * 0.42 + max(shallows, lagoon * 0.6) * 0.62 + drift;
  float band = quantize(clamp(tone, 0.0, 1.0), 4.0);

  vec3 color = mix(uAbyssalDeep, uOpenSea, smoothstep(0.0, 0.5, band));
  color = mix(color, uTurquoiseShallow, smoothstep(0.45, 1.0, band));

  // ---- 2. cel lighting ----
  float NdotL = max(dot(normalize(vNormal), normalize(uLightDirection)), 0.0);
  float light = smoothstep(0.8, 0.815, NdotL) * 0.5 + smoothstep(0.9, 0.915, NdotL) * 0.5;
  color *= 0.82 + light * 0.3;

  // ---- 3. drifting cel foam lines ----
  float nearFade = 1.0 - smoothstep(45.0, 85.0, viewDistance); // avoid moiré at the horizon
  float cells = cellEdge(xz * 0.8 + vec2(uTime * 0.05, uTime * 0.03));
  float patches = smoothstep(0.5, 0.78, valueNoise(xz * 0.16 - uTime * 0.03));
  float lines = (1.0 - smoothstep(0.02, 0.04, cells)) * (0.06 + 0.94 * max(patches, shallows * 0.8));
  color = mix(color, uFoamColor, lines * 0.4 * nearFade);

  // ---- 4. wave-crest foam ----
  float crestNoise = (valueNoise(xz * 1.6 + uTime * 0.25) - 0.5) * 0.1;
  float crest = smoothstep(0.235, 0.265, vWaveHeight + crestNoise);
  color = mix(color, uFoamColor, crest);

  // ---- 5. shoreline foam ----
  float edge = shore + wobble * 0.35;
  float lip = 1.0 - smoothstep(0.22, 0.3, edge);
  float ringPhase = fract(edge * 0.45 - uTime * 0.22);
  float rings = smoothstep(0.82, 0.86, ringPhase) * (1.0 - smoothstep(0.9, 3.2, edge)) * step(0.0, edge);
  color = mix(color, uFoamColor, max(lip, rings * 0.9));

  // ---- 6. pointer ripples ----
  color = mix(color, uFoamColor, smoothstep(0.045, 0.06, vRipple) * 0.7);

  // Sun glints: sparse hard sparkles on lit facets (they feed the Bloom pass).
  vec2 glintCell = xz * 7.0;
  float glintShape = 1.0 - smoothstep(0.18, 0.3, length(fract(glintCell) - 0.5));
  float glint = step(0.994, hash21(floor(glintCell) + floor(uTime * 2.5))) * glintShape;
  color += glint * light * nearFade * 0.9;

  // ---- horizon haze ----
  color = mix(color, uFogColor, smoothstep(uFogNear, uFogFar, viewDistance));

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
