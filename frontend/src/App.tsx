import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app-layout">
          <Header />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
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
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
