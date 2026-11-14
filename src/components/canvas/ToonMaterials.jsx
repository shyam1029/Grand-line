/**
 * Anime / manga material kit.
 *
 *  - `getToonGradientMap`  4-tone NearestFilter DataTexture for hard shadow bands
 *  - `toonMaterial`        cached MeshToonMaterial factory
 *  - `brassMaterial`       toon brass with a stepped view-space rim highlight
 *  - `outlineMaterial`     inverted-hull ink outline (custom GLSL)
 *  - `<Inked>`             a mesh plus its ink hull in one element
 *  - `smoothGeometry`      welds vertices so the hull has no cracks at hard edges
 *
 * Everything is cached at module scope: the canvas persists across page
 * navigations, so materials are created once and shared by every mesh.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import outlineVertexShader from '../../shaders/inkOutline.vert.glsl?raw';
import outlineFragmentShader from '../../shaders/inkOutline.frag.glsl?raw';
import { SCENE } from './sceneConfig.js';

/* ------------------------------ gradient ------------------------------ */

let gradientMap = null;

/**
 * Four luminance steps sampled with NearestFilter: light falls off in crisp
 * bands instead of a smooth Lambert ramp. The darkest step is lifted off
 * black so shadows read as coloured cel paint rather than holes.
 */
export function getToonGradientMap() {
  if (gradientMap) return gradientMap;
  const tones = new Uint8Array([72, 128, 196, 255]);
  gradientMap = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

/** Hook form, for components that prefer the spec's naming. */
export const useToonGradientMap = getToonGradientMap;

/* ------------------------------ materials ----------------------------- */

const materialCache = new Map();

function cached(key, create) {
  let material = materialCache.get(key);
  if (!material) {
    material = create();
    materialCache.set(key, material);
  }
  return material;
}

/**
 * Cached cel-shaded material.
 * @param {string} color
 * @param {THREE.MeshToonMaterialParameters} [options]
 */
export function toonMaterial(color, options = {}) {
  const key = `toon:${color}:${JSON.stringify(options)}`;
  return cached(key, () => createToonMaterial({ color, ...options }));
}

/**
 * Uncached constructor, for materials whose uniforms are animated per mesh.
 *
 * `flatShading` is no longer a declared MeshToonMaterial parameter, but the
 * renderer still honours the property (it compiles the shader with
 * FLAT_SHADED and derives face normals from screen-space derivatives), so it
 * is assigned after construction.
 */
export function createToonMaterial({ flatShading = false, ...parameters }) {
  const material = new THREE.MeshToonMaterial({ gradientMap: getToonGradientMap(), ...parameters });
  material.flatShading = flatShading;
  return material;
}

/** Vertex-coloured, flat-shaded toon material for the merged low-poly islands. */
export function vertexToonMaterial() {
  return cached(
    'toon:vertex',
    () => createToonMaterial({ color: '#ffffff', vertexColors: true, flatShading: true }));
}

/**
 * Toon brass with a hard-edged rim highlight: a stepped fresnel term is added
 * on top of the banded diffuse so curved hardware catches a bright edge the
 * way polished metal is drawn in anime.
 */
export function brassMaterial(color = '#d9a441', rimColor = '#fff1c2', rimStrength = 0.55) {
  const key = `brass:${color}:${rimColor}:${rimStrength}`;
  return cached(key, () => {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradientMap() });
    const rim = new THREE.Color(rimColor).multiplyScalar(rimStrength);

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: rim };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;')
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          float rimFacing = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          outgoingLight += uRimColor * smoothstep(0.58, 0.62, rimFacing);
          #include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => key;
    return material;
  });
}

/**
 * Inverted-hull outline material.
 * @param {number} thickness fraction of view distance (≈ fraction of screen height)
 */
export function outlineMaterial(thickness = 0.0032) {
  return cached(
    `ink:${thickness}`,
    () =>
      new THREE.ShaderMaterial({
        name: 'InkOutline',
        vertexShader: outlineVertexShader,
        fragmentShader: outlineFragmentShader,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uOutlineColor: { value: new THREE.Color(SCENE.inkColor) },
            uThickness: { value: thickness },
          },
        ]),
        side: THREE.BackSide,
        fog: true,
      }),
  );
}

/** Dispose every cached material and the gradient texture (canvas teardown). */
export function disposeToonKit() {
  materialCache.forEach((material) => material.dispose());
  materialCache.clear();
  gradientMap?.dispose();
  gradientMap = null;
}

/* ------------------------------ geometry ------------------------------ */

/**
 * Weld coincident vertices and recompute averaged normals.
 *
 * An inverted hull is displaced along vertex normals; wherever a mesh has
 * split normals (box corners, cylinder rims, faceted low-poly rock) the hull
 * tears open. Welding gives every corner a single averaged normal, which
 * keeps the silhouette watertight. Faceted looks are restored in the fill
 * material with `flatShading`, which ignores vertex normals entirely.
 */
export function smoothGeometry(geometry) {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const welded = mergeVertices(geometry, 1e-4);
  welded.computeVertexNormals();
  geometry.dispose();
  return welded;
}

/* ------------------------------ component ----------------------------- */

const noRaycast = () => null;

/**
 * A cel-shaded mesh with its ink outline.
 * The hull is a child, so it inherits every transform applied to the mesh.
 */
export function Inked({ geometry, material, thickness = 0.0032, children, ...props }) {
  return (
    <mesh geometry={geometry} material={material} {...props}>
      <mesh geometry={geometry} material={outlineMaterial(thickness)} raycast={noRaycast} />
      {children}
    </mesh>
  );
}
