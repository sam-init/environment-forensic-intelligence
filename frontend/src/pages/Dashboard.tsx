import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Satellite, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import type { ForensicEvent, EventListResponse, SystemStatus, GridTileCollection } from '../types/api';
import { SignalCard } from '../components/SignalCard';
import { EFIMap } from '../components/EFIMap';
import { EventDetailPanel } from '../components/EventDetailPanel';
import { EmptyState } from '../components/EmptyState';
import { EarthEnginePanel, type EELayer, type CompareState } from '../components/EarthEnginePanel';
import { GridPanel } from '../components/GridPanel';

export function DashboardPage() {
  const todayIso = (() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  })();
  const [selectedEvent, setSelectedEvent] = useState<ForensicEvent | null>(null);
  const [activeLayer, setActiveLayer] = useState<EELayer>('true_color');
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);
  const [compareState, setCompareState] = useState<CompareState>({
    active: false,
    beforeDate: '2020-02-15',
    afterDate: todayIso,
    visType: 'true_color',
    beforeTileUrl: null,
    afterTileUrl: null,
  });
  const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number }>({
    center: [74.5, 15.85],
    zoom: 9,
  });
  const [gridTiles, setGridTiles] = useState<GridTileCollection | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ center: [number, number]; zoom: number; nonce: number } | null>(null);
  const queryClient = useQueryClient();

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

  // System status
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const r = await api.get<SystemStatus>('/system/status');
      return r.data;
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // Events list
  const { data: eventsData, isLoading, isError, refetch } = useQuery<EventListResponse>({
    queryKey: ['events'],
    queryFn: async () => {
      const r = await api.get<EventListResponse>('/events');
      return r.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Review mutation
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

  const events = eventsData?.items ?? [];
  const isDemoMode = status?.demo_mode ?? true;
  const eeAvailable = status?.earth_engine_available ?? false;

  // Auto-seed demo data if in demo mode and no events loaded
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

  // Refresh events after demo seed
  useEffect(() => {
    if (demoSeeded) {
      setTimeout(() => refetch(), 500);
    }
  }, [demoSeeded, refetch]);

  const signals = status?.active_signals ?? { critical: 0, high: 0, moderate: 0 };

  // Geometry of selected event (for site-stats call)
  const selectedGeometry = selectedEvent?.geometry ?? null;

  function handleLayerChange(layer: EELayer, tileUrl?: string) {
    setActiveLayer(layer);
    setEeTileUrl(tileUrl ?? null);
  }

  return (
    <div className="app-body">
      {/* ── Intelligence Panel (Left Sidebar) ── */}
      <aside className="intelligence-panel">
        {/* Active Signals */}
        <div className="panel-section">
          <div className="panel-section-title">Active Signals</div>
          <div className="signal-counts">
            <div className="signal-count critical">
              <div className="signal-count-number">{signals.critical.toString().padStart(2, '0')}</div>
              <div className="signal-count-label">Critical</div>
            </div>
            <div className="signal-count high">
              <div className="signal-count-number">{signals.high.toString().padStart(2, '0')}</div>
              <div className="signal-count-label">High</div>
            </div>
            <div className="signal-count moderate">
              <div className="signal-count-number">{signals.moderate.toString().padStart(2, '0')}</div>
              <div className="signal-count-label">Moderate</div>
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {status?.sites_monitored ?? 0} sites monitored · Belagavi, Karnataka
          </div>
          {/* EE status badge */}
          <div style={{
            marginTop: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: eeAvailable ? '#22c55e' : 'var(--color-text-muted)',
          }}>
            <Satellite size={10} />
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
            onClearSelection={() => setSelectedTileId(null)}
          />
        </div>

        {/* Events List */}
        <div className="events-list">
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
              action={
                <button className="btn btn-secondary" onClick={() => refetch()}>
                  <RefreshCw size={14} /> Retry
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
            <SignalCard
              key={event.event_id}
              event={event}
              selected={event.event_id === selectedEvent?.event_id}
              onClick={() => setSelectedEvent(
                event.event_id === selectedEvent?.event_id ? null : event
              )}
            />
          ))}
        </div>
      </aside>

      {/* ── Map + Event Detail ── */}
      <main className="map-container">
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
          onViewCenterChange={(center, zoom) => setMapView({ center, zoom })}
        />

        {/* Attribution notice */}
        <div style={{
          position: 'absolute',
          bottom: 'var(--space-6)',
          left: 'var(--space-4)',
          fontSize: '10px',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          background: 'rgba(9,9,11,0.85)',
          padding: '3px var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.08)',
          zIndex: 10,
        }}>
          OSM · MapLibre GL ·{' '}
          <span style={{ color: '#3b82f6' }}>
            {compareState.active && compareState.highRes
              ? 'Esri World Imagery Wayback (high-res) · GEE analysis'
              : 'Google Earth Engine (Sentinel-2 10m Bicubic)'}
          </span>
          {compareState.active && (
            <span style={{ color: '#f59e0b', marginLeft: 4 }}>[Dual Compare Active]</span>
          )}
          {' · EFI Platform v0.1.0'}
        </div>

        {/* Event Detail Overlay */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onReview={(newStatus) => {
              reviewMutation.mutate({ eventId: selectedEvent.event_id, newStatus });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setSelectedEvent({ ...selectedEvent, status: newStatus as any });
            }}
          />
        )}
      </main>
    </div>
  );
}
