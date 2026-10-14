import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ForensicEvent } from '../types/api';
import type { EELayer } from './EarthEnginePanel';
import { getRiskColor, scoreToRiskLevel } from '../utils/format';

interface EFIMapProps {
  events?: ForensicEvent[];
  selectedEventId?: string | null;
  onEventSelect?: (event: ForensicEvent) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  activeLayer?: EELayer;
  eeTileUrl?: string | null;
  // Temporal comparison props
  compareMode?: boolean;
  beforeTileUrl?: string | null;
  afterTileUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
}

const DEFAULT_CENTER: [number, number] = [76.5, 14.5];
const DEFAULT_ZOOM = 7;

const OSM_SOURCE = {
  type: 'raster' as const,
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256 as const,
  attribution: '© OpenStreetMap contributors',
  maxzoom: 19,
};

// Separate visual-inspection imagery from Sentinel-2 analysis: this source may
// offer sub-metre coverage, while Sentinel-2's native true-colour pixels are 10 m.
const HIGH_RES_IMAGERY_SOURCE = {
  type: 'raster' as const,
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256 as const,
  attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  maxzoom: 19,
};

export function EFIMap({
  events = [],
  selectedEventId,
  onEventSelect,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  activeLayer = 'osm',
  eeTileUrl = null,
  compareMode = false,
  beforeTileUrl = null,
  afterTileUrl = null,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: EFIMapProps) {
  // Single map refs
  const singleMapContainer = useRef<HTMLDivElement>(null);
  const singleMapRef = useRef<maplibregl.Map | null>(null);
  const singleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [singleMapReady, setSingleMapReady] = useState(false);

  // Compare maps refs
  const beforeContainer = useRef<HTMLDivElement>(null);
  const afterContainer = useRef<HTMLDivElement>(null);
  const beforeMapRef = useRef<maplibregl.Map | null>(null);
  const afterMapRef = useRef<maplibregl.Map | null>(null);
  const [compareMapsReady, setCompareMapsReady] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  //  1. Initialize Single Map (when NOT in compareMode)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (compareMode) return;
    if (!singleMapContainer.current || singleMapRef.current) return;

    const map = new maplibregl.Map({
      container: singleMapContainer.current,
      style: {
        version: 8,
        sources: { osm: OSM_SOURCE },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            paint: {
              'raster-opacity': 0.45,
              'raster-saturation': -0.8,
              'raster-brightness-max': 0.3,
            },
          },
        ],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    map.on('load', () => setSingleMapReady(true));
    singleMapRef.current = map;

    return () => {
      map.remove();
      singleMapRef.current = null;
      setSingleMapReady(false);
    };
  }, [compareMode]);

  // Update Single Map satellite layer
  useEffect(() => {
    if (compareMode) return;
    const map = singleMapRef.current;
    if (!map || !singleMapReady) return;

    const EE_SOURCE_ID = 'ee-satellite';
    const EE_LAYER_ID = 'ee-satellite-tiles';

    if (map.getLayer(EE_LAYER_ID)) map.removeLayer(EE_LAYER_ID);
    if (map.getSource(EE_SOURCE_ID)) map.removeSource(EE_SOURCE_ID);

    if (activeLayer === 'high_res_imagery') {
      if (map.getLayer('osm-tiles')) map.setPaintProperty('osm-tiles', 'raster-opacity', 0);
      map.addSource(EE_SOURCE_ID, HIGH_RES_IMAGERY_SOURCE);
      const firstEventLayer = map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined;
      map.addLayer({
        id: EE_LAYER_ID,
        type: 'raster',
        source: EE_SOURCE_ID,
        paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' },
      }, firstEventLayer);
      return;
    }

    if (activeLayer === 'osm' || !eeTileUrl) {
      if (map.getLayer('osm-tiles')) {
        map.setPaintProperty('osm-tiles', 'raster-opacity', 0.45);
      }
      return;
    }

    if (map.getLayer('osm-tiles')) {
      map.setPaintProperty('osm-tiles', 'raster-opacity', 0.12);
    }

    // GEE tile source — 256px tiles, native 10m Sentinel-2 resolution
    // No minzoom restriction — GEE serves sharp tiles at all zoom levels
    map.addSource(EE_SOURCE_ID, {
      type: 'raster',
      tiles: [eeTileUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 18,
      attribution: '© Google Earth Engine · Sentinel-2 (10m)',
    });

    const firstEventLayer = map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined;
    map.addLayer(
      {
        id: EE_LAYER_ID,
        type: 'raster',
        source: EE_SOURCE_ID,
        paint: {
          'raster-opacity': 0.95,
          'raster-resampling': 'linear',
        },
      },
      firstEventLayer,
    );
  }, [compareMode, activeLayer, eeTileUrl, singleMapReady]);

  // Update Single Map event overlays
  useEffect(() => {
    if (compareMode) return;
    const map = singleMapRef.current;
    if (!map || !singleMapReady) return;

    renderEventLayers(map, events, selectedEventId, singleMarkersRef, onEventSelect);
  }, [compareMode, events, selectedEventId, singleMapReady]);

  // Single Map fly to selected event
  useEffect(() => {
    if (compareMode) return;
    const map = singleMapRef.current;
    if (!map || !singleMapReady || !selectedEventId) return;

    const event = events.find((e) => e.event_id === selectedEventId);
    if (!event?.geometry?.coordinates) return;

    const coords = getFirstCoordinate(event.geometry);
    if (coords) map.flyTo({ center: coords, zoom: 14, duration: 1200 });
  }, [compareMode, selectedEventId, singleMapReady]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  2. Initialize Compare Dual Maps (when in compareMode)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!compareMode) {
      if (beforeMapRef.current) {
        beforeMapRef.current.remove();
        beforeMapRef.current = null;
      }
      if (afterMapRef.current) {
        afterMapRef.current.remove();
        afterMapRef.current = null;
      }
      setCompareMapsReady(false);
      return;
    }

    if (!beforeContainer.current || !afterContainer.current) return;
    if (beforeMapRef.current || afterMapRef.current) return;

    // Determine current center/zoom from single map if available
    const initialCenter = singleMapRef.current ? singleMapRef.current.getCenter().toArray() as [number, number] : center;
    const initialZoom = singleMapRef.current ? singleMapRef.current.getZoom() : zoom;

    const map1 = new maplibregl.Map({
      container: beforeContainer.current,
      style: {
        version: 8,
        sources: { osm: OSM_SOURCE },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-opacity': 0.25, 'raster-saturation': -0.8 },
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    const map2 = new maplibregl.Map({
      container: afterContainer.current,
      style: {
        version: 8,
        sources: { osm: OSM_SOURCE },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-opacity': 0.25, 'raster-saturation': -0.8 },
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    map1.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    map2.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    // Synchronize both maps
    let syncing = false;
    const syncMaps = (source: maplibregl.Map, target: maplibregl.Map) => {
      source.on('move', () => {
        if (syncing) return;
        syncing = true;
        target.jumpTo({
          center: source.getCenter(),
          zoom: source.getZoom(),
          bearing: source.getBearing(),
          pitch: source.getPitch(),
        });
        syncing = false;
      });
    };

    syncMaps(map1, map2);
    syncMaps(map2, map1);

    let loadedCount = 0;
    const onBothLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) setCompareMapsReady(true);
    };

    map1.on('load', onBothLoaded);
    map2.on('load', onBothLoaded);

    beforeMapRef.current = map1;
    afterMapRef.current = map2;

    return () => {
      map1.remove();
      map2.remove();
      beforeMapRef.current = null;
      afterMapRef.current = null;
      setCompareMapsReady(false);
    };
  }, [compareMode]);

  // Update satellite raster tiles in Compare Maps
  useEffect(() => {
    if (!compareMode || !compareMapsReady) return;

    const map1 = beforeMapRef.current;
    const map2 = afterMapRef.current;

    if (map1 && beforeTileUrl) {
      if (map1.getLayer('before-ee-tiles')) map1.removeLayer('before-ee-tiles');
      if (map1.getSource('before-ee-src')) map1.removeSource('before-ee-src');

      map1.addSource('before-ee-src', {
        type: 'raster',
        tiles: [beforeTileUrl],
        tileSize: 256,
        maxzoom: 18,
        attribution: '© Google Earth Engine · Sentinel-2',
      });
      map1.addLayer({
        id: 'before-ee-tiles',
        type: 'raster',
        source: 'before-ee-src',
        paint: {
          'raster-opacity': 0.95,
          'raster-resampling': 'linear',
        },
      });
    }

    if (map2 && afterTileUrl) {
      if (map2.getLayer('after-ee-tiles')) map2.removeLayer('after-ee-tiles');
      if (map2.getSource('after-ee-src')) map2.removeSource('after-ee-src');

      map2.addSource('after-ee-src', {
        type: 'raster',
        tiles: [afterTileUrl],
        tileSize: 256,
        maxzoom: 18,
        attribution: '© Google Earth Engine · Sentinel-2',
      });
      map2.addLayer({
        id: 'after-ee-tiles',
        type: 'raster',
        source: 'after-ee-src',
        paint: {
          'raster-opacity': 0.95,
          'raster-resampling': 'linear',
        },
      });
    }
  }, [compareMode, compareMapsReady, beforeTileUrl, afterTileUrl]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {!compareMode ? (
        <div ref={singleMapContainer} className="map-canvas" style={{ width: '100%', height: '100%' }} />
      ) : (
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          {/* Left map: BEFORE */}
          <div style={{ flex: 1, height: '100%', position: 'relative', borderRight: '2px solid rgba(59,130,246,0.6)' }}>
            <div ref={beforeContainer} style={{ width: '100%', height: '100%' }} />
            <div className="compare-map-label before-label">
              <span className="dot" style={{ background: '#3b82f6' }} />
              {beforeLabel}
            </div>
          </div>

          {/* Right map: AFTER */}
          <div style={{ flex: 1, height: '100%', position: 'relative' }}>
            <div ref={afterContainer} style={{ width: '100%', height: '100%' }} />
            <div className="compare-map-label after-label">
              <span className="dot" style={{ background: '#f59e0b' }} />
              {afterLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderEventLayers(
  map: maplibregl.Map,
  events: ForensicEvent[],
  selectedEventId: string | null | undefined,
  markersRef: React.MutableRefObject<maplibregl.Marker[]>,
  onEventSelect?: (event: ForensicEvent) => void,
) {
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  const sourceId = 'efi-events';
  if (map.getSource(sourceId)) {
    if (map.getLayer('efi-events-fill')) map.removeLayer('efi-events-fill');
    if (map.getLayer('efi-events-outline')) map.removeLayer('efi-events-outline');
    map.removeSource(sourceId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features = events
    .filter((e) => e.geometry)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e) => ({
      type: 'Feature' as const,
      properties: {
        event_id: e.event_id,
        risk_score: e.risk_score ?? 0,
        risk_level: e.risk_level ?? scoreToRiskLevel(e.risk_score),
        category: e.category,
        selected: e.event_id === selectedEventId,
      },
      geometry: e.geometry as any,
    })) as any[];

  if (features.length > 0) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    map.addLayer({
      id: 'efi-events-fill',
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'match',
          ['get', 'risk_level'],
          'critical', 'rgba(255,59,48,0.25)',
          'high', 'rgba(255,159,10,0.20)',
          'moderate', 'rgba(255,214,10,0.15)',
          'rgba(50,215,75,0.12)',
        ],
        'fill-opacity': ['case', ['get', 'selected'], 0.5, 0.3],
      },
    });

    map.addLayer({
      id: 'efi-events-outline',
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': [
          'match',
          ['get', 'risk_level'],
          'critical', 'rgba(255,59,48,0.9)',
          'high', 'rgba(255,159,10,0.9)',
          'moderate', 'rgba(255,214,10,0.8)',
          'rgba(50,215,75,0.8)',
        ],
        'line-width': ['case', ['get', 'selected'], 2.5, 1.5],
      },
    });

    map.on('click', 'efi-events-fill', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const eventId = feature.properties?.event_id as string;
      const evt = events.find((ev) => ev.event_id === eventId);
      if (evt) onEventSelect?.(evt);
    });

    map.on('mouseenter', 'efi-events-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'efi-events-fill', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  events.forEach((event) => {
    const level = event.risk_level ?? scoreToRiskLevel(event.risk_score);
    const color = getRiskColor(level);

    if (event.geometry?.coordinates) {
      const coords = getFirstCoordinate(event.geometry);
      if (coords) {
        const el = document.createElement('div');
        el.className = 'map-event-marker';
        el.style.cssText = `
          width: 10px; height: 10px; border-radius: 50%;
          background: ${color}; border: 2px solid rgba(255,255,255,0.3);
          cursor: pointer;
          ${event.event_id === selectedEventId ? 'transform: scale(1.5);' : ''}
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(map);

        el.addEventListener('click', () => onEventSelect?.(event));
        markersRef.current.push(marker);
      }
    }
  });
}

function getFirstCoordinate(geometry: { type: string; coordinates: unknown }): [number, number] | null {
  try {
    const coords = geometry.coordinates as unknown[];
    if (geometry.type === 'Point') {
      return coords as [number, number];
    }
    if (geometry.type === 'Polygon') {
      const center = getCentroid(coords[0] as number[][]);
      const ring = (coords[0] as number[][])[0];
      return center ?? [ring[0], ring[1]];
    }
    if (geometry.type === 'MultiPolygon') {
      const poly = coords[0] as number[][][];
      return getCentroid(poly[0]);
    }
    return null;
  } catch {
    return null;
  }
}

function getCentroid(ring: number[][]): [number, number] | null {
  if (!ring || ring.length === 0) return null;
  const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [lon, lat];
}
