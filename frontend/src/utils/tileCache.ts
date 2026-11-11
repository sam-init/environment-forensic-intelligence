import type { EELayer } from '../components/EarthEnginePanel';

const CACHED_TILES_KEY = 'efi_cached_ee_tiles';

export function getCachedTileUrl(layer: EELayer): string | null {
  try {
    const raw = localStorage.getItem(CACHED_TILES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[layer] || null;
  } catch {
    return null;
  }
}

export function setCachedTiles(tiles: Record<string, string>): void {
  try {
    localStorage.setItem(CACHED_TILES_KEY, JSON.stringify(tiles));
  } catch {
    // ignore localstorage errors
  }
}
