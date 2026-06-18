/**
 * Shared map configuration for the developments map island.
 *
 * Kept in one place so the legend, the layer paint, and the popup all agree on
 * the category colors and labels.
 */

export type Category = 'completed' | 'under_construction' | 'planning';

export interface CategoryStyle {
  id: Category;
  label: string;
  color: string;
}

/**
 * Accessible, distinct palette (Okabe-Ito derived):
 *   completed          -> teal/green   (built and counted)
 *   under_construction -> orange       (in progress)
 *   planning           -> blue/purple  (proposed)
 */
export const CATEGORIES: CategoryStyle[] = [
  { id: 'completed', label: 'Completed', color: '#1b9e77' },
  { id: 'under_construction', label: 'Under construction', color: '#e6760e' },
  { id: 'planning', label: 'Planning approvals', color: '#5e4fa2' },
];

export const CATEGORY_COLOR: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color]),
) as Record<Category, string>;

/**
 * Meters of extrusion height per residential unit. The tallest development in
 * the dataset is ~521 units (2601-2645 Lincoln Blvd). At 1.6 m/unit that reads
 * as roughly an 830 m "skyline" spike for the largest site while keeping the
 * common 3-5 unit sites visible as low blocks. Tuned for a clear relative
 * silhouette rather than literal building heights.
 */
export const METERS_PER_UNIT = 1.6;

/** CARTO Positron key-free vector basemap (no token required). */
export const BASEMAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/** Fallback center/zoom on Santa Monica before bounds are fit. */
export const SANTA_MONICA_CENTER: [number, number] = [-118.49, 34.02];
export const DEFAULT_ZOOM = 12.5;
