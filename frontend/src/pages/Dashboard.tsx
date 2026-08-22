import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import type { ForensicEvent, EventListResponse, SystemStatus } from '../types/api';
import { SignalCard } from '../components/SignalCard';
import { EFIMap } from '../components/EFIMap';
import { EventDetailPanel } from '../components/EventDetailPanel';
import { EmptyState } from '../components/EmptyState';

export function DashboardPage() {
  const [selectedEvent, setSelectedEvent] = useState<ForensicEvent | null>(null);
  const queryClient = useQueryClient();

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
            {status?.sites_monitored ?? 0} sites monitored · Karnataka, India
          </div>
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
              title="Could not load events"
              body="The backend may be starting up. Check that Docker containers are running."
              action={
                <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
                  <RefreshCw size={12} /> Retry
                </button>
              }
            />
          )}

          {!isLoading && !isError && events.length === 0 && (
            <EmptyState
              title="No active signals"
              body="No forensic events detected yet. Add a monitoring site to begin analysis."
            />
          )}

          {events.map((event) => (
            <SignalCard
              key={event.id}
              event={event}
              selected={selectedEvent?.event_id === event.event_id}
              onClick={() => setSelectedEvent(
                selectedEvent?.event_id === event.event_id ? null : event
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
        />

        {/* Layer Control */}
        <div className="map-layer-control">
          <div className="map-layer-title">Layers</div>
          {[
            { color: '#3b7fff', label: 'Monitoring Sites' },
            { color: 'var(--color-critical)', label: 'Critical Events' },
            { color: 'var(--color-high)', label: 'High Risk' },
            { color: 'var(--color-moderate)', label: 'Moderate Risk' },
          ].map(({ color, label }) => (
            <div key={label} className="map-layer-item">
              <div className="map-layer-swatch" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>

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
          background: 'rgba(9,9,11,0.7)',
          padding: '2px var(--space-2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <Layers size={10} />
          OSM · MapLibre GL · EFI Platform v0.1.0
        </div>

        {/* Event Detail Overlay */}
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onReview={(newStatus) => {
              reviewMutation.mutate({ eventId: selectedEvent.event_id, newStatus });
              setSelectedEvent({ ...selectedEvent, status: newStatus as any });
            }}
          />
        )}
      </main>
    </div>
  );
}
