import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header';
import { DashboardPage } from './pages/Dashboard';
import { SitesPage } from './pages/Sites';
import { LandingPage } from './pages/Landing';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  },
});

/** Console shell — persistent header around every application page. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Header />
      {children}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <Shell>
                <DashboardPage />
              </Shell>
            }
          />
          <Route
            path="/sites"
            element={
              <Shell>
                <SitesPage />
              </Shell>
            }
          />
          <Route
            path="/events"
            element={
              <Shell>
                <div className="app-body">
                  <div className="sites-page">
                    <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>Events</div>
                    <h1 className="page-title">All Forensic Events</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                      Open the Dashboard to view events on the map and inspect evidence.
                    </p>
                  </div>
                </div>
              </Shell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
