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
          <div className="header-subtext">Environmental Forensic Intelligence</div>
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
                fontSize: 11,
                color: 'var(--color-accent)',
                background: 'rgba(134, 239, 172, 0.08)',
                border: '1px solid rgba(134, 239, 172, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontWeight: 500,
              }}
              title="Google Earth Engine is connected (Sentinel-2 10m)"
            >
              <Satellite size={11} aria-hidden="true" />
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
