/**
 * Procedural low-poly island blueprints.
 *
 * Each island is described as a list of parts — `[primitive, colour,
 * position, scale, rotation?]` — in island-local space with the waterline at
 * y = 0. `buildIsland` bakes every part's transform and colour into a single
 * vertex-coloured BufferGeometry, so a whole diorama costs two draw calls:
 * one cel-shaded fill and one ink hull.
 *
 * All primitives are unit-sized and centred (height 1, radius 1), so `scale`
 * reads directly as [radius, height, radius] and `position` is the centre.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothGeometry } from './ToonMaterials.jsx';

/* ------------------------------ primitives ----------------------------- */

const PRIMITIVE_FACTORIES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(1, 1, 1, 8),
  /** Island base: slightly narrower at the top. */
  mesa: () => new THREE.CylinderGeometry(0.82, 1, 1, 9),
  trunk: () => new THREE.CylinderGeometry(0.68, 1, 1, 7),
  /** Wider at the top — the Knock Up Stream. */
  funnel: () => new THREE.CylinderGeometry(1, 0.55, 1, 8),
  cone6: () => new THREE.ConeGeometry(1, 1, 6),
  cone8: () => new THREE.ConeGeometry(1, 1, 8),
  pyramid: () => new THREE.ConeGeometry(1, 1, 4),
  rock: () => new THREE.IcosahedronGeometry(1, 0),
  puff: () => new THREE.IcosahedronGeometry(1, 1),
  dome: () => new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  ring: () => new THREE.TorusGeometry(1, 0.1, 5, 12),
};

const primitiveCache = new Map();

function primitive(name) {
  if (!primitiveCache.has(name)) {
    // Welded normals keep the ink hull watertight on every part.
    primitiveCache.set(name, smoothGeometry(PRIMITIVE_FACTORIES[name]()));
  }
  return primitiveCache.get(name);
}

/* -------------------------------- palette ------------------------------ */

const C = {
  white: '#ffffff',
  cream: '#f4efe4',
  stone: '#e9e2d2',
  water: '#4fc3e8',
  waterLight: '#bfeeff',
  redRock: '#a4442f',
  redRockDark: '#853a2c',
  redRockMid: '#93402f',
  sand: '#e2b866',
  sandLight: '#edc878',
  sandDark: '#d2a052',
  teal: '#3aa7a0',
  wood: '#8a5a2b',
  woodDark: '#6b4a3a',
  bark: '#9b6a3f',
  leaf: '#57b85a',
  leafDark: '#3f9b4b',
  forest: '#2f7f3f',
  vine: '#6fbe4f',
  gold: '#f6c945',
  roof: '#e8824a',
  vermilion: '#c8392b',
  slate: '#6f7684',
  slateDark: '#56617a',
  meadow: '#7fb069',
  blossom: '#f7a8c4',
  grey: '#c9d6dc',
};

/* -------------------------------- helpers ------------------------------ */

/** Place `count` parts evenly on a circle; `make(x, z, angle, index)` returns part(s). */
function around(count, radius, make, phase = 0) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const angle = phase + (i / count) * Math.PI * 2;
    const result = make(Math.sin(angle) * radius, Math.cos(angle) * radius, angle, i);
    if (Array.isArray(result[0])) parts.push(...result);
    else parts.push(result);
  }
  return parts;
}

/* ------------------------------- blueprints ---------------------------- */

/** Reverse Mountain — a red spire with canals of seawater running up its ridges. */
function reverseMountain() {
  const slope = Math.atan(1.7 / 4.2); // lean of the main cone's flanks
  return [
    ['mesa', C.redRockDark, [0, 0.15, 0], [2.5, 1.1, 2.5]],
    ['cone6', C.redRock, [0, 2.6, 0], [1.7, 4.2, 1.7]],
    ['cone6', C.redRockDark, [-1.35, 1.5, 0.55], [0.9, 2.0, 0.9]],
    ['cone6', C.redRockMid, [1.25, 1.35, -0.65], [0.85, 1.7, 0.85]],
    ['cone6', C.redRockMid, [0.5, 1.2, 1.3], [0.6, 1.2, 0.6]],
    // Four currents climbing the ridges toward the summit.
    ...around(4, 0.84, (x, z, angle) => ['box', C.water, [x, 2.55, z], [0.24, 3.75, 0.09], [-slope, angle, 0]], Math.PI / 6),
    // Summit: where the canals collide, wreathed in cloud.
    ['rock', C.waterLight, [0, 4.62, 0], [0.3, 0.2, 0.3]],
    ['puff', C.white, [0.75, 3.75, 0.45], [0.7, 0.3, 0.55]],
    ['puff', C.white, [-0.7, 3.4, -0.4], [0.6, 0.26, 0.5]],
    ['puff', C.white, [0.1, 4.1, -0.75], [0.5, 0.22, 0.4]],
    // Twin Capes lighthouse at the foot of the mountain.
    ['cyl', C.cream, [1.95, 1.15, 1.05], [0.13, 0.95, 0.13]],
    ['cyl', C.gold, [1.95, 1.7, 1.05], [0.17, 0.16, 0.17]],
    ['cone8', C.vermilion, [1.95, 1.93, 1.05], [0.2, 0.3, 0.2]],
  ];
}

/** Alabasta — dunes, an oasis, and the domed palace of Alubarna on its plateau. */
function alabasta() {
  return [
    ['mesa', C.sand, [0, 0.12, 0], [2.7, 0.9, 2.7]],
    ['rock', C.sandLight, [-1.25, 0.6, 0.7], [0.95, 0.36, 0.75]],
    ['rock', C.sandLight, [1.1, 0.6, -1.0], [0.85, 0.32, 0.95]],
    ['rock', C.sandDark, [0.4, 0.6, 1.45], [0.7, 0.26, 0.55]],
    ['rock', C.sandLight, [-0.9, 0.6, -1.3], [0.7, 0.3, 0.6]],
    // Alubarna plateau and palace.
    ['cyl', C.sandDark, [0, 0.95, -0.15], [0.95, 0.8, 0.95]],
    ['box', C.cream, [0, 1.58, -0.15], [0.86, 0.46, 0.86]],
    ['dome', C.teal, [0, 1.81, -0.15], [0.44, 0.52, 0.44]],
    ['rock', C.gold, [0, 2.38, -0.15], [0.06, 0.1, 0.06]],
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) => [
        ['cyl', C.cream, [sx * 0.52, 1.75, -0.15 + sz * 0.52], [0.07, 0.8, 0.07]],
        ['cone8', C.teal, [sx * 0.52, 2.26, -0.15 + sz * 0.52], [0.11, 0.24, 0.11]],
      ]),
    ),
    // Oasis and palms.
    ['cyl', C.water, [1.45, 0.585, 0.75], [0.46, 0.04, 0.34]],
    ['cyl', C.wood, [1.95, 0.95, 0.55], [0.045, 0.75, 0.045], [0, 0, -0.14]],
    ['rock', C.leafDark, [2.0, 1.36, 0.55], [0.34, 0.1, 0.34]],
    ['cyl', C.wood, [-1.7, 0.95, -0.45], [0.045, 0.7, 0.045], [0, 0, 0.12]],
    ['rock', C.leaf, [-1.74, 1.33, -0.45], [0.32, 0.1, 0.32]],
    // Scattered clay houses.
    ['box', C.cream, [-0.5, 0.68, 1.0], [0.26, 0.2, 0.22]],
    ['box', C.stone, [0.95, 0.68, 0.2], [0.22, 0.2, 0.26]],
  ];
}

/**
 * Skypiea — island cloud, the stolen forest of the Upper Yard, Giant Jack and
 * the golden bell. Local origin is the cloud deck; the Knock Up Stream hangs
 * down from it to the sea.
 */
function skypiea(altitude) {
  const columnHeight = altitude + 0.9;
  return [
    // Knock Up Stream.
    ['funnel', C.water, [0, -columnHeight / 2 + 0.2, 0], [1.0, columnHeight, 1.0]],
    ...around(5, 0.82, (x, z, _angle, i) => ['puff', C.white, [x * (0.75 + i * 0.05), -altitude * (0.18 + i * 0.16), z * (0.75 + i * 0.05)], [0.42, 0.3, 0.42]], 0.4),
    // Cloud deck.
    ['puff', C.white, [0, 0, 0], [2.5, 0.72, 2.3]],
    ['puff', C.white, [1.7, 0.1, 0.85], [1.25, 0.62, 1.15]],
    ['puff', C.white, [-1.8, 0.05, -0.5], [1.35, 0.58, 1.25]],
    ['puff', C.white, [0.35, -0.08, -1.7], [1.25, 0.52, 1.05]],
    ['puff', C.white, [-0.65, 0.1, 1.6], [1.15, 0.52, 0.95]],
    // Upper Yard.
    ['rock', C.leafDark, [0.2, 0.74, -0.1], [1.35, 0.5, 1.25]],
    ['puff', C.forest, [-0.4, 1.22, 0.3], [0.52, 0.46, 0.52]],
    ['puff', C.forest, [0.9, 1.14, -0.45], [0.42, 0.4, 0.42]],
    ['puff', C.leaf, [0.55, 1.1, 0.6], [0.36, 0.34, 0.36]],
    // Giant Jack and the Golden Belfry.
    ['cyl', C.vine, [0.15, 2.3, -0.15], [0.12, 2.4, 0.12]],
    ['rock', C.vine, [0.48, 2.2, -0.15], [0.34, 0.07, 0.22]],
    ['rock', C.vine, [-0.16, 2.8, 0.02], [0.3, 0.07, 0.2]],
    ['rock', C.vine, [0.4, 3.25, -0.3], [0.26, 0.06, 0.2]],
    ['puff', C.white, [0.15, 3.42, -0.15], [0.5, 0.16, 0.5]],
    ['cone8', C.gold, [0.15, 3.72, -0.15], [0.26, 0.4, 0.26]],
  ];
}

/** Water 7 — a city stacked like a fountain, ringed by canals and orange roofs. */
function water7() {
  return [
    ['mesa', C.grey, [0, 0.08, 0], [2.6, 0.8, 2.6]],
    ['cyl', C.cream, [0, 0.78, 0], [2.05, 0.6, 2.05]],
    ['cyl', C.water, [0, 1.09, 0], [1.82, 0.04, 1.82]],
    ['cyl', C.stone, [0, 1.36, 0], [1.48, 0.58, 1.48]],
    ['cyl', C.water, [0, 1.66, 0], [1.26, 0.04, 1.26]],
    ['cyl', C.cream, [0, 1.92, 0], [0.98, 0.56, 0.98]],
    ['cyl', C.water, [0, 2.21, 0], [0.78, 0.04, 0.78]],
    ['cyl', C.stone, [0, 2.44, 0], [0.54, 0.5, 0.54]],
    // The great fountain.
    ['cone8', C.water, [0, 3.02, 0], [0.3, 0.7, 0.3]],
    ['puff', C.waterLight, [0, 3.38, 0], [0.42, 0.15, 0.42]],
    // Rooftops on each tier.
    ...around(9, 1.74, (x, z, angle) => [
      ['box', C.cream, [x, 1.2, z], [0.2, 0.2, 0.2], [0, angle, 0]],
      ['pyramid', C.roof, [x, 1.4, z], [0.2, 0.2, 0.2], [0, angle + Math.PI / 4, 0]],
    ]),
    ...around(6, 1.2, (x, z, angle) => [
      ['box', C.stone, [x, 1.77, z], [0.18, 0.2, 0.18], [0, angle, 0]],
      ['pyramid', C.roof, [x, 1.96, z], [0.18, 0.2, 0.18], [0, angle + Math.PI / 4, 0]],
    ], 0.5),
    // Galley-La dock and crane.
    ['box', C.wood, [2.25, 0.56, 0.2], [0.75, 0.1, 0.45]],
    ['box', C.woodDark, [2.45, 0.95, 0.2], [0.07, 0.7, 0.07]],
    ['box', C.woodDark, [2.2, 1.27, 0.2], [0.6, 0.06, 0.06]],
  ];
}

/** Sabaody — Yarukiman mangroves with numbered trunks and a ferris wheel. */
function sabaody() {
  const groves = [
    [0.1, 0.2, 3.3, 0.5],
    [-1.35, 0.75, 2.6, 0.42],
    [1.3, -0.8, 2.8, 0.44],
    [-0.75, -1.35, 2.3, 0.38],
    [1.0, 1.25, 2.1, 0.36],
  ];
  return [
    ['mesa', C.leafDark, [0, 0.02, 0], [2.6, 0.5, 2.6]],
    ['rock', C.leaf, [0, 0.22, 0], [2.2, 0.16, 2.2]],
    ...groves.flatMap(([x, z, height, radius], i) => [
      ['trunk', C.bark, [x, height / 2 + 0.2, z], [radius, height, radius]],
      ['cyl', C.cream, [x, height * 0.5 + 0.2, z], [radius * 0.9, 0.2, radius * 0.9]],
      ['puff', i % 2 ? C.leafDark : C.leaf, [x, height + 0.35, z], [radius * 2.5, 0.46, radius * 2.5]],
      ['puff', i % 2 ? C.leaf : C.leafDark, [x + 0.3, height + 0.62, z - 0.2], [radius * 1.5, 0.32, radius * 1.5]],
    ]),
    // Arching roots.
    ...around(6, 2.15, (x, z, angle) => ['ring', C.bark, [x, 0.3, z], [0.4, 0.4, 0.4], [0, angle + Math.PI / 2, 0]], 0.3),
    // Sabaody Park.
    ['ring', C.roof, [1.85, 1.05, 0.25], [0.52, 0.52, 0.52], [0, 0.5, 0]],
    ['box', C.cream, [1.85, 0.55, 0.25], [0.08, 0.6, 0.08]],
  ];
}

/** Wano — a sheer plateau behind waterfalls: Mt. Fuji, a castle, sakura and a torii. */
function wano() {
  const lean = Math.atan((2.35 * 0.18) / 2.7); // lean of the plateau wall
  return [
    ['mesa', C.slate, [0, 1.05, 0], [2.35, 2.7, 2.35]],
    ['cyl', C.meadow, [0, 2.44, 0], [1.98, 0.12, 1.98]],
    // Waterfalls pouring off the cliffs.
    ...around(3, 2.18, (x, z, angle) => ['box', C.waterLight, [x, 1.05, z], [0.62, 2.72, 0.1], [-lean, angle, 0]], 0.35),
    ['puff', C.white, [0.75, 0.05, 2.05], [0.5, 0.2, 0.4]],
    // Mt. Fuji with its snow cap.
    ['cone8', C.slateDark, [-0.65, 3.35, -0.55], [1.0, 1.75, 1.0]],
    ['cone8', C.white, [-0.65, 3.95, -0.55], [0.36, 0.6, 0.36]],
    // Castle keep of the Flower Capital.
    ['box', C.cream, [0.85, 2.72, 0.35], [0.56, 0.44, 0.56]],
    ['pyramid', C.vermilion, [0.85, 3.04, 0.35], [0.56, 0.24, 0.56], [0, Math.PI / 4, 0]],
    ['box', C.cream, [0.85, 3.22, 0.35], [0.36, 0.3, 0.36]],
    ['pyramid', C.vermilion, [0.85, 3.47, 0.35], [0.42, 0.22, 0.42], [0, Math.PI / 4, 0]],
    ['rock', C.gold, [0.85, 3.63, 0.35], [0.05, 0.09, 0.05]],
    // Sakura.
    ['cyl', C.woodDark, [1.25, 2.72, -0.95], [0.05, 0.45, 0.05]],
    ['puff', C.blossom, [1.25, 3.08, -0.95], [0.42, 0.34, 0.42]],
    ['cyl', C.woodDark, [-1.3, 2.7, 0.95], [0.045, 0.4, 0.045]],
    ['puff', C.blossom, [-1.3, 3.02, 0.95], [0.36, 0.3, 0.36]],
    // Torii gate at the cliff edge.
    ['box', C.vermilion, [0.1, 2.76, 1.6], [0.06, 0.52, 0.06]],
    ['box', C.vermilion, [0.6, 2.76, 1.6], [0.06, 0.52, 0.06]],
    ['box', C.vermilion, [0.35, 3.04, 1.6], [0.72, 0.07, 0.09]],
    ['box', C.vermilion, [0.35, 2.9, 1.6], [0.56, 0.045, 0.06]],
  ];
}

/** Fallback for any arc added to the collection without a bespoke blueprint. */
function uncharted() {
  return [
    ['mesa', C.slate, [0, 0.2, 0], [2.3, 1.0, 2.3]],
    ['rock', C.meadow, [0, 0.75, 0], [1.9, 0.3, 1.9]],
    ['cone6', C.slateDark, [0.2, 1.7, -0.2], [1.1, 2.0, 1.1]],
    ['puff', C.forest, [-0.9, 1.1, 0.7], [0.5, 0.42, 0.5]],
  ];
}

/**
 * Per-island metadata.
 *   beaconHeight  local y of the floating beacon
 *   hit           [radius, height, centreY] of the invisible pointer target
 *   shoreRadius   radius of the foam ring drawn by the ocean shader
 *   bubbles       whether resin bubbles drift up from the island
 */
const BLUEPRINTS = {
  'reverse-mountain': { parts: reverseMountain, beaconHeight: 5.6, hit: [2.7, 5.4, 2.5], shoreRadius: 2.6 },
  alabasta: { parts: alabasta, beaconHeight: 3.4, hit: [2.9, 3.2, 1.4], shoreRadius: 2.8 },
  skypiea: { parts: skypiea, beaconHeight: 4.9, hit: [2.9, 5.2, 1.9], shoreRadius: 1.15 },
  'water-7': { parts: water7, beaconHeight: 4.4, hit: [2.8, 4.0, 1.8], shoreRadius: 2.7 },
  sabaody: { parts: sabaody, beaconHeight: 4.9, hit: [2.8, 4.6, 2.1], shoreRadius: 2.7, bubbles: true },
  'wano-country': { parts: wano, beaconHeight: 5.2, hit: [2.6, 5.0, 2.3], shoreRadius: 2.5 },
};

const FALLBACK = { parts: uncharted, beaconHeight: 3.8, hit: [2.6, 3.6, 1.6], shoreRadius: 2.4 };

export function getIslandMeta(slug) {
  return BLUEPRINTS[slug] ?? FALLBACK;
}

/* --------------------------------- baking ------------------------------ */

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scaleVector = new THREE.Vector3();
// YXZ: tilt first, then yaw — so "lean against a slope, then walk it around the island" composes naturally.
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const color = new THREE.Color();

/**
 * Bake a blueprint into one vertex-coloured geometry.
 * @param {string} slug
 * @param {number} altitude world y of the island origin (used by sky islands)
 */
export function buildIsland(slug, altitude = 0) {
  const meta = getIslandMeta(slug);

  const baked = meta.parts(altitude).map(([name, hex, at, size, rotation = [0, 0, 0]]) => {
    const part = primitive(name).clone();

    position.fromArray(at);
    euler.set(rotation[0], rotation[1], rotation[2]);
    quaternion.setFromEuler(euler);
    if (Array.isArray(size)) scaleVector.fromArray(size);
    else scaleVector.setScalar(size);
    part.applyMatrix4(matrix.compose(position, quaternion, scaleVector));

    // Vertex colours are stored in the linear working space.
    color.set(hex);
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return part;
  });

  const geometry = mergeGeometries(baked, false);
  baked.forEach((part) => part.dispose());
  geometry.computeBoundingSphere();
  return { geometry, meta };
}

/** Free the cached primitives (canvas teardown). */
export function disposeIslandPrimitives() {
  primitiveCache.forEach((geometry) => geometry.dispose());
  primitiveCache.clear();
}
