/**
 * EarthEnginePanel — satellite layer switcher + temporal before-and-after change detection.
 * Fetches real-time GEE tile URLs and injects them into the map.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Satellite,
  Activity,
  BarChart2,
  Layers,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../utils/api';
import type { EEOverview, EECompareResult } from '../types/api';

export type EELayer = 'osm' | 'high_res_imagery' | 'true_color' | 'ndvi' | 'ndwi' | 'bsi';

export interface CompareState {
  active: boolean;
  beforeDate: string;
  afterDate: string;
  visType: EELayer;
  beforeTileUrl: string | null;
  afterTileUrl: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  metrics?: EECompareResult['metrics'];
}

interface EarthEnginePanelProps {
  activeLayer: EELayer;
  onLayerChange: (layer: EELayer, tileUrl?: string) => void;
  siteGeometry?: { type: string; coordinates: unknown[] } | null;
  onCompareChange?: (compareState: CompareState) => void;
}

const LAYER_META: Record<EELayer, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  osm: {
    label: 'Base Map',
    icon: <Layers size={13} />,
    desc: 'OpenStreetMap vector base',
    color: '#6b7280',
  },
  high_res_imagery: {
    label: 'High-Resolution Imagery',
    icon: <Satellite size={13} />,
    desc: 'Detailed aerial/satellite basemap for visual inspection',
    color: '#a855f7',
  },
  true_color: {
    label: 'True Colour',
    icon: <Satellite size={13} />,
    desc: 'Sentinel-2 RGB (B4/B3/B2, 10m bicubic)',
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

export function EarthEnginePanel({
  activeLayer,
  onLayerChange,
  siteGeometry,
  onCompareChange,
}: EarthEnginePanelProps) {
  const [panelTab, setPanelTab] = useState<'live' | 'compare'>('live');
  const [daysBack] = useState(60);

  // Compare mode state
  const [beforeDate, setBeforeDate] = useState('2024-02-15');
  const [afterDate, setAfterDate] = useState('2025-01-15');
  const [compareVis, setCompareVis] = useState<EELayer>('true_color');

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
    enabled: !!siteGeometry && panelTab === 'live',
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Fetch Before & After comparison tiles
  const {
    data: compareData,
    isLoading: compareLoading,
    refetch: refetchCompare,
  } = useQuery<EECompareResult>({
    queryKey: ['ee-compare', beforeDate, afterDate, compareVis, siteGeometry],
    queryFn: async () => {
      if (siteGeometry) {
        const r = await api.post<EECompareResult>('/earth-engine/compare', { geometry: siteGeometry }, {
          params: { before_date: beforeDate, after_date: afterDate, vis_type: compareVis },
        });
        return r.data;
      }
      const r = await api.get<EECompareResult>('/earth-engine/compare', {
        params: { before_date: beforeDate, after_date: afterDate, vis_type: compareVis },
      });
      return r.data;
    },
    enabled: panelTab === 'compare',
    staleTime: 10 * 60_000,
  });

  // Propagate comparison state to parent
  useEffect(() => {
    if (panelTab === 'compare') {
      onCompareChange?.({
        active: true,
        beforeDate,
        afterDate,
        visType: compareVis,
        beforeTileUrl: compareData?.before?.tile_url ?? null,
        afterTileUrl: compareData?.after?.tile_url ?? null,
        beforeLabel: compareData?.before?.scene_date
          ? `BEFORE: ${compareData.before.scene_date} (${compareData.before.cloud_percentage}% cloud)`
          : `BEFORE: ${beforeDate}`,
        afterLabel: compareData?.after?.scene_date
          ? `AFTER: ${compareData.after.scene_date} (${compareData.after.cloud_percentage}% cloud)`
          : `AFTER: ${afterDate}`,
        metrics: compareData?.metrics,
      });
    } else {
      onCompareChange?.({
        active: false,
        beforeDate,
        afterDate,
        visType: compareVis,
        beforeTileUrl: null,
        afterTileUrl: null,
      });
    }
  }, [panelTab, compareData, beforeDate, afterDate, compareVis]);

  function handleLayerSwitch(layer: EELayer) {
    if (layer === 'osm' || layer === 'high_res_imagery') {
      onLayerChange(layer, undefined);
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
        {overviewLoading || compareLoading ? (
          <div className="loading-spinner" style={{ width: 10, height: 10, borderWidth: 1, marginLeft: 'auto' }} />
        ) : (
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto', padding: '2px 4px' }}
            onClick={() => {
              if (panelTab === 'compare') refetchCompare();
              else refetchOverview();
            }}
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="ee-tab-switcher">
        <button
          className={`ee-tab-btn ${panelTab === 'live' ? 'active' : ''}`}
          onClick={() => setPanelTab('live')}
        >
          <Layers size={11} /> Live Layers
        </button>
        <button
          className={`ee-tab-btn ${panelTab === 'compare' ? 'active' : ''}`}
          onClick={() => setPanelTab('compare')}
        >
          <ArrowRightLeft size={11} /> Compare Dates
        </button>
      </div>

      {/* TAB 1: LIVE LAYERS */}
      {panelTab === 'live' && (
        <>
          {overview && (
            <div className="ee-scene-badge">
              <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                {overview.scene_count} scenes · {overview.date_range.start} → {overview.date_range.end}
              </span>
            </div>
          )}

          <div className="ee-layer-label">SATELLITE LAYER</div>
          <div className="ee-layers">
            {(Object.keys(LAYER_META) as EELayer[]).map((layer) => {
              const meta = LAYER_META[layer];
              const isActive = activeLayer === layer;
              const isDisabled = !['osm', 'high_res_imagery'].includes(layer) && !overview?.tiles;

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
        </>
      )}

      {/* TAB 2: TEMPORAL BEFORE / AFTER COMPARISON */}
      {panelTab === 'compare' && (
        <div className="ee-compare-panel">
          <div className="ee-layer-label">TEMPORAL COMPARISON</div>
          <div className="ee-compare-desc">
            Side-by-side Sentinel-2 observation comparison to monitor land mining and sand extraction.
          </div>

          {/* Date Pickers */}
          <div className="ee-date-block">
            <label className="ee-date-label">
              <span className="dot" style={{ background: '#3b82f6' }} /> BEFORE DATE (Baseline)
            </label>
            <div className="ee-date-input-wrap">
              <Calendar size={12} style={{ color: '#3b82f6' }} />
              <input
                type="date"
                className="ee-date-input"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
              />
            </div>
            <div className="ee-date-presets">
              <button
                className={`ee-preset-btn ${beforeDate === '2024-02-15' ? 'active' : ''}`}
                onClick={() => setBeforeDate('2024-02-15')}
              >
                Feb 2024 (1 yr)
              </button>
              <button
                className={`ee-preset-btn ${beforeDate === '2024-08-15' ? 'active' : ''}`}
                onClick={() => setBeforeDate('2024-08-15')}
              >
                Aug 2024 (6 mos)
              </button>
            </div>
            {compareData?.before?.scene_date && (
              <div className="ee-scene-meta">
                Best scene: {compareData.before.scene_date} · {compareData.before.cloud_percentage}% cloud
              </div>
            )}
          </div>

          <div className="ee-date-block" style={{ marginTop: 10 }}>
            <label className="ee-date-label">
              <span className="dot" style={{ background: '#f59e0b' }} /> AFTER DATE (Observation)
            </label>
            <div className="ee-date-input-wrap">
              <Calendar size={12} style={{ color: '#f59e0b' }} />
              <input
                type="date"
                className="ee-date-input"
                value={afterDate}
                onChange={(e) => setAfterDate(e.target.value)}
              />
            </div>
            <div className="ee-date-presets">
              <button
                className={`ee-preset-btn ${afterDate === '2025-01-15' ? 'active' : ''}`}
                onClick={() => setAfterDate('2025-01-15')}
              >
                Jan 2025 (Current)
              </button>
              <button
                className={`ee-preset-btn ${afterDate === '2024-11-15' ? 'active' : ''}`}
                onClick={() => setAfterDate('2024-11-15')}
              >
                Nov 2024
              </button>
            </div>
            {compareData?.after?.scene_date && (
              <div className="ee-scene-meta">
                Best scene: {compareData.after.scene_date} · {compareData.after.cloud_percentage}% cloud
              </div>
            )}
          </div>

          {/* Visualization selector */}
          <div className="ee-layer-label" style={{ marginTop: 12 }}>COMPARISON LAYER</div>
          <div className="ee-vis-toggle">
            <button
              className={`ee-vis-btn ${compareVis === 'true_color' ? 'active' : ''}`}
              onClick={() => setCompareVis('true_color')}
            >
              True Colour
            </button>
            <button
              className={`ee-vis-btn ${compareVis === 'bsi' ? 'active' : ''}`}
              onClick={() => setCompareVis('bsi')}
              title="Bare Soil Index (Excavation)"
            >
              BSI (Mining)
            </button>
            <button
              className={`ee-vis-btn ${compareVis === 'ndvi' ? 'active' : ''}`}
              onClick={() => setCompareVis('ndvi')}
              title="NDVI (Vegetation Loss)"
            >
              NDVI
            </button>
          </div>

          {/* Change Metrics Card */}
          {compareData?.metrics && (compareData.metrics.bsi_delta !== undefined || compareData.metrics.ndvi_delta !== undefined) && (
            <div className="ee-change-card">
              <div className="ee-change-title">
                <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                <span>FORENSIC CHANGE ANALYSIS</span>
              </div>
              {compareData.metrics.bsi_delta !== undefined && (
                <div className="ee-change-row">
                  <span>BSI Bare Soil Delta:</span>
                  <strong style={{ color: (compareData.metrics.bsi_delta ?? 0) > 0 ? '#ef4444' : '#10b981' }}>
                    {(compareData.metrics.bsi_delta ?? 0) > 0 ? '+' : ''}{compareData.metrics.bsi_delta}
                  </strong>
                </div>
              )}
              {compareData.metrics.ndvi_delta !== undefined && (
                <div className="ee-change-row">
                  <span>NDVI Vegetation Delta:</span>
                  <strong style={{ color: (compareData.metrics.ndvi_delta ?? 0) < 0 ? '#ef4444' : '#10b981' }}>
                    {(compareData.metrics.ndvi_delta ?? 0) > 0 ? '+' : ''}{compareData.metrics.ndvi_delta}
                  </strong>
                </div>
              )}
              {compareData.metrics.excavation_signal && (
                <div className="ee-signal-tag excavation">
                  ⚠️ Ground disturbance / excavation increase detected
                </div>
              )}
              {compareData.metrics.vegetation_loss_signal && (
                <div className="ee-signal-tag loss">
                  ⚠️ Vegetation clearing detected
                </div>
              )}
            </div>
          )}
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
          <ExternalLink size={8} /> Powered by Google Earth Engine · 10m bicubic
        </a>
      </div>
    </div>
  );
}
