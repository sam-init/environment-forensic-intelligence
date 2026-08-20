import { useQuery } from '@tanstack/react-query';
import { Plus, MapPin } from 'lucide-react';
import { api } from '../utils/api';
import type { SiteListResponse } from '../types/api';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../utils/format';

export function SitesPage() {
  const { data, isLoading, isError } = useQuery<SiteListResponse>({
    queryKey: ['sites'],
    queryFn: async () => {
      const r = await api.get<SiteListResponse>('/sites');
      return r.data;
    },
  });

  const sites = data?.items ?? [];

  return (
    <div className="app-body">
      <div className="sites-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Monitoring Infrastructure</div>
            <h1 className="page-title">Monitoring Sites</h1>
          </div>
          <button className="btn btn-primary">
            <Plus size={14} />
            Add Site
          </button>
        </div>

        {isLoading && (
          <div className="empty-state" style={{ marginTop: 'var(--space-10)' }}>
            <div className="loading-spinner" />
            <div className="empty-state-title">Loading sites…</div>
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
            body="Add your first monitoring site with an Area of Interest (AOI) to begin satellite analysis."
            icon={<MapPin size={32} strokeWidth={1.5} />}
            action={
              <button className="btn btn-primary">
                <Plus size={14} />
                Add Site
              </button>
            }
          />
        )}

        <div className="sites-grid">
          {sites.map((site) => (
            <div
              key={site.id}
              className={`site-card ${site.is_demo ? 'demo' : ''}`}
            >
              {site.is_demo && (
                <div className="eyebrow" style={{ color: 'var(--color-demo)', marginBottom: 'var(--space-2)' }}>
                  DEMO DATA
                </div>
              )}
              <div className="site-card-name">{site.name}</div>
              <div className="site-card-meta">
                {site.area_ha ? `${site.area_ha.toFixed(1)} ha` : 'Area unknown'} · Added {formatDate(site.created_at)}
              </div>
              <div className="site-card-stats">
                <div className="site-stat">
                  <div className="site-stat-value">{site.monitoring_interval_days}d</div>
                  <div className="site-stat-label">Interval</div>
                </div>
                <div className="site-stat">
                  <div className="site-stat-value">{site.cloud_threshold.toFixed(0)}%</div>
                  <div className="site-stat-label">Cloud limit</div>
                </div>
                <div className="site-stat">
                  <div className="site-stat-value" style={{
                    color: site.monitoring_enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    {site.monitoring_enabled ? 'Active' : 'Paused'}
                  </div>
                  <div className="site-stat-label">Monitoring</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
