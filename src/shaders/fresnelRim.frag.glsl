// Fresnel rim for the Log Pose glass dome — fragment stage.
//
// Two jobs in one pass, written as premultiplied colour (blend: One,
// OneMinusSrcAlpha):
//   glow  additive, stepped into two cel bands toward grazing angles
//   ink   an opaque line right at the silhouette, standing in for the
//         inverted-hull outline that solid meshes use

uniform vec3 uColor;
uniform float uStrength;
uniform float uPower;

varying vec3 vViewNormal;
varying vec3 vViewDirection;

void main() {
  float facing = clamp(dot(normalize(vViewNormal), normalize(vViewDirection)), 0.0, 1.0);
  float fresnel = pow(1.0 - facing, uPower);

  float soft = smoothstep(0.18, 0.9, fresnel) * 0.45;
  float band = smoothstep(0.5, 0.54, fresnel) * 0.55;
  vec3 glow = uColor * (soft + band) * uStrength;

  // Anti-aliased ink edge over the last few percent of the radius.
  float edge = fwidth(facing) * 1.5;
  float ink = 1.0 - smoothstep(0.2 - edge, 0.2 + edge, facing);

  gl_FragColor = vec4(glow * (1.0 - ink), ink);

  #include <colorspace_fragment>
}
