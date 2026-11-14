/**
 * Build-time helpers for the `arcs` content collection.
 * Only imported from `.astro` frontmatter — never shipped to the client.
 */
import { getCollection } from 'astro:content';

/** All arc entries, in voyage order. */
export async function getArcs() {
  const entries = await getCollection('arcs');
  return entries.sort((a, b) => a.data.arcOrder - b.data.arcOrder);
}

/**
 * Flatten an entry into the small serialisable record that is handed to the
 * canvas island (as props) and to the HUD (as inline JSON).
 */
export function toIsland(entry) {
  const { title, arcOrder, seaRegion, coordinates, magneticSignature, dangerLevel, summary } = entry.data;
  return {
    slug: entry.id,
    title,
    arcOrder,
    seaRegion,
    coordinates,
    magneticSignature,
    dangerLevel,
    summary,
  };
}

export async function getIslands() {
  return (await getArcs()).map(toIsland);
}
