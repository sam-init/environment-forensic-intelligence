import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Clock, Calendar, Trash2, Building2, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import type { SiteListResponse, Site } from '../types/api';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../utils/format';
import { AddSiteModal } from '../components/AddSiteModal';
import { FileComplaintModal } from '../components/FileComplaintModal';

export function SitesPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [complaintSite, setComplaintSite] = useState<Site | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<SiteListResponse>({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await api.get<SiteListResponse>('/sites');
      return r.data;
    },
  });

  const sites = data?.items ?? [];

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!window.confirm(`Are you sure you want to stop monitoring '${siteName}' and remove it?`)) return;
    try {
      await api.delete(`/sites/${siteId}`);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err) {
      console.error('Failed to delete site:', err);
    }
  };

  const handleSiteAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['sites'] });
    refetch();
  };

  return (
    <div className="app-body">
      <div className="sites-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">District Land Surveillance</div>
            <h1 className="page-title">Real Monitored Sites</h1>
          </div>
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={14} />
            <span>Add Site to Monitor</span>
          </button>
        </div>

        {isLoading && (
          <div className="empty-state" style={{ marginTop: 'var(--space-10)' }}>
            <div className="loading-spinner" />
            <div className="empty-state-title">Loading monitored sites…</div>
          </div>
        )}

        {isError && (
          <EmptyState
            title="Could not load sites"
            body="Check that the backend is running and accessible."
          />
        )}

        {!isLoading && !isError && sites.length === 0 && (
          <EmptyState
            title="No monitoring sites configured"
            body="Register your first real land or river reach parcel to begin continuous satellite surveillance."
            icon={<MapPin size={32} strokeWidth={1.5} />}
            action={
              <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
                <Plus size={14} />
                <span>Add Site to Monitor</span>
              </button>
            }
          />
        )}

        <div className="sites-grid">
          {sites.map((site) => (
            <div key={site.id} className="site-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div className="site-card-name" style={{ margin: 0 }}>{site.name}</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleDeleteSite(site.id, site.name)}
                  title="Remove site from monitoring"
                  style={{ color: 'var(--color-text-muted)', padding: '4px' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="site-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <MapPin size={11} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <span>
                  {site.area_name || 'Belagavi District'}
                  {site.latitude && site.longitude ? ` · ${site.latitude.toFixed(4)}°N, ${site.longitude.toFixed(4)}°E` : ''}
                </span>
              </div>

              {site.description && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4, margin: '8px 0' }}>
                  {site.description}
                </div>
              )}

              {/* Monitoring Duration & Timeline Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'rgba(134, 239, 172, 0.08)',
                border: '1px solid rgba(134, 239, 172, 0.22)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--color-text-primary)',
                margin: '8px 0',
              }}>
                <Clock size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <span>
                  Surveillance Duration: <strong>{site.monitoring_duration_months || 3} Months</strong>
                  {site.monitoring_end_date ? ` · Active until ${new Date(site.monitoring_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </span>
              </div>

              <div className="site-card-stats" style={{ marginTop: 8 }}>
                <div className="site-stat">
                  <div className="site-stat-value">{site.area_ha ? `${site.area_ha.toFixed(0)} ha` : '—'}</div>
                  <div className="site-stat-label">Area</div>
                </div>
                <div className="site-stat">
                  <div className="site-stat-value">{site.monitoring_interval_days}d</div>
                  <div className="site-stat-label">Pass Interval</div>
                </div>
                <div className="site-stat">
                  <div className="site-stat-value" style={{
                    color: site.monitoring_enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    {site.monitoring_enabled ? 'Surveillance Active' : 'Paused'}
                  </div>
                  <div className="site-stat-label">Status</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setComplaintSite(site)}
                  style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
                >
                  <Building2 size={12} style={{ marginRight: 4 }} />
                  <span>Request Physical Inspection</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Site Modal */}
      <AddSiteModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSiteAdded={handleSiteAdded}
      />

      {/* File Complaint Modal */}
      {complaintSite && (
        <FileComplaintModal
          isOpen={Boolean(complaintSite)}
          onClose={() => setComplaintSite(null)}
          siteId={complaintSite.id}
          siteName={complaintSite.name}
          areaName={complaintSite.area_name || 'Belagavi District, Karnataka'}
          latitude={complaintSite.latitude || 15.85}
          longitude={complaintSite.longitude || 74.50}
          changeType="Unpermitted Surface Excavation / Mineral Extraction"
          severity="HIGH"
          summaryEvidence={`Autonomous surveillance flagged ground disturbance at ${complaintSite.name}. Requesting physical field visit by KSPCB and Mining Officer to verify boundary coordinates and valid transit permits.`}
        />
      )}
    </div>
  );
}
