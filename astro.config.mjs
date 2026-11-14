import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  output: 'static',
  // The dev toolbar overlaps the HUD and intercepts pointer events over the scene.
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
  // Arc pages are tiny static documents — prefetch on hover so the lore panel
  // swaps in while the camera is still in flight.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    // Tailwind CSS 4 runs as a Vite plugin; its theme lives in src/styles/global.css.
    plugins: [tailwindcss()],
    assetsInclude: ['**/*.glb', '**/*.ktx2'],
    optimizeDeps: {
      // Pre-bundle the whole 3D stack in one pass so the first dev-server load
      // doesn't trigger a cascade of re-optimisations and full page reloads.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'three',
        'three/examples/jsm/utils/BufferGeometryUtils.js',
        'gsap',
        'nanostores',
        '@nanostores/react',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'postprocessing',
      ],
    },
    build: {
      // three + drei + postprocessing legitimately exceed Vite's default 500 kB warning.
      chunkSizeWarningLimit: 1600,
    },
  },
});
