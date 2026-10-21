import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Satellite,
  Globe,
  AlertTriangle,
  BarChart3,
  Shield,
  Layers,
  ArrowRight,
  Activity,
  MapPin,
  Eye,
} from 'lucide-react';
import { api } from '../utils/api';
import type { SystemStatus } from '../types/api';

export function LandingPage() {
  const navigate = useNavigate();

  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: async () => {
      const r = await api.get<SystemStatus>('/system/status');
      return r.data;
    },
    staleTime: 30_000,
    retry: false,
  });

  const isOnline = status !== undefined;
  const eeAvailable = status?.earth_engine_available ?? false;
  const totalSignals =
    (status?.active_signals?.critical ?? 0) +
    (status?.active_signals?.high ?? 0) +
    (status?.active_signals?.moderate ?? 0);

  return (
    <div className="landing-page">
      {/* Background layers */}
      <div className="landing-bg" aria-hidden="true" />
      <div className="landing-grid" aria-hidden="true" />

      <div className="landing-content">
        {/* ── Hero Section ── */}
        <section className="hero" id="hero">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Final Year Major Project · Earth Observation Intelligence
          </div>

          <h1 className="hero-title">
            Environmental
            <br />
            <span className="hero-title-accent">Forensic Intelligence</span>
          </h1>

          <p className="hero-subtitle">
            Satellite-powered environmental monitoring using Google Earth Engine and
            Sentinel-2 imagery to detect illegal mining, excavation, and land
            disturbance across Belagavi, Karnataka.
          </p>

          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/dashboard')}
              id="cta-open-dashboard"
            >
              Open Dashboard
              <ArrowRight size={16} />
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => navigate('/sites')}
              id="cta-view-sites"
            >
              View Sites
            </button>
          </div>

          {/* Live stats */}
          <div className="hero-stats" role="region" aria-label="System statistics">
            <div className="hero-stat">
              <div
                className="hero-stat-value"
                style={{ color: totalSignals > 0 ? 'var(--color-high)' : 'var(--color-text-primary)' }}
              >
                {totalSignals.toString().padStart(2, '0')}
              </div>
              <div className="hero-stat-label">Active Signals</div>
            </div>

            <div className="hero-stat">
              <div
                className="hero-stat-value"
                style={{ color: status?.active_signals?.critical ? 'var(--color-critical)' : 'var(--color-text-primary)' }}
              >
                {(status?.active_signals?.critical ?? 0).toString().padStart(2, '0')}
              </div>
              <div className="hero-stat-label">Critical</div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-value">
                {status?.sites_monitored ?? '—'}
              </div>
              <div className="hero-stat-label">Sites Monitored</div>
            </div>

            <div className="hero-stat">
              <div
                className="hero-stat-value"
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: isOnline ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {isOnline ? 'LIVE' : 'OFFLINE'}
              </div>
              <div className="hero-stat-label">System</div>
            </div>

            <div className="hero-stat">
              <div
                className="hero-stat-value"
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: eeAvailable ? 'var(--color-success)' : 'var(--color-text-muted)',
                }}
              >
                {eeAvailable ? 'LIVE' : 'OFF'}
              </div>
              <div className="hero-stat-label">GEE Data</div>
            </div>
          </div>

          {/* Scroll hint */}
          <div className="hero-scroll-hint" aria-hidden="true">
            <div className="hero-scroll-arrow" />
            <span>Scroll to explore</span>
          </div>
        </section>

        {/* ── Feature Cards ── */}
        <section className="features-section" id="features">
          <div className="features-header">
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)', textAlign: 'center' }}>
              Platform Capabilities
            </p>
            <h2 className="features-title">
              Intelligence-grade Earth Observation
            </h2>
            <p className="features-subtitle">
              Multi-spectral satellite analysis powered by Google Earth Engine,
              delivering forensic-quality environmental change detection.
            </p>
          </div>

          <div className="features-grid">
            <FeatureCard
              icon={<Satellite size={20} color="#3b7fff" />}
              iconBg="rgba(59, 127, 255, 0.12)"
              title="Sentinel-2 Imagery"
              description="10-metre resolution multispectral imagery processed through Google Earth Engine bicubic resampling for precise change detection."
            />
            <FeatureCard
              icon={<AlertTriangle size={20} color="#ff9f0a" />}
              iconBg="rgba(255, 159, 10, 0.12)"
              title="Risk Scoring Engine"
              description="Algorithmic risk assessment combining NDVI, BSI, and NDWI indices with proximity to rivers, protected areas, and road networks."
            />
            <FeatureCard
              icon={<Globe size={20} color="#30d158" />}
              iconBg="rgba(48, 209, 88, 0.10)"
              title="Interactive GIS Map"
              description="MapLibre GL-powered interactive map with real-time GEE tile overlays and temporal change comparison mode."
            />
            <FeatureCard
              icon={<BarChart3 size={20} color="#64d2ff" />}
              iconBg="rgba(100, 210, 255, 0.10)"
              title="Spectral Analysis"
              description="NDVI vegetation index, BSI bare soil index, and NDWI water body index tracking over time for forensic evidence."
            />
            <FeatureCard
              icon={<Layers size={20} color="#a855f7" />}
              iconBg="rgba(168, 85, 247, 0.10)"
              title="1 km Processing Grid"
              description="Belagavi district divided into standardised 1 km² review cells for systematic ground-truth verification workflows."
            />
            <FeatureCard
              icon={<Shield size={20} color="#ff3b30" />}
              iconBg="rgba(255, 59, 48, 0.10)"
              title="Regulatory Context"
              description="Cross-reference detection events with mining lease boundaries, protected area buffers, and river setback zones."
            />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          style={{
            padding: 'var(--space-20) var(--space-6)',
            maxWidth: 900,
            margin: '0 auto',
          }}
          id="how-it-works"
        >
          <div className="features-header">
            <p className="eyebrow" style={{ marginBottom: 'var(--space-2)', textAlign: 'center' }}>
              Detection Pipeline
            </p>
            <h2 className="features-title">How It Works</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--space-4)',
            }}
          >
            {[
              {
                step: '01',
                icon: <Satellite size={16} color="#3b7fff" />,
                title: 'Ingest',
                desc: 'Sentinel-2 scenes ingested via Google Earth Engine over Belagavi AOIs',
              },
              {
                step: '02',
                icon: <Eye size={16} color="#a855f7" />,
                title: 'Analyse',
                desc: 'NDVI, BSI, NDWI spectral indices computed per scene and compared to baseline',
              },
              {
                step: '03',
                icon: <Activity size={16} color="#ff9f0a" />,
                title: 'Score',
                desc: 'Risk score 0–100 assigned using weighted signals and proximity features',
              },
              {
                step: '04',
                icon: <MapPin size={16} color="#30d158" />,
                title: 'Alert',
                desc: 'Forensic events generated and surfaced to analysts for review and verification',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  padding: 'var(--space-5)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--color-surface)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-muted)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  (e.currentTarget as HTMLDivElement).style.borderColor = '';
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: 'var(--color-border-muted)',
                    lineHeight: 1,
                    position: 'absolute',
                    top: 'var(--space-3)',
                    right: 'var(--space-4)',
                    userSelect: 'none',
                  }}
                >
                  {item.step}
                </div>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-raised)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {item.icon}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 'var(--leading-relaxed)',
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="cta-section" id="cta">
          <div className="cta-card">
            <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
              Live Intelligence Platform
            </p>
            <h2 className="cta-title">Ready to investigate?</h2>
            <p className="cta-desc">
              Open the dashboard to view real-time forensic signals, explore satellite
              imagery, and review flagged disturbance events across Belagavi district.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/dashboard')}
                id="cta-dashboard-bottom"
              >
                Open Dashboard
                <ArrowRight size={16} />
              </button>
              <button
                className="btn btn-outline btn-lg"
                onClick={() => navigate('/sites')}
                id="cta-sites-bottom"
              >
                Monitoring Sites
              </button>
            </div>

            {status?.demo_mode && (
              <p
                style={{
                  marginTop: 'var(--space-5)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-demo)',
                  letterSpacing: '0.04em',
                  opacity: 0.8,
                }}
              >
                ⚠ Currently running in DEMO MODE — all signals are synthetic demonstration data
              </p>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            padding: 'var(--space-8) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: 4,
              }}
            >
              Environmental Forensic Intelligence
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Final Year Major Project · Earth Observation · Belagavi, Karnataka, India
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Sentinel-2 · ESA Copernicus</span>
            <span>·</span>
            <span>Google Earth Engine</span>
            <span>·</span>
            <span>MapLibre GL</span>
            <span>·</span>
            <span>EFI v0.1.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── Feature Card Sub-component ── */
interface FeatureCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, iconBg, title, description }: FeatureCardProps) {
  return (
    <div className="feature-card">
      <div className="feature-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="feature-title">{title}</div>
      <div className="feature-desc">{description}</div>
    </div>
  );
}
