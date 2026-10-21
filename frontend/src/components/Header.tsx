import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Satellite } from 'lucide-react';
import { api } from '../utils/api';
import type { SystemStatus } from '../types/api';

export function Header() {
  const location = useLocation();

  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const r = await api.get<SystemStatus>('/system/status');
      return r.data;
    },
    staleTime: 20_000,
    retry: false,
    refetchInterval: 30_000,
  });

  const isDemoMode = status?.demo_mode ?? true;
  const isOnline = status !== undefined;
  const eeAvailable = status?.earth_engine_available ?? false;

  // Hide demo banner on landing page
  const isLanding = location.pathname === '/';

  return (
    <>
      {isDemoMode && !isLanding && (
        <div className="demo-banner" role="alert" aria-live="polite">
          <Activity size={11} aria-hidden="true" />
          <strong>DEMO MODE</strong>
          <span> — All displayed events are synthetic demonstration data. Not real environmental incidents.</span>
        </div>
      )}

      <header className="header" role="banner">
        {/* Wordmark */}
        <NavLink
          to="/"
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}
          aria-label="Environmental Forensic Intelligence — Home"
        >
          <div className="header-wordmark">
            EFI Platform
          </div>
          <div className="header-subtext">India · Earth Observation</div>
        </NavLink>

        <div className="header-divider" aria-hidden="true" />

        <nav className="header-nav" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            id="nav-home"
          >
            Home
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            id="nav-dashboard"
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/sites"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            id="nav-sites"
          >
            Sites
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
            id="nav-events"
          >
            Events
          </NavLink>
        </nav>

        {/* Status indicators */}
        <div className="header-actions">
          {eeAvailable && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                color: 'var(--color-success)',
                background: 'rgba(48, 209, 88, 0.07)',
                border: '1px solid rgba(48, 209, 88, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
              }}
              title="Google Earth Engine is connected"
            >
              <Satellite size={10} aria-hidden="true" />
              GEE Live
            </div>
          )}

          <div
            className="header-status"
            title={isOnline ? 'System online' : 'Cannot reach backend'}
          >
            <div
              className={`status-dot ${isOnline ? 'online' : 'offline'}`}
              role="status"
              aria-label={isOnline ? 'System online' : 'System offline'}
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {isOnline ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
