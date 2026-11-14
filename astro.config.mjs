import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [
    // Base styles are imported explicitly from src/styles/global.css.
    tailwind({ applyBaseStyles: false }),
    react(),
    mdx(),
  ],
  output: 'static',
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
