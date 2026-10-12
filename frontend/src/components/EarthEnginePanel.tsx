/**
 * EarthEnginePanel — satellite layer switcher + spectral index stats
 * Fetches real-time GEE tile URLs and injects them into the map.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Satellite, Activity, BarChart2, Layers, RefreshCw, ExternalLink } from 'lucide-react';
import { api } from '../utils/api';
import type { EEOverview } from '../types/api';

export type EELayer = 'osm' | 'true_color' | 'ndvi' | 'ndwi' | 'bsi';

interface EarthEnginePanelProps {
  activeLayer: EELayer;
  onLayerChange: (layer: EELayer, tileUrl?: string) => void;
  siteGeometry?: { type: string; coordinates: unknown[] } | null;
}

const LAYER_META: Record<EELayer, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  osm: {
    label: 'Base Map',
    icon: <Layers size={13} />,
    desc: 'OpenStreetMap vector base',
    color: '#6b7280',
  },
  true_color: {
    label: 'True Colour',
    icon: <Satellite size={13} />,
    desc: 'Sentinel-2 RGB (B4/B3/B2)',
    color: '#3b82f6',
  },
  ndvi: {
    label: 'NDVI',
    icon: <Activity size={13} />,
    desc: 'Vegetation density index',
    color: '#22c55e',
  },
  ndwi: {
    label: 'NDWI',
    icon: <Activity size={13} />,
    desc: 'Water body index',
    color: '#06b6d4',
  },
  bsi: {
    label: 'BSI',
    icon: <BarChart2 size={13} />,
    desc: 'Bare soil / disturbed land',
    color: '#f59e0b',
  },
};

function IndexBar({ value, min = -1, max = 1, color }: { value: number; min?: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        flex: 1,
        height: 4,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', minWidth: 36, textAlign: 'right' }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

export function EarthEnginePanel({ activeLayer, onLayerChange, siteGeometry }: EarthEnginePanelProps) {
  const [daysBack] = useState(60);

  // Fetch Karnataka overview (tile URLs + scene count)
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<EEOverview>({
    queryKey: ['ee-overview'],
    queryFn: async () => {
      const r = await api.get<EEOverview>('/earth-engine/overview');
      return r.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Fetch site stats if geometry provided
  const { data: siteStats, isLoading: statsLoading } = useQuery({
    queryKey: ['ee-site-stats', siteGeometry, daysBack],
    queryFn: async () => {
      const r = await api.post('/earth-engine/site-stats', { geometry: siteGeometry }, {
        params: { days_back: daysBack },
      });
      return r.data;
    },
    enabled: !!siteGeometry,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  function handleLayerSwitch(layer: EELayer) {
    if (layer === 'osm') {
      onLayerChange('osm', undefined);
      return;
    }
    if (!overview?.tiles) return;
    const tileUrl = (overview.tiles as Record<string, string>)[layer];
    onLayerChange(layer, tileUrl);
  }

  return (
    <div className="ee-panel">
      {/* Header */}
      <div className="ee-panel-header">
        <Satellite size={14} style={{ color: '#3b82f6' }} />
        <span className="ee-panel-title">Earth Engine</span>
        {overviewLoading ? (
          <div className="loading-spinner" style={{ width: 10, height: 10, borderWidth: 1, marginLeft: 'auto' }} />
        ) : (
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto', padding: '2px 4px' }}
            onClick={() => refetchOverview()}
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
        )}
      </div>

      {/* Scene count badge */}
      {overview && (
        <div className="ee-scene-badge">
          <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
            {overview.scene_count} scenes ·{' '}
            {overview.date_range.start} → {overview.date_range.end}
          </span>
        </div>
      )}

      {/* Layer switcher */}
      <div className="ee-layer-label">SATELLITE LAYER</div>
      <div className="ee-layers">
        {(Object.keys(LAYER_META) as EELayer[]).map((layer) => {
          const meta = LAYER_META[layer];
          const isActive = activeLayer === layer;
          const isDisabled = layer !== 'osm' && !overview?.tiles;

          return (
            <button
              key={layer}
              className={`ee-layer-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
              onClick={() => !isDisabled && handleLayerSwitch(layer)}
              title={meta.desc}
              disabled={isDisabled}
            >
              <span style={{ color: isActive ? meta.color : 'var(--color-text-muted)' }}>
                {meta.icon}
              </span>
              <span className="ee-layer-name">{meta.label}</span>
              {isActive && <div className="ee-active-dot" style={{ background: meta.color }} />}
            </button>
          );
        })}
      </div>

      {/* Spectral index stats */}
      {siteGeometry && (
        <div className="ee-stats">
          <div className="ee-layer-label" style={{ marginTop: 8 }}>SPECTRAL INDICES</div>
          {statsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 11 }}>
              <div className="loading-spinner" style={{ width: 10, height: 10, borderWidth: 1 }} />
              Computing…
            </div>
          ) : siteStats ? (
            <div className="ee-index-list">
              <div className="ee-index-row">
                <span className="ee-index-name" style={{ color: '#22c55e' }}>NDVI</span>
                <IndexBar value={siteStats.ndvi_mean} color="#22c55e" />
              </div>
              <div className="ee-index-row">
                <span className="ee-index-name" style={{ color: '#06b6d4' }}>NDWI</span>
                <IndexBar value={siteStats.ndwi_mean} color="#06b6d4" />
              </div>
              <div className="ee-index-row">
                <span className="ee-index-name" style={{ color: '#f59e0b' }}>BSI</span>
                <IndexBar value={siteStats.bsi_mean} color="#f59e0b" />
              </div>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {siteStats.scene_count} scenes · {siteStats.date_range.start}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Attribution */}
      <div className="ee-attribution">
        <a
          href="https://earthengine.google.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: 9 }}
        >
          <ExternalLink size={8} /> Powered by Google Earth Engine
        </a>
      </div>
    </div>
  );
}
