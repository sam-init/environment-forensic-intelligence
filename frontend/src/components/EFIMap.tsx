import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ForensicEvent } from '../types/api';
import type { EELayer } from './EarthEnginePanel';
import { getRiskColor, scoreToRiskLevel } from '../utils/format';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJSONFeatureAny = maplibregl.SourceSpecification extends infer T ? any : any;

interface EFIMapProps {
  events?: ForensicEvent[];
  selectedEventId?: string | null;
  onEventSelect?: (event: ForensicEvent) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  activeLayer?: EELayer;
  eeTileUrl?: string | null;
}

// Karnataka center
const DEFAULT_CENTER: [number, number] = [76.5, 14.5];
const DEFAULT_ZOOM = 7;

const OSM_SOURCE = {
  type: 'raster' as const,
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256 as const,
  attribution: '© OpenStreetMap contributors',
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
}: EFIMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: OSM_SOURCE,
        },
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

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Switch satellite / index layer ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const EE_SOURCE_ID = 'ee-satellite';
    const EE_LAYER_ID = 'ee-satellite-tiles';

    // Remove existing EE layer/source
    if (map.getLayer(EE_LAYER_ID)) map.removeLayer(EE_LAYER_ID);
    if (map.getSource(EE_SOURCE_ID)) map.removeSource(EE_SOURCE_ID);

    if (activeLayer === 'osm' || !eeTileUrl) {
      // Restore OSM opacity
      if (map.getLayer('osm-tiles')) {
        map.setPaintProperty('osm-tiles', 'raster-opacity', 0.45);
      }
      return;
    }

    // Dim OSM under the EE layer
    if (map.getLayer('osm-tiles')) {
      map.setPaintProperty('osm-tiles', 'raster-opacity', 0.12);
    }

    map.addSource(EE_SOURCE_ID, {
      type: 'raster',
      tiles: [eeTileUrl],
      tileSize: 256,
      attribution: '© Google Earth Engine · Sentinel-2',
    });

    // Insert the EE layer below event overlays
    const firstEventLayer = map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined;
    map.addLayer(
      {
        id: EE_LAYER_ID,
        type: 'raster',
        source: EE_SOURCE_ID,
        paint: { 'raster-opacity': 0.92 },
      },
      firstEventLayer,
    );
  }, [activeLayer, eeTileUrl, mapReady]);

  // ── Add event markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add event polygons as GeoJSON layers
    const sourceId = 'efi-events';
    if (map.getSource(sourceId)) {
      if (map.getLayer('efi-events-fill')) map.removeLayer('efi-events-fill');
      if (map.getLayer('efi-events-outline')) map.removeLayer('efi-events-outline');
      map.removeSource(sourceId);
    }

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

      // Click handler
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

    // Add dot markers for events with geometry-derived coordinates
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
  }, [events, selectedEventId, mapReady]);

  // ── Fly to selected event ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedEventId) return;

    const event = events.find((e) => e.event_id === selectedEventId);
    if (!event?.geometry?.coordinates) return;

    const coords = getFirstCoordinate(event.geometry);
    if (coords) {
      map.flyTo({ center: coords, zoom: 13, duration: 1200 });
    }
  }, [selectedEventId, mapReady]);

  return (
    <div
      ref={mapContainer}
      className="map-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

/** Extract the first [lng, lat] coordinate pair from a GeoJSON geometry. */
function getFirstCoordinate(geometry: { type: string; coordinates: unknown }): [number, number] | null {
  try {
    const coords = geometry.coordinates as unknown[];
    if (geometry.type === 'Point') {
      return coords as [number, number];
    }
    if (geometry.type === 'Polygon') {
      const ring = (coords[0] as number[][])[0];
      const center = getCentroid(coords[0] as number[][]);
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
