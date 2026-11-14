/**
 * R3F canvas root. Mounted once from BaseLayout with `client:only="react"`
 * inside a `transition:persist` wrapper, so it is created exactly one time
 * per visit and survives every Astro view transition.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { gsap } from 'gsap';
import { GrandLineScene } from './GrandLineScene.jsx';
import { markSceneReady } from '../../stores/navigationStore.js';

const CANVAS_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
const CAMERA = { position: [0, 6.2, 11.5], fov: 45, near: 0.1, far: 500 };
const GL = { antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' };

function handleCreated({ gl, invalidate }) {
  const canvas = gl.domElement;
  // Keep the context recoverable: without preventDefault the browser will not
  // attempt to restore a lost context.
  canvas.addEventListener('webglcontextlost', (event) => event.preventDefault(), false);
  canvas.addEventListener('webglcontextrestored', () => invalidate(), false);
  // Reveal once a frame has actually been presented.
  requestAnimationFrame(() => requestAnimationFrame(markSceneReady));
}

export default function GrandLineCanvas({ islands = [] }) {
  // Clamp DPR to [1, 2]; drop to 1 if the device can't hold frame rate.
  const [dpr, setDpr] = useState([1, 2]);

  // The canvas normally lives for the whole visit; if it ever does unmount,
  // make sure no tween keeps animating disposed objects.
  useEffect(() => () => gsap.globalTimeline.clear(), []);

  return (
    <Canvas flat dpr={dpr} camera={CAMERA} gl={GL} style={CANVAS_STYLE} onCreated={handleCreated}>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr([1, 2])} flipflops={2} />
      <GrandLineScene islands={islands} />
    </Canvas>
  );
}
