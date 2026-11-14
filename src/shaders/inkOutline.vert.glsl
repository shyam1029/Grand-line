// Inverted-hull manga outline — vertex stage.
//
// The mesh is drawn a second time with back faces only, pushed out along its
// normals. Thickness is multiplied by view distance so the inked line keeps a
// roughly constant width on screen instead of vanishing on far islands.

uniform float uThickness;

#include <common>
#include <fog_pars_vertex>

void main() {
  vec3 objectNormal = normal;
  vec4 localPosition = vec4(position, 1.0);

  #ifdef USE_INSTANCING
    localPosition = instanceMatrix * localPosition;
    objectNormal = mat3(instanceMatrix) * objectNormal;
  #endif

  vec4 mvPosition = modelViewMatrix * localPosition;
  vec3 viewNormal = normalize(normalMatrix * objectNormal);

  // Clamp so nearby geometry never gets a hairline and the horizon never gets a slab.
  float viewDistance = clamp(-mvPosition.z, 1.5, 70.0);
  mvPosition.xyz += viewNormal * uThickness * viewDistance;

  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
