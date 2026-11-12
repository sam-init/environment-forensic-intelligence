import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Satellite, RefreshCw, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { api } from '../utils/api';
import type { ForensicEvent, EventListResponse, SystemStatus, GridTileCollection } from '../types/api';
import { SignalCard } from '../components/SignalCard';
import { EFIMap } from '../components/EFIMap';
import { EventDetailPanel } from '../components/EventDetailPanel';
import { EmptyState } from '../components/EmptyState';
import { EarthEnginePanel, type EELayer, type CompareState } from '../components/EarthEnginePanel';
import { GridPanel } from '../components/GridPanel';
import { AddSiteModal } from '../components/AddSiteModal';
import { getCachedTileUrl } from '../utils/tileCache';

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
  // Fast start: initialize from cached GEE tile URLs to eliminate initial load latency
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(() => getCachedTileUrl('true_color'));
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [compareState, setCompareState] = useState<CompareState>(INITIAL_COMPARE_STATE);
  const [mapView, setMapView] = useState(DEFAULT_MAP_VIEW);
  const [gridTiles, setGridTiles] = useState<GridTileCollection | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ center: [number, number]; zoom: number; nonce: number } | null>(null);

  // Site monitoring modal state (triggered by area selection or 1x1 grid cell click)
  const [addSiteModal, setAddSiteModal] = useState<{
    isOpen: boolean;
    initialCenter?: [number, number];
    initialGeometry?: any;
    initialAreaHa?: number;
    initialName?: string;
    initialAreaName?: string;
    isGridCell?: boolean;
  } | null>(null);

  const [siteAddedToast, setSiteAddedToast] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<'active' | 'all' | 'false_positive'>('active');

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
      const res = await api.post(`/events/${eventId}/review`, {
        status: newStatus,
        reviewer: 'analyst',
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      if (selectedEvent && data) {
        setSelectedEvent(data);
      }
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
    // Optimistically update local state immediately
    const updated = { ...selectedEvent, status: newStatus as ForensicEvent['status'] };
    setSelectedEvent(updated);
  }

  // ── Handle Area Selected on Map ──
  const handleAreaSelected = useCallback(
    (area: {
      bbox: [number, number, number, number];
      geometry: any;
      areaHa: number;
      center: [number, number];
    }) => {
      setAddSiteModal({
        isOpen: true,
        initialName: `Monitored Sector (${area.areaHa.toFixed(1)} ha)`,
        initialAreaName: 'Belagavi District, Karnataka',
        initialGeometry: area.geometry,
        initialAreaHa: area.areaHa,
        initialCenter: area.center,
        isGridCell: false,
      });
    },
    [],
  );

  // ── Handle Send 1x1 Grid Cell to Monitoring ──
  const handleSendGridToMonitoring = useCallback(
    (tileId: string) => {
      const feature = gridTiles?.features?.find((f) => f.properties?.tile_id === tileId);
      let centerCoords: [number, number] | undefined = undefined;
      const geom = feature?.geometry;
      if (feature?.geometry && 'coordinates' in feature.geometry) {
        const polyCoords = (feature.geometry as any).coordinates?.[0] as [number, number][] | undefined;
        if (polyCoords && polyCoords.length > 0) {
          const avgLng = polyCoords.reduce((acc: number, c: [number, number]) => acc + c[0], 0) / polyCoords.length;
          const avgLat = polyCoords.reduce((acc: number, c: [number, number]) => acc + c[1], 0) / polyCoords.length;
          centerCoords = [avgLng, avgLat];
        }
      }
      if (!centerCoords) {
        centerCoords = [74.5, 15.85];
      }

      setAddSiteModal({
        isOpen: true,
        initialName: `Belagavi Grid Cell ${tileId}`,
        initialAreaName: 'Belagavi District, Karnataka',
        initialGeometry: geom,
        initialAreaHa: 100.0,
        initialCenter: centerCoords,
        isGridCell: true,
      });
    },
    [gridTiles],
  );

  const handleSiteAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sites'] });
    queryClient.invalidateQueries({ queryKey: ['system-status'] });
    setSiteAddedToast('Site successfully added to continuous monitoring.');
    setTimeout(() => setSiteAddedToast(null), 4500);
  }, [queryClient]);

  // Filtered signals for the left panel
  const activeSignalsCount = useMemo(
    () => events.filter((e) => e.status !== 'false_positive' && e.status !== 'closed').length,
    [events],
  );
  const falsePositivesCount = useMemo(
    () => events.filter((e) => e.status === 'false_positive').length,
    [events],
  );

  const displayedEvents = useMemo(() => {
    if (signalFilter === 'active') {
      return events.filter((e) => e.status !== 'false_positive' && e.status !== 'closed');
    }
    if (signalFilter === 'false_positive') {
      return events.filter((e) => e.status === 'false_positive');
    }
    return events;
  }, [events, signalFilter]);

  return (
    <div className="app-body transition-page-enter">
      {/* ── Intelligence Panel (Left Sidebar) ── */}
      <aside className="intelligence-panel" aria-label="Intelligence signals panel">
        {/* Active Signals Summary */}
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
            <Satellite size={11} aria-hidden="true" />
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
              showLabels={showLabels}
              onToggleLabels={setShowLabels}
              showGrid={showGrid}
              onToggleGrid={setShowGrid}
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
            onSendToMonitoring={handleSendGridToMonitoring}
          />
        </div>

        {/* Signals Filter Tabs */}
        <div className="signals-filter-tabs">
          <button
            type="button"
            className={`signals-filter-tab ${signalFilter === 'active' ? 'active' : ''}`}
            onClick={() => setSignalFilter('active')}
          >
            Active ({activeSignalsCount})
          </button>
          <button
            type="button"
            className={`signals-filter-tab ${signalFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSignalFilter('all')}
          >
            All ({events.length})
          </button>
          {falsePositivesCount > 0 && (
            <button
              type="button"
              className={`signals-filter-tab ${signalFilter === 'false_positive' ? 'active' : ''}`}
              onClick={() => setSignalFilter('false_positive')}
            >
              Cleared ({falsePositivesCount})
            </button>
          )}
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

          {!isLoading && !isError && displayedEvents.length === 0 && (
            <EmptyState
              title={signalFilter === 'active' ? 'No active disturbances' : 'No signals found'}
              body="All monitored sectors in Belagavi are within baseline parameters."
            />
          )}

          {displayedEvents.map((event) => (
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
          onLayerChange={handleLayerChange}
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
          showLabels={showLabels}
          onToggleLabels={setShowLabels}
          showGrid={showGrid}
          onToggleGrid={setShowGrid}
          onAreaSelected={handleAreaSelected}
          onSendGridToMonitoring={handleSendGridToMonitoring}
        />

        {/* Attribution banner */}
        <div className="map-attribution-banner" aria-label="Map data attribution">
          OSM · MapLibre GL ·{' '}
          <span style={{ color: 'var(--color-accent)' }}>
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

        {/* Toast confirmation for site added */}
        {siteAddedToast && (
          <div className="area-select-banner" style={{ top: 70 }}>
            <CheckCircle2 size={15} style={{ color: 'var(--color-accent)' }} />
            <span>{siteAddedToast}</span>
          </div>
        )}

        {/* Event Detail Overlay */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onReview={handleReview}
          />
        )}

        {/* Add Site Modal for Custom Area or 1x1 Grid Cell */}
        {addSiteModal?.isOpen && (
          <AddSiteModal
            isOpen={addSiteModal.isOpen}
            onClose={() => setAddSiteModal(null)}
            onSiteAdded={handleSiteAdded}
            initialCenter={addSiteModal.initialCenter}
            initialGeometry={addSiteModal.initialGeometry}
            initialAreaHa={addSiteModal.initialAreaHa}
            initialName={addSiteModal.initialName}
            initialAreaName={addSiteModal.initialAreaName}
            isGridCell={addSiteModal.isGridCell}
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
