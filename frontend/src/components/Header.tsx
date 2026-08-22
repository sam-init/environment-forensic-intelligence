import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
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
        <div className="header-wordmark">
          Environmental Forensic Intelligence
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
            className="status-dot"
            style={{ background: isOnline ? 'var(--color-success)' : 'var(--color-error)' }}
            title={isOnline ? 'System online' : 'Cannot reach backend'}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </header>
    </>
  );
}
