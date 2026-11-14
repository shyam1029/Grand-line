import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Grand Line island / story-arc collection.
 *
 * Files are named `NN-slug.mdx` so they sort naturally on disk; the numeric
 * prefix is stripped from the entry id so routes read `/arcs/alabasta`.
 *
 * `coordinates` are expressed in scene units, with the Log Pose at the origin
 * and -Z pointing "up the Grand Line" (away from the default camera). The
 * needle yaw is derived directly from them: `Math.atan2(x, z)`.
 */
const arcs = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/arcs',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, '').replace(/^\d+-/, ''),
  }),
  schema: z.object({
    title: z.string(),
    arcOrder: z.number().int().positive(),
    seaRegion: z.enum(['Paradise', 'New World', 'Calm Belt']),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    /** How the island's magnetic field behaves / how long the Log takes to set. */
    magneticSignature: z.string(),
    dangerLevel: z.number().int().min(1).max(5),
    summary: z.string().max(280),
    featuredCharacters: z.array(z.string()).min(1),
    keyLocations: z.array(z.string()).min(1),
    heroImage: z.string().optional(),
  }),
});

export const collections = { arcs };
