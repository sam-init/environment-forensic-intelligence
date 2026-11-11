import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Search,
  X,
  MapPin,
  Tag,
  Grid3x3,
  Sparkles,
  Zap,
  Crosshair,
  BrainCircuit,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { ForensicEvent, GridTileCollection } from '../types/api';
import type { EELayer } from './EarthEnginePanel';
import { getRiskColor, scoreToRiskLevel } from '../utils/format';
import { useLocationInfo } from '../hooks/useLocationInfo';
import { getBelagavi1KmGrid } from '../utils/gridGenerator';
import { api } from '../utils/api';

interface EFIMapProps {
  events?: ForensicEvent[];
  selectedEventId?: string | null;
  onEventSelect?: (event: ForensicEvent) => void;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  activeLayer?: EELayer;
  onLayerChange?: (layer: EELayer) => void;
  eeTileUrl?: string | null;
  // Temporal comparison props
  compareMode?: boolean;
  beforeTileUrl?: string | null;
  afterTileUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  beforeAttribution?: string;
  afterAttribution?: string;
  // Belagavi 1 km processing grid
  gridTiles?: GridTileCollection | null;
  selectedTileId?: string | null;
  onTileSelect?: (tileId: string) => void;
  focus?: { center: [number, number]; zoom: number; nonce: number } | null;
  onViewCenterChange?: (center: [number, number], zoom: number) => void;
  showLabels?: boolean;
  onToggleLabels?: (show: boolean) => void;
  showGrid?: boolean;
  onToggleGrid?: (show: boolean) => void;
}

type PhotonProperties = {
  name?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  type?: string;
  osm_value?: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
};

type PhotonResponse = { features?: PhotonFeature[] };

// Belagavi district centre
const DEFAULT_CENTER: [number, number] = [74.5, 15.85];
const DEFAULT_ZOOM = 9;

type GridEventHandlers = {
  click: (event: maplibregl.MapMouseEvent) => void;
  move: (event: maplibregl.MapMouseEvent) => void;
};
const gridHandlersByMap = new WeakMap<maplibregl.Map, GridEventHandlers>();

const OSM_SOURCE = {
  type: 'raster' as const,
  tiles: [
    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ],
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
  maxzoom: 18,
};

// Official Esri reference overlay: State boundaries, District boundaries,
// and Area / City / Town / Village names tailored for satellite imagery.
const HIGH_RES_LABELS_SOURCE = {
  type: 'raster' as const,
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256 as const,
  attribution: '© Esri — Boundaries & Places Reference',
  maxzoom: 18,
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
  beforeAttribution = '© Google Earth Engine · Sentinel-2',
  afterAttribution = '© Google Earth Engine · Sentinel-2',
  gridTiles = null,
  selectedTileId = null,
  onTileSelect,
  focus = null,
  onViewCenterChange,
  showLabels,
  onToggleLabels,
  showGrid,
  onToggleGrid,
  onLayerChange,
}: EFIMapProps) {
  const [internalShowLabels, setInternalShowLabels] = useState(false);
  const effectiveShowLabels = showLabels !== undefined ? showLabels : internalShowLabels;
  const handleToggleLabels = (next: boolean) => {
    setInternalShowLabels(next);
    onToggleLabels?.(next);
  };

  const [internalShowGrid, setInternalShowGrid] = useState(false);
  const effectiveShowGrid = showGrid !== undefined ? showGrid : internalShowGrid;
  const handleToggleGrid = (next: boolean) => {
    setInternalShowGrid(next);
    onToggleGrid?.(next);
  };

  const [currentCenter, setCurrentCenter] = useState<[number, number]>(center);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const locationInfo = useLocationInfo(currentCenter);
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

  // Keep the view-change callback stable so map effects don't re-run on parent renders.
  const viewChangeRef = useRef(onViewCenterChange);
  useEffect(() => {
    viewChangeRef.current = onViewCenterChange;
  }, [onViewCenterChange]);

  // Place / district / state search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // AI Change Detection State (Siamese ResNet-18)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiVerdict, setAiVerdict] = useState<{
    is_changed: boolean;
    label: string;
    change_probability: number;
    unchanged_probability: number;
    confidence: number;
    severity: string;
    tile_id?: string;
    raw_probability?: number;
    edge_correlation?: number;
    deep_similarity?: number;
    analysis_note?: string;
    beforeImg: string;
    afterImg: string;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Clear AI verdict when leaving compare mode
  useEffect(() => {
    if (!compareMode) {
      setAiVerdict(null);
      setAnalysisError(null);
    }
  }, [compareMode]);

  const handleRunAiDetection = async () => {
    const map1 = beforeMapRef.current;
    const map2 = afterMapRef.current;
    if (!map1 || !map2) {
      setAnalysisError('Comparison maps are not initialized yet.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      let bbox: [number, number, number, number] | null = null;
      if (selectedTileId) {
        let feature = gridTiles?.features?.find((f) => f.properties?.tile_id === selectedTileId);
        if (!feature) {
          const source = map1.getSource('efi-grid') as any;
          if (source?._data?.features) {
            feature = source._data.features.find((f: any) => f.properties?.tile_id === selectedTileId);
          }
        }
        if (!feature) {
          const queried = map1.querySourceFeatures('efi-grid', { filter: ['==', 'tile_id', selectedTileId] });
          if (queried && queried.length > 0) feature = queried[0] as any;
        }
        if (feature?.geometry) {
          bbox = getFeatureBBox(feature.geometry);
        }
      }

      // If tile selected and outside view or too small, zoom to it at high resolution (zoom 15.2)
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const inView = map1.getBounds().contains([centerLng, centerLat]);
        if (!inView || map1.getZoom() < 14.5) {
          await new Promise<void>((resolve) => {
            const onMoveEnd = () => {
              map1.off('moveend', onMoveEnd);
              resolve();
            };
            map1.on('moveend', onMoveEnd);
            map1.flyTo({ center: [centerLng, centerLat], zoom: 15.2, duration: 400 });
            setTimeout(() => {
              map1.off('moveend', onMoveEnd);
              resolve();
            }, 1000);
          });
        }
      }

      // Wait until all high-res satellite tiles have finished downloading and rendering
      const waitForTiles = (map: maplibregl.Map, timeoutMs = 2500) => {
        return new Promise<void>((resolve) => {
          if (map.areTilesLoaded()) {
            resolve();
            return;
          }
          let finished = false;
          const onIdle = () => {
            if (!finished) {
              finished = true;
              map.off('idle', onIdle);
              resolve();
            }
          };
          map.on('idle', onIdle);
          setTimeout(() => {
            if (!finished) {
              finished = true;
              map.off('idle', onIdle);
              resolve();
            }
          }, timeoutMs);
        });
      };
      await Promise.all([waitForTiles(map1), waitForTiles(map2)]);

      // Temporarily hide all vector/grid/boundary/label overlays so snapshots capture PURE satellite imagery
      const OVERLAY_LAYERS = [
        'efi-grid-fill',
        'efi-grid-line',
        'efi-grid-selected',
        'efi-belagavi-boundary-line',
        'efi-belagavi-boundary-glow',
        'before-labels-tiles',
        'after-labels-tiles',
        'osm-tiles',
        'efi-events-fill',
        'efi-events-outline',
      ];

      const restoreLayers1: string[] = [];
      const restoreLayers2: string[] = [];
      OVERLAY_LAYERS.forEach((id) => {
        if (map1.getLayer(id)) {
          const vis = map1.getLayoutProperty(id, 'visibility');
          if (vis !== 'none') {
            restoreLayers1.push(id);
            map1.setLayoutProperty(id, 'visibility', 'none');
          }
        }
        if (map2.getLayer(id)) {
          const vis = map2.getLayoutProperty(id, 'visibility');
          if (vis !== 'none') {
            restoreLayers2.push(id);
            map2.setLayoutProperty(id, 'visibility', 'none');
          }
        }
      });

      // Force MapLibre to paint a clean frame with raw satellite tiles
      map1.triggerRepaint();
      map2.triggerRepaint();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Snapshot the clean satellite crops
      const beforeImg = captureMapCrop(map1, bbox);
      const afterImg = captureMapCrop(map2, bbox);

      // Immediately restore overlays so interactive map UI remains functional
      restoreLayers1.forEach((id) => map1.setLayoutProperty(id, 'visibility', 'visible'));
      restoreLayers2.forEach((id) => map2.setLayoutProperty(id, 'visibility', 'visible'));
      map1.triggerRepaint();
      map2.triggerRepaint();

      if (!beforeImg || !afterImg) {
        throw new Error('Failed to capture snapshot from satellite canvas.');
      }

      const res = await api.post('/ml/predict-pair', {
        before_image: beforeImg,
        after_image: afterImg,
        tile_id: selectedTileId ?? undefined,
        threshold: 0.50,
      });

      setAiVerdict({
        ...res.data,
        beforeImg,
        afterImg,
      });
    } catch (err: any) {
      console.error('Siamese AI Detection error:', err);
      setAnalysisError(err?.message || 'Error executing AI change detection model.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Place search failed');
        const data = (await res.json()) as PhotonResponse;
        const features = Array.isArray(data.features) ? data.features : [];
        const places = features.filter(
          (feature) => !['street', 'house'].includes((feature.properties.type ?? '').toLowerCase()),
        );
        const ranked = (places.length > 0 ? places : features).sort(
          (a, b) => searchRank(a.properties) - searchRank(b.properties),
        );
        setSearchResults(ranked);
        setSearchOpen(true);
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSearchSelect = (feature: PhotonFeature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const target: [number, number] = [lon, lat];
    setCurrentCenter(target);
    const targetZoom = searchZoom(feature.properties);
    const map = compareMode
      ? beforeMapRef.current ?? afterMapRef.current
      : singleMapRef.current;
    map?.flyTo({ center: target, zoom: targetZoom, duration: 1200 });
    viewChangeRef.current?.(target, targetZoom);
    setSearchQuery(photonLabel(feature));
    setSearchOpen(false);
    setSearchResults([]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  1. Initialize Single Map (when NOT in compareMode)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (compareMode) return;
    if (!singleMapContainer.current || singleMapRef.current) return;

    const map = new maplibregl.Map({
      container: singleMapContainer.current,
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      maxTileCacheSize: 150,
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

    map.on('load', () => {
      setSingleMapReady(true);
      viewChangeRef.current?.(map.getCenter().toArray() as [number, number], map.getZoom());
    });
    map.on('moveend', () => {
      const c = map.getCenter().toArray() as [number, number];
      setCurrentCenter(c);
      setCurrentZoom(map.getZoom());
      viewChangeRef.current?.(c, map.getZoom());
    });
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
    const EE_LABELS_SOURCE_ID = 'ee-satellite-labels';
    const EE_LABELS_LAYER_ID = 'ee-satellite-labels-tiles';

    if (map.getLayer(EE_LABELS_LAYER_ID)) map.removeLayer(EE_LABELS_LAYER_ID);
    if (map.getSource(EE_LABELS_SOURCE_ID)) map.removeSource(EE_LABELS_SOURCE_ID);
    if (map.getLayer(EE_LAYER_ID)) map.removeLayer(EE_LAYER_ID);
    if (map.getSource(EE_SOURCE_ID)) map.removeSource(EE_SOURCE_ID);

    if (activeLayer === 'high_res_imagery') {
      if (map.getLayer('osm-tiles')) map.setPaintProperty('osm-tiles', 'raster-opacity', 0);
      map.addSource(EE_SOURCE_ID, HIGH_RES_IMAGERY_SOURCE);
      const firstOverLayer = map.getLayer('efi-grid-fill')
        ? 'efi-grid-fill'
        : (map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined);
      map.addLayer({
        id: EE_LAYER_ID,
        type: 'raster',
        source: EE_SOURCE_ID,
        paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' },
      }, firstOverLayer);

      if (effectiveShowLabels) {
        map.addSource(EE_LABELS_SOURCE_ID, HIGH_RES_LABELS_SOURCE);
        map.addLayer({
          id: EE_LABELS_LAYER_ID,
          type: 'raster',
          source: EE_LABELS_SOURCE_ID,
          paint: { 'raster-opacity': 1.0 },
        }, firstOverLayer);
      }
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
    // maxzoom: 14 matches physical sensor resolution; MapLibre applies smooth bilinear hardware filtering at zoom >= 15
    map.addSource(EE_SOURCE_ID, {
      type: 'raster',
      tiles: [eeTileUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 14,
      attribution: '© Google Earth Engine · Sentinel-2 (10m)',
    });

    const firstOverLayer = map.getLayer('efi-belagavi-boundary-glow')
      ? 'efi-belagavi-boundary-glow'
      : (map.getLayer('efi-grid-fill')
        ? 'efi-grid-fill'
        : (map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined));
    map.addLayer(
      {
        id: EE_LAYER_ID,
        type: 'raster',
        source: EE_SOURCE_ID,
        paint: {
          'raster-opacity': 1.0,
          'raster-resampling': 'linear',
        },
      },
      firstOverLayer,
    );

    if (effectiveShowLabels) {
      map.addSource(EE_LABELS_SOURCE_ID, HIGH_RES_LABELS_SOURCE);
      map.addLayer({
        id: EE_LABELS_LAYER_ID,
        type: 'raster',
        source: EE_LABELS_SOURCE_ID,
        paint: { 'raster-opacity': 1.0 },
      }, firstOverLayer);
    }
  }, [compareMode, activeLayer, eeTileUrl, singleMapReady, effectiveShowLabels]);

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

  // Single Map fly to the Belagavi grid after it is generated
  useEffect(() => {
    if (compareMode) return;
    const map = singleMapRef.current;
    if (!map || !singleMapReady || !focus) return;
    map.flyTo({ center: focus.center, zoom: focus.zoom, duration: 1400 });
  }, [compareMode, focus, singleMapReady]);

  // Single Map 1 km processing grid overlay — renders on EVERY layer
  useEffect(() => {
    if (compareMode) return;
    const map = singleMapRef.current;
    if (!map || !singleMapReady) return;

    renderGridLayers(map, gridTiles, selectedTileId, effectiveShowGrid, onTileSelect);
  }, [compareMode, gridTiles, selectedTileId, singleMapReady, effectiveShowGrid, activeLayer, eeTileUrl, onTileSelect]);

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
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      maxTileCacheSize: 150,
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
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      maxTileCacheSize: 150,
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

    map1.on('moveend', () => {
      const c = map1.getCenter().toArray() as [number, number];
      setCurrentCenter(c);
      setCurrentZoom(map1.getZoom());
      viewChangeRef.current?.(c, map1.getZoom());
    });

    let loadedCount = 0;
    const onBothLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        setCompareMapsReady(true);
        const c = map1.getCenter().toArray() as [number, number];
        setCurrentCenter(c);
        viewChangeRef.current?.(c, map1.getZoom());
      }
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

    if (map1) {
      if (map1.getLayer('before-labels-tiles')) map1.removeLayer('before-labels-tiles');
      if (map1.getSource('before-labels-src')) map1.removeSource('before-labels-src');
      if (map1.getLayer('before-ee-tiles')) map1.removeLayer('before-ee-tiles');
      if (map1.getSource('before-ee-src')) map1.removeSource('before-ee-src');

      if (beforeTileUrl) {
        const isHighResBefore = Boolean(
          beforeTileUrl.includes('arcgis.com') || beforeTileUrl.includes('arcgisonline.com')
        );
        map1.addSource('before-ee-src', {
          type: 'raster',
          tiles: [beforeTileUrl],
          tileSize: 256,
          maxzoom: isHighResBefore ? 18 : 14,
          attribution: beforeAttribution,
        });
        const firstOver1 = map1.getLayer('efi-belagavi-boundary-glow')
          ? 'efi-belagavi-boundary-glow'
          : (map1.getLayer('efi-grid-fill') ? 'efi-grid-fill' : undefined);
        map1.addLayer({
          id: 'before-ee-tiles',
          type: 'raster',
          source: 'before-ee-src',
          paint: {
            'raster-opacity': 1.0,
            'raster-resampling': 'linear',
          },
        }, firstOver1);

        if (effectiveShowLabels) {
          map1.addSource('before-labels-src', HIGH_RES_LABELS_SOURCE);
          map1.addLayer({
            id: 'before-labels-tiles',
            type: 'raster',
            source: 'before-labels-src',
            paint: { 'raster-opacity': 1.0 },
          }, firstOver1);
        }
      }
    }

    if (map2) {
      if (map2.getLayer('after-labels-tiles')) map2.removeLayer('after-labels-tiles');
      if (map2.getSource('after-labels-src')) map2.removeSource('after-labels-src');
      if (map2.getLayer('after-ee-tiles')) map2.removeLayer('after-ee-tiles');
      if (map2.getSource('after-ee-src')) map2.removeSource('after-ee-src');

      if (afterTileUrl) {
        const isHighResAfter = Boolean(
          afterTileUrl.includes('arcgis.com') || afterTileUrl.includes('arcgisonline.com')
        );
        map2.addSource('after-ee-src', {
          type: 'raster',
          tiles: [afterTileUrl],
          tileSize: 256,
          maxzoom: isHighResAfter ? 18 : 14,
          attribution: afterAttribution,
        });
        const firstOver2 = map2.getLayer('efi-belagavi-boundary-glow')
          ? 'efi-belagavi-boundary-glow'
          : (map2.getLayer('efi-grid-fill') ? 'efi-grid-fill' : undefined);
        map2.addLayer({
          id: 'after-ee-tiles',
          type: 'raster',
          source: 'after-ee-src',
          paint: {
            'raster-opacity': 1.0,
            'raster-resampling': 'linear',
          },
        }, firstOver2);

        if (effectiveShowLabels) {
          map2.addSource('after-labels-src', HIGH_RES_LABELS_SOURCE);
          map2.addLayer({
            id: 'after-labels-tiles',
            type: 'raster',
            source: 'after-labels-src',
            paint: { 'raster-opacity': 1.0 },
          }, firstOver2);
        }
      }
    }
  }, [compareMode, compareMapsReady, beforeTileUrl, afterTileUrl, beforeAttribution, afterAttribution, effectiveShowLabels]);

  // Compare Maps 1 km processing grid overlay — renders on both before and after panes
  useEffect(() => {
    if (!compareMode || !compareMapsReady) return;
    const map1 = beforeMapRef.current;
    const map2 = afterMapRef.current;
    if (map1) renderGridLayers(map1, gridTiles, selectedTileId, effectiveShowGrid, onTileSelect);
    if (map2) renderGridLayers(map2, gridTiles, selectedTileId, effectiveShowGrid, onTileSelect);
  }, [compareMode, compareMapsReady, gridTiles, selectedTileId, effectiveShowGrid, beforeTileUrl, afterTileUrl, onTileSelect]);

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

      {/* Sleek unified top control bar */}
      <div className="map-top-bar" onMouseDown={(e) => e.stopPropagation()}>
        {/* Left: Place search */}
        <div className="map-search-box">
          <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchOpen(false);
              if (e.key === 'Enter' && searchResults[0]) {
                e.preventDefault();
                handleSearchSelect(searchResults[0]);
              }
            }}
            placeholder="Search place in Belagavi…"
            aria-label="Search place in Belagavi"
          />
          {searching && <div className="loading-spinner" style={{ width: 10, height: 10, borderWidth: 1, flexShrink: 0 }} />}
          {searchQuery && !searching && (
            <button
              className="map-search-clear"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setSearchOpen(false);
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}

          {searchOpen && !searching && (
            <div className="map-search-results">
              {searchResults.length === 0 ? (
                <div className="map-search-empty">No places found</div>
              ) : (
                searchResults.map((feature, index) => (
                  <button
                    key={`${feature.geometry.coordinates.join(',')}-${index}`}
                    className="map-search-result"
                    onClick={() => handleSearchSelect(feature)}
                  >
                    <div className="map-search-result-name">{feature.properties.name ?? 'Unnamed place'}</div>
                    <div className="map-search-result-detail">{photonDetail(feature.properties)}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Actions and District Focus */}
        <div className="map-top-actions">
          <button
            type="button"
            className="map-district-badge-btn"
            onClick={() => {
              const map = compareMode ? beforeMapRef.current : singleMapRef.current;
              if (map) {
                map.flyTo({ center: [74.50, 15.85], zoom: 9.3, duration: 800 });
              }
            }}
            title={`Belagavi District (13,415 km² · 13,950 1km grid cells) — click to focus`}
            aria-label="Focus Belagavi District"
          >
            <span className="map-district-badge-dot" />
            <span>District: <strong>Belagavi</strong></span>
          </button>

          <button
            type="button"
            className={`map-labels-toggle-btn ${effectiveShowLabels ? 'active' : ''}`}
            onClick={() => handleToggleLabels(!effectiveShowLabels)}
            title={effectiveShowLabels ? 'Area & District labels visible on map — click to hide' : 'Area & District labels hidden — click to show'}
            aria-label="Toggle map area and district labels"
          >
            <Tag size={11} />
            <span>{effectiveShowLabels ? 'Labels ON' : 'Labels OFF'}</span>
          </button>

          <button
            type="button"
            className={`map-labels-toggle-btn ${effectiveShowGrid ? 'active-grid' : ''}`}
            onClick={() => {
              const next = !effectiveShowGrid;
              handleToggleGrid(next);
              if (next) {
                const map = compareMode ? beforeMapRef.current : singleMapRef.current;
                if (map && map.getZoom() < 10.5) {
                  map.flyTo({ zoom: 11, duration: 800 });
                }
              }
            }}
            title={effectiveShowGrid ? '1 km Belagavi grid visible — click to hide' : '1 km Belagavi grid hidden — click to show and focus grid'}
            aria-label="Toggle 1x1 km Belagavi grid overlay"
          >
            <Grid3x3 size={11} />
            <span>{effectiveShowGrid ? '1km Grid: ON' : '1km Grid: OFF'}</span>
          </button>

          {activeLayer === 'true_color' && currentZoom >= 15 && onLayerChange && (
            <button
              type="button"
              className="high-res-suggest-pill"
              onClick={() => onLayerChange('high_res_imagery')}
              title="Sentinel-2 10m physical limit reached. Click to switch to sub-meter (30cm) High-Resolution Imagery"
              aria-label="Switch to High-Resolution Imagery"
            >
              <Sparkles size={11} />
              <span>30cm High-Res</span>
            </button>
          )}
          {activeLayer === 'high_res_imagery' && onLayerChange && (
            <button
              type="button"
              className="high-res-suggest-pill active"
              onClick={() => onLayerChange('true_color')}
              title="Viewing sub-meter commercial imagery. Click to switch back to live 5-day Sentinel-2 True Colour"
              aria-label="Switch to True Colour"
            >
              <Sparkles size={11} />
              <span>30cm Active (Switch to Live)</span>
            </button>
          )}
        </div>
      </div>

      {/* Compare Mode AI Change Detection Toolbar */}
      {compareMode && (
        <div className="compare-ai-toolbar" onMouseDown={(e) => e.stopPropagation()}>
          <div className="compare-ai-meta">
            <div className="compare-ai-chip">
              <Sparkles size={13} className="sparkle-icon" />
              <span>Siamese ResNet-18</span>
            </div>
            {selectedTileId ? (
              <div className="compare-ai-selection-badge">
                <span className="dot dot-amber" />
                <span>Parcel: <strong>{selectedTileId}</strong> (1×1 km)</span>
                <button
                  type="button"
                  className="compare-ai-deselect-btn"
                  onClick={() => onTileSelect?.('')}
                  title="Clear parcel selection (switch to viewport mode)"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="compare-ai-hint">
                <Grid3x3 size={12} />
                <span>Click any 1×1 km cell on either map, or analyze current viewport</span>
              </div>
            )}
          </div>

          <div className="compare-ai-buttons">
            {selectedTileId && (
              <button
                type="button"
                className="btn btn-secondary btn-sm compare-focus-btn"
                onClick={() => {
                  const map = beforeMapRef.current;
                  if (!map) return;
                  let feature = gridTiles?.features?.find((f) => f.properties?.tile_id === selectedTileId);
                  if (!feature) {
                    const source = map.getSource('efi-grid') as any;
                    if (source?._data?.features) {
                      feature = source._data.features.find((f: any) => f.properties?.tile_id === selectedTileId);
                    }
                  }
                  if (feature?.geometry) {
                    const bbox = getFeatureBBox(feature.geometry);
                    if (bbox) {
                      map.flyTo({
                        center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
                        zoom: 14.5,
                        duration: 700,
                      });
                    }
                  }
                }}
                title="Focus on selected 1km parcel"
              >
                <Crosshair size={13} />
                <span>Focus Parcel</span>
              </button>
            )}

            <button
              type="button"
              className="btn-ai-analyze"
              onClick={handleRunAiDetection}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={13} className="spin" />
                  <span>Analyzing with Siamese ResNet-18…</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>
                    {selectedTileId ? 'Detect Land Changes (Selected Cell)' : 'Detect Land Changes (Viewport)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI Error Notification */}
      {analysisError && (
        <div className="compare-ai-error" onMouseDown={(e) => e.stopPropagation()}>
          <AlertCircle size={14} />
          <span>{analysisError}</span>
          <button type="button" onClick={() => setAnalysisError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* AI Verdict Modal Overlay */}
      {aiVerdict && (
        <div className="ai-verdict-overlay" onClick={() => setAiVerdict(null)}>
          <div className="ai-verdict-card" onClick={(e) => e.stopPropagation()}>
            <div className="ai-verdict-header">
              <div className="ai-verdict-title">
                <BrainCircuit size={18} style={{ color: '#22d3ee' }} />
                <span>Siamese Neural Network Land Change Verdict</span>
              </div>
              <button
                type="button"
                className="ai-verdict-close"
                onClick={() => setAiVerdict(null)}
                aria-label="Close verdict"
              >
                <X size={16} />
              </button>
            </div>

            {/* Verdict Status Banner */}
            <div className={`ai-verdict-status-banner ${aiVerdict.is_changed ? 'status-changed' : 'status-unchanged'}`}>
              <div className="status-badge-icon">
                {aiVerdict.is_changed ? (
                  <AlertCircle size={28} style={{ color: '#ef4444' }} />
                ) : (
                  <CheckCircle2 size={28} style={{ color: '#10b981' }} />
                )}
              </div>
              <div className="status-badge-text">
                <div className="status-main-label">
                  {aiVerdict.is_changed ? 'LAND CHANGE DETECTED' : 'NO SIGNIFICANT CHANGE DETECTED'}
                </div>
                <div className="status-sub-label">
                  {aiVerdict.is_changed
                    ? `Change Probability: ${(aiVerdict.change_probability * 100).toFixed(1)}% · Severity: ${aiVerdict.severity}`
                    : `Confidence: ${(aiVerdict.confidence * 100).toFixed(1)}% · Consistent Natural Surface`}
                </div>
                {aiVerdict.analysis_note && (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                    {aiVerdict.analysis_note}
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-Side Snapshot Comparison Thumbnails */}
            <div className="ai-verdict-images-grid">
              <div className="ai-thumb-col">
                <div className="ai-thumb-tag before-tag">
                  <span className="dot" style={{ background: '#3b82f6' }} />
                  BEFORE MAP SNAPSHOT
                </div>
                <div className="ai-thumb-wrapper">
                  <img src={aiVerdict.beforeImg} alt="Before Map Crop" className="ai-thumb-img" />
                </div>
                <div className="ai-thumb-date">{beforeLabel}</div>
              </div>

              <div className="ai-thumb-vs">
                <span>VS</span>
              </div>

              <div className="ai-thumb-col">
                <div className="ai-thumb-tag after-tag">
                  <span className="dot" style={{ background: '#f59e0b' }} />
                  AFTER MAP SNAPSHOT
                </div>
                <div className="ai-thumb-wrapper">
                  <img src={aiVerdict.afterImg} alt="After Map Crop" className="ai-thumb-img" />
                </div>
                <div className="ai-thumb-date">{afterLabel}</div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="ai-verdict-meta-grid">
              <div className="meta-item">
                <span className="meta-key">Target Parcel</span>
                <span className="meta-val">{aiVerdict.tile_id || 'Viewport Center (1 km equiv.)'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Deep Architecture</span>
                <span className="meta-val">Siamese ResNet-18 (512-d Differencing)</span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Calibrated Change Prob</span>
                <span
                  className="meta-val"
                  style={{
                    color: aiVerdict.is_changed ? '#ef4444' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {(aiVerdict.change_probability * 100).toFixed(2)}%
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Risk / Severity</span>
                <span
                  className="meta-val"
                  style={{
                    color: aiVerdict.severity === 'HIGH' ? '#ef4444' : aiVerdict.severity === 'MODERATE' ? '#f59e0b' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {aiVerdict.severity}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Edge Structural Corr (Sobel)</span>
                <span className="meta-val" style={{ color: (aiVerdict.edge_correlation ?? 1) >= 0.55 ? '#10b981' : '#f59e0b' }}>
                  {aiVerdict.edge_correlation !== undefined ? `${(aiVerdict.edge_correlation * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Deep Feature Similarity</span>
                <span className="meta-val" style={{ color: (aiVerdict.deep_similarity ?? 1) >= 0.90 ? '#10b981' : '#f59e0b' }}>
                  {aiVerdict.deep_similarity !== undefined ? `${(aiVerdict.deep_similarity * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="ai-verdict-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAiVerdict(null)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="btn-ai-analyze"
                onClick={handleRunAiDetection}
                disabled={isAnalyzing}
              >
                <RefreshCw size={13} className={isAnalyzing ? 'spin' : ''} style={{ marginRight: 6 }} />
                <span>Re-Analyze Area</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom HUD with live location context */}
      <div className="map-bottom-hud" onMouseDown={(e) => e.stopPropagation()}>
        <MapPin size={11} style={{ color: '#a855f7' }} />
        <span>{locationInfo.area || 'Belagavi Region'} · {locationInfo.district.replace(/\s*District/i, '')} District, {locationInfo.state}</span>
        {currentCenter && (
          <span className="map-bottom-coords">
            {currentCenter[1].toFixed(3)}°N, {currentCenter[0].toFixed(3)}°E
          </span>
        )}
      </div>
    </div>
  );
}

function photonLabel(feature: PhotonFeature): string {
  const p = feature.properties;
  const parts = [p.name, p.city, p.district, p.county, p.state, p.country].filter(
    (value): value is string => Boolean(value),
  );
  return Array.from(new Set(parts)).join(', ');
}

function photonDetail(props: PhotonProperties): string {
  const parts = [props.city, props.district, props.county, props.state, props.country].filter(
    (value): value is string => Boolean(value),
  );
  return Array.from(new Set(parts)).join(' · ') || 'Place';
}

function searchRank(props: PhotonProperties): number {
  const order = [
    'city',
    'town',
    'municipality',
    'village',
    'district',
    'county',
    'state',
    'country',
    'locality',
    'suburb',
    'neighbourhood',
    'street',
    'house',
  ];
  const index = order.indexOf((props.type ?? '').toLowerCase());
  return index === -1 ? order.length : index;
}

function searchZoom(props: PhotonProperties): number {
  const type = (props.type ?? props.osm_value ?? '').toLowerCase();
  if (type === 'country') return 5;
  if (['state', 'region'].includes(type)) return 7;
  if (['district', 'county'].includes(type)) return 9;
  if (['city', 'town', 'municipality'].includes(type)) return 11;
  if (['village', 'locality', 'suburb', 'neighbourhood', 'hamlet'].includes(type)) return 13;
  return 11;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFeatureBBox(geometry: any): [number, number, number, number] | null {
  if (!geometry || !geometry.coordinates) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function scan(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      coords.forEach(scan);
    }
  }

  scan(geometry.coordinates);
  if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function captureMapCrop(
  map: maplibregl.Map,
  bbox?: [number, number, number, number] | null,
  outputSize: number = 448,
): string | null {
  const canvas = map.getCanvas();
  if (!canvas) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = outputSize;
  offscreen.height = outputSize;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;

  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;

  let sx = 0;
  let sy = 0;
  let sw = canvas.width;
  let sh = canvas.height;

  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const p1 = map.project([minLng, maxLat]); // Top-left in CSS px
    const p2 = map.project([maxLng, minLat]); // Bottom-right in CSS px

    const cssX = Math.min(p1.x, p2.x);
    const cssY = Math.min(p1.y, p2.y);
    const cssW = Math.abs(p2.x - p1.x);
    const cssH = Math.abs(p2.y - p1.y);

    if (cssW > 10 && cssH > 10) {
      sx = Math.max(0, cssX * scaleX);
      sy = Math.max(0, cssY * scaleY);
      sw = Math.min(canvas.width - sx, cssW * scaleX);
      sh = Math.min(canvas.height - sy, cssH * scaleY);
    } else {
      const size = Math.min(canvas.width, canvas.height) * 0.7;
      sx = (canvas.width - size) / 2;
      sy = (canvas.height - size) / 2;
      sw = size;
      sh = size;
    }
  } else {
    const size = Math.min(canvas.width, canvas.height) * 0.7;
    sx = (canvas.width - size) / 2;
    sy = (canvas.height - size) / 2;
    sw = size;
    sh = size;
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

  return offscreen.toDataURL('image/png');
}

function renderGridLayers(
  map: maplibregl.Map,
  tiles: GridTileCollection | null,
  selectedTileId: string | null,
  showGrid: boolean = true,
  onTileSelect?: (tileId: string) => void,
) {
  const sourceId = 'efi-grid';
  const fillLayer = 'efi-grid-fill';
  const lineLayer = 'efi-grid-line';
  const boundarySourceId = 'efi-belagavi-boundary';
  const boundaryLineLayer = 'efi-belagavi-boundary-line';
  const boundaryGlowLayer = 'efi-belagavi-boundary-glow';

  const previousHandlers = gridHandlersByMap.get(map);
  if (previousHandlers) {
    map.off('click', previousHandlers.click);
    map.off('mousemove', previousHandlers.move);
    gridHandlersByMap.delete(map);
  }
  if (map.getLayer('efi-grid-selected')) map.removeLayer('efi-grid-selected');
  if (map.getLayer(fillLayer)) map.removeLayer(fillLayer);
  if (map.getLayer(lineLayer)) map.removeLayer(lineLayer);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  const beforeLayer = map.getLayer('efi-events-fill') ? 'efi-events-fill' : undefined;

  // Always render the official Belagavi District Boundary line
  if (!map.getSource(boundarySourceId)) {
    map.addSource(boundarySourceId, {
      type: 'geojson',
      data: '/data/belagavi_boundary.json',
    });
  }
  if (!map.getLayer(boundaryGlowLayer)) {
    map.addLayer(
      {
        id: boundaryGlowLayer,
        type: 'line',
        source: boundarySourceId,
        paint: {
          'line-color': '#06b6d4',
          'line-width': 4.5,
          'line-opacity': 0.45,
        },
      },
      beforeLayer,
    );
  }
  if (!map.getLayer(boundaryLineLayer)) {
    map.addLayer(
      {
        id: boundaryLineLayer,
        type: 'line',
        source: boundarySourceId,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      },
      beforeLayer,
    );
  }

  if (!showGrid) return;

  const gridData = (tiles && tiles.features && tiles.features.length > 0)
    ? (tiles as unknown as GeoJSON.FeatureCollection)
    : '/data/belagavi_1km_grid.json';

  map.addSource(sourceId, {
    type: 'geojson',
    data: gridData,
  });

  const selectedId = selectedTileId ?? '';

  map.addLayer(
    {
      id: fillLayer,
      type: 'fill',
      source: sourceId,
      minzoom: 9.0,
      paint: {
        'fill-color': '#06b6d4',
        'fill-opacity': 0.01, // Click-target without obstructing satellite imagery
      },
    },
    beforeLayer,
  );

  map.addLayer(
    {
      id: lineLayer,
      type: 'line',
      source: sourceId,
      minzoom: 9.0,
      paint: {
        'line-color': ['case', ['==', ['get', 'tile_id'], selectedId], '#f59e0b', 'rgba(6,182,212,0.60)'],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          9.0, 0.4,
          11.0, 0.8,
          13.0, 1.4,
          15.0, 2.2,
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          9.0, 0.30,
          11.0, 0.55,
          13.0, 0.85,
        ],
      },
    },
    beforeLayer,
  );

  // Dedicated high-contrast border for selected 1km parcel
  if (selectedId) {
    map.addLayer(
      {
        id: 'efi-grid-selected',
        type: 'line',
        source: sourceId,
        filter: ['==', ['get', 'tile_id'], selectedId],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3,
          'line-opacity': 1.0,
        },
      },
      beforeLayer,
    );
  }

  const click = (event: maplibregl.MapMouseEvent) => {
    if (
      map.getLayer('efi-events-fill') &&
      map.queryRenderedFeatures(event.point, { layers: ['efi-events-fill'] }).length > 0
    ) {
      return;
    }
    const tileId = map.queryRenderedFeatures(event.point, { layers: [fillLayer] })[0]
      ?.properties?.tile_id;
    if (typeof tileId === 'string') {
      onTileSelect?.(tileId === selectedId ? '' : tileId);
    }
  };
  const move = (event: maplibregl.MapMouseEvent) => {
    const overGrid =
      map.queryRenderedFeatures(event.point, { layers: [fillLayer] }).length > 0;
    map.getCanvas().style.cursor = overGrid ? 'pointer' : '';
  };
  map.on('click', click);
  map.on('mousemove', move);
  gridHandlersByMap.set(map, { click, move });
}

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
        const selected = event.event_id === selectedEventId;
        const size = selected ? 14 : 10;
        const el = document.createElement('div');
        el.className = 'map-event-marker';
        el.style.cssText = `
          width: ${size}px; height: ${size}px; border-radius: 50%;
          background: ${color}; border: 2px solid rgba(255,255,255,0.3);
          cursor: pointer;
          box-shadow: ${selected ? `0 0 0 3px ${color}33` : 'none'};
        `;
        el.title = 'Incident location';

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
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
