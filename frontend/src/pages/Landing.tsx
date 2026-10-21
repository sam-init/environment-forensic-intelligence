import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Crosshair,
  Layers,
  Menu,
  Mountain,
  MoveHorizontal,
  Radar,
  Satellite,
  ScanSearch,
  ShieldCheck,
  Trees,
  Waves,
  X,
} from 'lucide-react';
import { OrbitalCanvas } from '../components/landing/OrbitalCanvas';
import { CompareSlider } from '../components/landing/CompareSlider';
import { Reveal } from '../components/landing/Reveal';
import '../styles/landing.css';

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#evidence', label: 'Evidence' },
];

const FEATURES = [
  {
    tag: 'TEMPORAL',
    icon: Radar,
    title: 'Two dates, one truth',
    body: 'Every site is re-observed on a fixed cadence. Baseline and observation scenes are paired, normalised and differenced.',
  },
  {
    tag: 'SPECTRAL',
    icon: ScanSearch,
    title: 'Indices that isolate change',
    body: 'NDVI, NDWI and BSI separate vegetation loss, water alteration and fresh bare soil from seasonal noise.',
  },
  {
    tag: 'ACCOUNTABLE',
    icon: ShieldCheck,
    title: 'Human in the loop',
    body: 'Machine signals become analyst decisions. Nothing is escalated automatically — every event carries its evidence.',
  },
];

const CAPABILITIES = [
  {
    num: '01',
    icon: Waves,
    title: 'Sand extraction',
    body: 'Riverbed and floodplain excavation signatures, tracked against seasonal flow and sanctioned lease boundaries.',
  },
  {
    num: '02',
    icon: Mountain,
    title: 'Land excavation',
    body: 'New bare-soil scars, quarry expansion and cut-slope activity detected across consecutive observations.',
  },
  {
    num: '03',
    icon: Layers,
    title: 'Land filling',
    body: 'Dumped material, reclamation anomalies and sudden surface elevation proxies flagged for field inspection.',
  },
  {
    num: '04',
    icon: Trees,
    title: 'Vegetation loss',
    body: 'Canopy clearing and land-cover conversion measured as a sustained negative NDVI trajectory.',
  },
];

const PIPELINE = [
  {
    num: '01',
    title: 'Observe',
    body: 'Sentinel-2 scenes are acquired over each area of interest, filtered for cloud cover and geometry.',
  },
  {
    num: '02',
    title: 'Compare',
    body: 'Before and after observations are co-registered and reduced to spectral index deltas.',
  },
  {
    num: '03',
    title: 'Detect',
    body: 'Thresholds and a change model convert deltas into risk-scored environmental signals.',
  },
  {
    num: '04',
    title: 'Review',
    body: 'Analysts confirm, dismiss or escalate. Confirmed cases route to field verification.',
  },
];

const RISK_LEVELS = [
  { label: 'Critical', range: '80 – 100', pct: 100, tone: 'critical' },
  { label: 'High', range: '60 – 79', pct: 76, tone: 'high' },
  { label: 'Moderate', range: '40 – 59', pct: 52, tone: 'moderate' },
  { label: 'Low', range: '0 – 39', pct: 28, tone: 'low' },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Support deep links like /#evidence — the scroll container is not the document.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const container = target.closest('.landing') as HTMLElement | null;
      if (!container) return;
      const offset =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        90;
      container.scrollTop = Math.max(0, offset);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="landing">
      {/* ── Navigation ── */}
      <header className="landing-nav">
        <Link to="/" className="landing-logo" aria-label="EFI home">
          <span className="landing-logo-mark">EFI</span>
          <span className="landing-logo-sub">
            Environmental
            <br />
            Forensic Intelligence
          </span>
        </Link>

        <nav className={`landing-links ${menuOpen ? 'is-open' : ''}`} aria-label="Landing navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link to="/dashboard" className="landing-nav-cta" onClick={() => setMenuOpen(false)}>
            Open Console <ArrowUpRight size={13} />
          </Link>
        </nav>

        <div className="landing-nav-meta">
          <span className="landing-demo-pill">DEMO ENVIRONMENT</span>
          <Link to="/dashboard" className="landing-nav-cta landing-nav-cta-desktop">
            Open Console <ArrowUpRight size={13} />
          </Link>
          <button
            type="button"
            className="landing-menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <OrbitalCanvas />

        <div className="hero-hud hero-hud-tl">
          <Crosshair size={11} />
          <span>LAT 15.8497° N / LON 74.4977° E</span>
        </div>
        <div className="hero-hud hero-hud-tr">
          <span className="hud-dot" />
          <span>GROUND SEGMENT / NOMINAL</span>
        </div>
        <div className="hero-hud hero-hud-bl">
          <span>S2B_MSIL2A · 2025-01-15 · CLOUD 4.2%</span>
        </div>
        <div className="hero-hud hero-hud-br">
          <span>SECTOR / BELAGAVI · KARNATAKA · IN</span>
        </div>

        <div className="hero-inner">
          <span className="hero-eyebrow">
            <Satellite size={12} />
            Satellite forensics · India Earth observation
          </span>

          <h1 className="hero-title">
            <span>Environmental</span>
            <span className="hero-title-accent">Forensic</span>
            <span>Intelligence</span>
          </h1>

          <p className="hero-sub">
            Detecting illegal sand mining, land excavation and waste dumping from orbit —
            comparing satellite observations over time and surfacing the changes that
            demand investigation.
          </p>

          <div className="hero-actions">
            <Link to="/dashboard" className="btn-hero btn-hero-primary">
              Initiate System <ArrowRight size={15} />
            </Link>
            <a href="#capabilities" className="btn-hero btn-hero-ghost">
              View Capabilities
            </a>
          </div>

          <div className="hero-meta">
            <span>10 m Sentinel-2</span>
            <span className="meta-sep" />
            <span>NDVI · NDWI · BSI</span>
            <span className="meta-sep" />
            <span>Google Earth Engine</span>
          </div>
        </div>

        <a href="#platform" className="hero-scroll" aria-label="Scroll to platform section">
          <ChevronDown size={14} />
          <span>Scroll to analyse</span>
        </a>
      </section>

      {/* ── Ticker ── */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <div className="ticker-group" key={copy}>
              {[
                'Illegal sand mining',
                'Land excavation',
                'Land filling',
                'Waste dumping',
                'Vegetation loss',
                'Water body alteration',
                'Quarry expansion',
                'Field verification',
              ].map((item) => (
                <span className="ticker-item" key={item}>
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Platform ── */}
      <section className="landing-section" id="platform">
        <Reveal>
          <div className="section-head">
            <span className="section-num">01 / PLATFORM</span>
            <div>
              <h2 className="section-title">
                A forensic record of the ground,
                <br />
                built from orbit.
              </h2>
              <p className="section-lede">
                EFI watches designated regions of India through repeated satellite passes.
                Where the surface changes in ways that match known violation patterns, it
                produces a scored, reviewable signal — with the imagery, indices and
                regulatory context attached.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="feature-grid">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.tag} delay={i * 90} className="feature-cell">
                <div className="feature">
                  <div className="feature-head">
                    <Icon size={18} className="feature-icon" />
                    <span className="feature-tag">{feature.tag}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="landing-section" id="capabilities">
        <Reveal>
          <div className="section-head">
            <span className="section-num">02 / CAPABILITIES</span>
            <div>
              <h2 className="section-title">What we look for.</h2>
              <p className="section-lede">
                Four disturbance classes, each with its own spectral fingerprint and
                regulatory context. Every detection is a lead, never a verdict.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="cap-grid">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <Reveal key={cap.num} delay={i * 70}>
                <article className="cap-card">
                  <span className="cap-num">{cap.num}</span>
                  <Icon size={22} className="cap-icon" />
                  <h3>{cap.title}</h3>
                  <p>{cap.body}</p>
                  <span className="cap-line" />
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section className="landing-section landing-section-wide" id="pipeline">
        <Reveal>
          <div className="section-head">
            <span className="section-num">03 / PIPELINE</span>
            <div>
              <h2 className="section-title">From pass to probable cause.</h2>
              <p className="section-lede">
                A deterministic chain of custody: scene acquisition, temporal differencing,
                signal scoring and analyst review.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="pipeline">
          {PIPELINE.map((step, i) => (
            <Reveal key={step.num} delay={i * 80}>
              <div className="step">
                <span className="step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Evidence engine ── */}
      <section className="landing-section evidence-section" id="evidence">
        <div className="evidence-grid">
          <Reveal className="evidence-visual">
            <div className="evidence-head">
              <span className="section-num">04 / EVIDENCE ENGINE</span>
              <span className="evidence-hint">
                <MoveHorizontal size={12} /> Drag to compare
              </span>
            </div>
            <CompareSlider />
            <p className="evidence-note">
              Illustrative visualisation of the comparison workflow — not a live detection.
            </p>
          </Reveal>

          <Reveal delay={120} className="evidence-copy">
            <h2 className="section-title">Two dates. One difference that matters.</h2>
            <p className="section-lede">
              Place a site under temporal comparison and the platform returns a paired
              observation, index deltas and the geometry of the changed area — the raw
              material for an analyst's judgement.
            </p>

            <ul className="evidence-list">
              <li>
                <span className="evidence-key">Temporal pair</span>
                <span className="evidence-value">2024-02-15 → 2025-01-15</span>
              </li>
              <li>
                <span className="evidence-key">Indices</span>
                <span className="evidence-value">NDVI · NDWI · BSI</span>
              </li>
              <li>
                <span className="evidence-key">Output</span>
                <span className="evidence-value">GeoJSON polygon · confidence</span>
              </li>
              <li>
                <span className="evidence-key">Disposition</span>
                <span className="evidence-value">Analyst review required</span>
              </li>
            </ul>

            <Link to="/dashboard" className="btn-hero btn-hero-primary evidence-btn">
              Inspect Live Signals <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Risk scale ── */}
      <section className="landing-section risk-section">
        <div className="risk-grid">
          <Reveal>
            <span className="section-num">05 / SIGNAL SEVERITY</span>
            <h2 className="section-title">Scored, ranked, explainable.</h2>
            <p className="section-lede">
              Each signal carries a 0–100 risk score derived from change magnitude, area,
              proximity to water and protected land, and confidence in the observation.
              The scale is visible, not opaque.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="risk-list">
              {RISK_LEVELS.map((level) => (
                <div className={`risk-row tone-${level.tone}`} key={level.label}>
                  <span className="risk-name">{level.label}</span>
                  <span className="risk-track">
                    <span className="risk-fill" style={{ width: `${level.pct}%` }} />
                  </span>
                  <span className="risk-range">{level.range}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-cta" id="access">
        <div className="landing-cta-glow" aria-hidden="true" />
        <Reveal>
          <span className="section-num">06 / ACCESS</span>
          <h2 className="landing-cta-title">Enter the command center</h2>
          <p className="landing-cta-sub">
            Signal counts, satellite layers, comparison tools and the review queue —
            all in one console.
          </p>
          <div className="hero-actions">
            <Link to="/dashboard" className="btn-hero btn-hero-primary">
              Initiate System <ArrowRight size={15} />
            </Link>
            <Link to="/sites" className="btn-hero btn-hero-ghost">
              Monitoring Sites
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="landing-logo-mark">EFI</span>
            <p>
              Environmental Forensic Intelligence — a remote-sensing intelligence platform
              for environmental disturbance detection.
            </p>
          </div>

          <div className="footer-col">
            <span className="footer-title">Console</span>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/sites">Sites</Link>
            <Link to="/events">Events</Link>
          </div>

          <div className="footer-col">
            <span className="footer-title">Data</span>
            <span>Sentinel-2 L2A</span>
            <span>Google Earth Engine</span>
            <span>OpenStreetMap</span>
          </div>

          <div className="footer-col">
            <span className="footer-title">Build</span>
            <span>EFI Platform v0.1.0</span>
            <span>Demo environment</span>
            <span>Synthetic sample data</span>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            This system provides remote-sensing intelligence and does not itself constitute a
            legal determination of unauthorized or illegal activity. All outputs require human
            verification before any regulatory action.
          </p>
          <span className="footer-mark">EFI / 2026</span>
        </div>
      </footer>
    </div>
  );
}
