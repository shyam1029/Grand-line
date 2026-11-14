// Inverted-hull manga outline — fragment stage.
// Flat, unlit ink. Scene fog is still applied so distant outlines sink into
// the horizon haze instead of popping out as hard black wire.

uniform vec3 uOutlineColor;

#include <common>
#include <fog_pars_fragment>

void main() {
  gl_FragColor = vec4(uOutlineColor, 1.0);

  #include <colorspace_fragment>
  #include <fog_fragment>
}
