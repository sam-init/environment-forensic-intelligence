import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Satellite, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import type { ForensicEvent, EventListResponse, SystemStatus, GridTileCollection } from '../types/api';
import { SignalCard } from '../components/SignalCard';
import { EFIMap } from '../components/EFIMap';
import { EventDetailPanel } from '../components/EventDetailPanel';
import { EmptyState } from '../components/EmptyState';
import { EarthEnginePanel, type EELayer, type CompareState } from '../components/EarthEnginePanel';
import { GridPanel } from '../components/GridPanel';

/** Today's date as ISO string (YYYY-MM-DD) */
function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

const INITIAL_COMPARE_STATE: CompareState = {
  active: false,
  beforeDate: '2020-02-15',
  afterDate: todayIso(),
  visType: 'true_color',
  beforeTileUrl: null,
  afterTileUrl: null,
};

const DEFAULT_MAP_VIEW = { center: [74.5, 15.85] as [number, number], zoom: 9 };

export function DashboardPage() {
  const queryClient = useQueryClient();

  const [selectedEvent, setSelectedEvent] = useState<ForensicEvent | null>(null);
  const [activeLayer, setActiveLayer] = useState<EELayer>('true_color');
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);
  const [compareState, setCompareState] = useState<CompareState>(INITIAL_COMPARE_STATE);
  const [mapView, setMapView] = useState(DEFAULT_MAP_VIEW);
  const [gridTiles, setGridTiles] = useState<GridTileCollection | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ center: [number, number]; zoom: number; nonce: number } | null>(null);

  // Stable callbacks — prevent unnecessary child re-renders
  const handleGridTiles = useCallback((tiles: GridTileCollection | null) => {
    setGridTiles(tiles);
  }, []);

  const handleGridFocus = useCallback(() => {
    setGridFocus((prev) => ({
      center: [74.5, 15.85],
      zoom: 9.5,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  const handleClearTileSelection = useCallback(() => setSelectedTileId(null), []);
  const handleMapViewChange = useCallback(
    (center: [number, number], zoom: number) => setMapView({ center, zoom }),
    [],
  );

  // ── Queries ──
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const r = await api.get<SystemStatus>('/system/status');
      return r.data;
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const {
    data: eventsData,
    isLoading,
    isError,
    refetch,
  } = useQuery<EventListResponse>({
    queryKey: ['events'],
    queryFn: async () => {
      const r = await api.get<EventListResponse>('/events');
      return r.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // ── Mutations ──
  const reviewMutation = useMutation({
    mutationFn: async ({ eventId, newStatus }: { eventId: string; newStatus: string }) => {
      await api.post(`/events/${eventId}/review`, {
        status: newStatus,
        reviewer: 'analyst',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const events = useMemo(() => eventsData?.items ?? [], [eventsData]);
  const isDemoMode = status?.demo_mode ?? true;
  const eeAvailable = status?.earth_engine_available ?? false;

  // Auto-seed demo data if in demo mode and no events
  const { data: demoSeeded } = useQuery({
    queryKey: ['demo-seed'],
    queryFn: async () => {
      await api.post('/demo/seed');
      return true;
    },
    enabled: isDemoMode && events.length === 0 && !isLoading && !isError,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (demoSeeded) {
      const timer = setTimeout(() => refetch(), 500);
      return () => clearTimeout(timer);
    }
  }, [demoSeeded, refetch]);

  const signals = status?.active_signals ?? { critical: 0, high: 0, moderate: 0 };
  const selectedGeometry = selectedEvent?.geometry ?? null;

  function handleLayerChange(layer: EELayer, tileUrl?: string) {
    setActiveLayer(layer);
    setEeTileUrl(tileUrl ?? null);
  }

  function handleReview(newStatus: string) {
    if (!selectedEvent) return;
    reviewMutation.mutate({ eventId: selectedEvent.event_id, newStatus });
    // Optimistically update local state
    setSelectedEvent({ ...selectedEvent, status: newStatus as ForensicEvent['status'] });
  }

  return (
    <div className="app-body transition-page-enter">
      {/* ── Intelligence Panel (Left Sidebar) ── */}
      <aside className="intelligence-panel" aria-label="Intelligence signals panel">

        {/* Active Signals */}
        <div className="panel-section">
          <div className="panel-section-title">Active Signals</div>
          <div className="signal-counts">
            <SignalCountBadge count={signals.critical} label="Critical" variant="critical" />
            <SignalCountBadge count={signals.high} label="High" variant="high" />
            <SignalCountBadge count={signals.moderate} label="Moderate" variant="moderate" />
          </div>

          <div
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            {status?.sites_monitored ?? 0} sites monitored · Belagavi, Karnataka
          </div>

          {/* GEE status */}
          <div className={`ee-status-row ${eeAvailable ? 'online' : 'offline'}`}>
            <Satellite size={10} aria-hidden="true" />
            {eeAvailable ? 'GEE Live Data (10m Bicubic)' : 'GEE Offline'}
          </div>
        </div>

        {/* Earth Engine Layer & Comparison Panel */}
        {eeAvailable && (
          <div className="panel-section" style={{ paddingTop: 0 }}>
            <EarthEnginePanel
              activeLayer={activeLayer}
              onLayerChange={handleLayerChange}
              siteGeometry={selectedGeometry}
              onCompareChange={setCompareState}
              viewCenter={mapView.center}
            />
          </div>
        )}

        {/* Belagavi 1 km review grid */}
        <div className="panel-section" style={{ paddingTop: 0 }}>
          <GridPanel
            onTilesLoaded={handleGridTiles}
            onFocus={handleGridFocus}
            selectedTileId={selectedTileId}
            onClearSelection={handleClearTileSelection}
          />
        </div>

        {/* Events List */}
        <div className="events-list" role="list" aria-label="Forensic events">
          {isLoading && (
            <div className="empty-state">
              <div className="loading-spinner" />
              <div className="empty-state-title">Loading signals…</div>
            </div>
          )}

          {isError && (
            <EmptyState
              title="Unable to load signals"
              body="Could not connect to the EFI backend. Please verify the service is running."
              icon={<AlertTriangle size={28} strokeWidth={1.5} />}
              action={
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => refetch()}
                  id="retry-load-events"
                >
                  <RefreshCw size={13} /> Retry
                </button>
              }
            />
          )}

          {!isLoading && !isError && events.length === 0 && (
            <EmptyState
              title="No active signals"
              body="All monitored sites in Belagavi are within baseline parameters."
            />
          )}

          {events.map((event) => (
            <div role="listitem" key={event.event_id}>
              <SignalCard
                event={event}
                selected={event.event_id === selectedEvent?.event_id}
                onClick={() =>
                  setSelectedEvent(
                    event.event_id === selectedEvent?.event_id ? null : event,
                  )
                }
              />
            </div>
          ))}
        </div>
      </aside>

      {/* ── Map + Event Detail ── */}
      <main className="map-container" aria-label="Satellite imagery map">
        <EFIMap
          events={events}
          selectedEventId={selectedEvent?.event_id ?? null}
          onEventSelect={setSelectedEvent}
          center={mapView.center}
          zoom={mapView.zoom}
          activeLayer={activeLayer}
          eeTileUrl={eeTileUrl}
          compareMode={compareState.active}
          beforeTileUrl={compareState.beforeTileUrl}
          afterTileUrl={compareState.afterTileUrl}
          beforeLabel={compareState.beforeLabel}
          afterLabel={compareState.afterLabel}
          beforeAttribution={compareState.beforeAttribution}
          afterAttribution={compareState.afterAttribution}
          gridTiles={gridTiles}
          selectedTileId={selectedTileId}
          onTileSelect={setSelectedTileId}
          focus={gridFocus}
          onViewCenterChange={handleMapViewChange}
        />

        {/* Attribution */}
        <div className="map-attribution-banner" aria-label="Map data attribution">
          OSM · MapLibre GL ·{' '}
          <span style={{ color: '#3b82f6' }}>
            {compareState.active && compareState.highRes
              ? 'Esri World Imagery Wayback · GEE analysis'
              : 'GEE Sentinel-2 10m Bicubic'}
          </span>
          {compareState.active && (
            <span style={{ color: 'var(--color-warning)', marginLeft: 4 }}>
              [Compare Active]
            </span>
          )}
          {' · EFI v0.1.0'}
        </div>

        {/* Event Detail Overlay */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onReview={handleReview}
          />
        )}
      </main>
    </div>
  );
}

/* ── Signal Count Badge ── */
interface SignalCountBadgeProps {
  count: number;
  label: string;
  variant: 'critical' | 'high' | 'moderate';
}

function SignalCountBadge({ count, label, variant }: SignalCountBadgeProps) {
  return (
    <div
      className={`signal-count ${variant}`}
      role="status"
      aria-label={`${count} ${label} signals`}
    >
      <div className="signal-count-number">
        {count.toString().padStart(2, '0')}
      </div>
      <div className="signal-count-label">{label}</div>
    </div>
  );
}
