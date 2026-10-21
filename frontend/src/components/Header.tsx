import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Satellite } from 'lucide-react';
import { api } from '../utils/api';
import type { SystemStatus } from '../types/api';

export function Header() {
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const r = await api.get<SystemStatus>('/system/status');
      return r.data;
    },
    staleTime: 20_000,
    retry: false,
  });

  const isDemoMode = status?.demo_mode ?? true;
  const isOnline = status !== undefined;
  const geeOnline = status?.earth_engine_available ?? false;

  return (
    <>
      {isDemoMode && (
        <div className="demo-banner" role="alert">
          <Activity size={12} />
          DEMO MODE — All displayed events are synthetic demonstration data.
          <span>Not real environmental incidents. Not for regulatory use.</span>
        </div>
      )}

      <header className="header">
        <div className="header-brand">
          <div className="header-wordmark">EFI</div>
          <div className="header-brand-subtitle">Environmental Forensic Intelligence</div>
        </div>
        <div className="header-subtext">India · Earth Observation</div>
        <div className="header-divider" />

        <nav className="header-nav" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/sites"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            Sites
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            Events
          </NavLink>
        </nav>

        <div className="header-status">
          <div
            className="header-gee-status"
            title={geeOnline ? 'Google Earth Engine online' : 'Google Earth Engine offline'}
          >
            <Satellite size={12} />
            <span className="header-status-label">GEE {geeOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="header-divider" />
          <div
            className="status-dot"
            style={{ background: isOnline ? 'var(--color-accent)' : 'var(--color-error)' }}
            title={isOnline ? 'System online' : 'Cannot reach backend'}
          />
          <span className="header-status-label">
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </header>
    </>
  );
}
