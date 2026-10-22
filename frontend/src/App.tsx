import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header';
import { LandingPage } from './pages/Landing';
import { DashboardPage } from './pages/Dashboard';
import { SitesPage } from './pages/Sites';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  },
});

/**
 * AppShell — renders the dashboard Header only on non-landing routes.
 * The Landing page has its own fixed Navbar with the EFI brand.
 */
function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return isLanding ? (
    // Landing page: no wrapper, manages its own layout entirely
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ) : (
    // Dashboard/Sites/Events: use existing app-layout + Header
    <div className="app-layout">
      <Header />
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route
          path="/events"
          element={
            <div className="app-body">
              <div className="sites-page">
                <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>Events</div>
                <h1 className="page-title">All Forensic Events</h1>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                  Open the Dashboard to view events on the map and inspect evidence.
                </p>
              </div>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
