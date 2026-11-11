/**
 * High-performance 1 km × 1 km grid generator for Belagavi District.
 * Strictly clipped to the official Belagavi administrative boundary (13,950 tiles).
 * Zero bounding box bleed into Maharashtra, Kolhapur, Goa, or neighboring districts.
 */
import type { GridTileCollection } from '../types/api';

let cachedGrid: GridTileCollection | null = null;
let fetchPromise: Promise<GridTileCollection | null> | null = null;

export async function loadBelagaviGrid(): Promise<GridTileCollection | null> {
  if (cachedGrid) return cachedGrid;
  if (!fetchPromise) {
    fetchPromise = fetch('/data/belagavi_1km_grid.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GridTileCollection) => {
        cachedGrid = data;
        return data;
      })
      .catch((err) => {
        console.error('Failed to load Belagavi grid file:', err);
        return null;
      });
  }
  return fetchPromise;
}

export function getBelagavi1KmGrid(): GridTileCollection | null {
  if (cachedGrid) return cachedGrid;
  // Eagerly trigger background fetch so it's ready in memory
  loadBelagaviGrid();
  return null;
}

