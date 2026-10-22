import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/landing.css';

/* ── SVG Icon helpers ─────────────────────────────────────────── */
function Icon({ d, ...props }: { d: string | string[]; [k: string]: unknown }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS = {
  satellite: 'M12 2L8 6M12 2L16 6M12 2V8M6 12L2 8M6 12L2 16M6 12H12M18 12L22 8M18 12L22 16M18 12H12M12 18L8 22M12 18L16 22M12 18V12',
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0'],
  layers: ['M2 12l10-8 10 8', 'M2 17l10-8 10 8', 'M2 22l10-8 10 8'],
  map: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z M9 4v13 M15 7v13',
  cpu: ['M9 3H7a2 2 0 00-2 2v2M15 3h2a2 2 0 012 2v2M3 9v2M3 13v2M21 9v2M21 13v2M9 21H7a2 2 0 01-2-2v-2M15 21h2a2 2 0 002-2v-2', 'M9 9h6v6H9z'],
  download: 'M12 2v12M8 10l4 4 4-4M2 17l.5 2A2 2 0 004.5 21h15a2 2 0 002-1.5l.5-2.5',
  zap: 'M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2',
  check: 'M20 6L9 17l-5-5',
  search: ['M21 21l-4.35-4.35', 'M17 11A6 6 0 105 11a6 6 0 0012 0'],
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  clock: ['M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0', 'M12 7v5l3 3'],
  shield: 'M12 2l7 4v5c0 5.5-3.5 10-7 12-3.5-2-7-6.5-7-12V6l7-4z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  chevrons: 'M7 4l5 8-5 8M13 4l5 8-5 8',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
};

/* ── Scroll reveal hook ───────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const revealAll = () => {
      document.querySelectorAll('.lp-reveal:not(.visible)').forEach((el) => {
        el.classList.add('visible');
      });
    };

    if (prefersReduced) {
      revealAll();
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      }),
      // generous margin — triggers 100px before element enters viewport
      { threshold: 0.05, rootMargin: '0px 0px 100px 0px' },
    );

    const attach = () => {
      document.querySelectorAll('.lp-reveal').forEach((el) => obs.observe(el));
    };

    attach();

    // Fallback: after 2.5s, reveal anything still hidden
    // (handles edge cases: fast scroll, browser quirks, reduced-motion late detection)
    const fallback = setTimeout(revealAll, 2500);

    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, []);
}

/* ── Navbar ───────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
      <Link to="/" className="lp-nav__brand" aria-label="EFI — Environmental Forensic Intelligence">
        <span className="lp-nav__brand-name">EFI Platform</span>
        <span className="lp-nav__brand-sub">Environmental Forensic Intelligence</span>
      </Link>

      <ul className="lp-nav__links" role="list">
        {[
          { label: 'Overview', id: 'approach' },
          { label: 'How It Works', id: 'workflow' },
          { label: 'Capabilities', id: 'capabilities' },
          { label: 'About', id: 'about' },
        ].map(({ label, id }) => (
          <li key={id}>
            <a href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id); }}>
              {label}
            </a>
          </li>
        ))}
      </ul>

      <div className="lp-nav__actions">
        <button
          className="lp-btn-secondary"
          onClick={() => scrollTo('workflow')}
          style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}
        >
          Methodology
        </button>
        <button
          className="lp-btn-primary"
          onClick={() => navigate('/dashboard')}
          id="nav-explore-cta"
          style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}
        >
          Explore Platform
        </button>
      </div>
    </nav>
  );
}

/* ── Hero Section ─────────────────────────────────────────────── */
function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="lp-hero" aria-label="Hero — EFI platform overview">
      {/* Background image */}
      <div className="lp-hero__bg" aria-hidden="true">
        <img
          src="/images/hero-satellite.jpg"
          alt=""
          className="lp-hero__img"
          width="1920"
          height="1080"
          // eslint-disable-next-line react/no-unknown-property
          {...({ fetchpriority: 'high' } as Record<string, string>)}
        />
        <div className="lp-hero__scrim" />

        {/* Analytical SVG overlay */}
        <div className="lp-hero__overlay">
          <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {/* Bounding box — candidate area */}
            <rect x="680" y="200" width="200" height="130" fill="none"
              stroke="rgba(134,239,172,0.5)" strokeWidth="1" strokeDasharray="8 4" />
            {/* Corner marks */}
            {[[680,200],[878,200],[680,328],[878,328]].map(([x,y],i) => (
              <g key={i}>
                <line x1={x} y1={y} x2={x+(i%2===0?8:-8)} y2={y} stroke="rgba(134,239,172,0.8)" strokeWidth="1.5"/>
                <line x1={x} y1={y} x2={x} y2={y+(i<2?8:-8)} stroke="rgba(134,239,172,0.8)" strokeWidth="1.5"/>
              </g>
            ))}
            {/* Center dot */}
            <circle cx="780" cy="265" r="3" fill="rgba(134,239,172,0.9)">
              <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite"/>
            </circle>
            {/* Leader line to label */}
            <line x1="878" y1="245" x2="930" y2="245" stroke="rgba(134,239,172,0.5)" strokeWidth="1"/>
            <text x="938" y="249" fontFamily="Inter,sans-serif" fontSize="11" fontWeight="600"
              fill="rgba(134,239,172,0.9)" letterSpacing="0.08em">CANDIDATE ZONE</text>
            {/* Grid overlay lines */}
            <line x1="0" y1="350" x2="1200" y2="350" stroke="rgba(134,239,172,0.06)" strokeWidth="1"/>
            <line x1="600" y1="0" x2="600" y2="700" stroke="rgba(134,239,172,0.06)" strokeWidth="1"/>
            {/* Crosshair at river bend */}
            <line x1="390" y1="410" x2="420" y2="410" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
            <line x1="405" y1="397" x2="405" y2="423" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
            <circle cx="405" cy="410" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="lp-hero__content">
        <div className="lp-hero__eyebrow">
          <span className="lp-hero__eyebrow-dot" aria-hidden="true" />
          Earth Observation × Artificial Intelligence
        </div>

        <h1 className="lp-hero__headline">
          Seeing Environmental Damage<br />
          <em>Before It Goes Unnoticed.</em>
        </h1>

        <p className="lp-hero__sub">
          EFI combines satellite imagery, historical land-change analysis and machine
          learning to identify potential environmental disturbances and help prioritize
          locations for further investigation.
        </p>

        <div className="lp-hero__ctas">
          <button
            className="lp-btn-primary lp-btn-lg"
            onClick={() => navigate('/dashboard')}
            id="hero-primary-cta"
          >
            Explore the Platform
            <span className="lp-arrow" aria-hidden="true">→</span>
          </button>
          <button
            className="lp-btn-secondary lp-btn-lg"
            onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
            id="hero-secondary-cta"
          >
            How It Works
          </button>
        </div>
      </div>

      {/* Floating status badge */}
      <div className="lp-hero__badge" aria-label="Platform monitoring status">
        <span className="lp-hero__badge-dot" aria-hidden="true" />
        <span className="lp-hero__badge-text">
          Monitoring <strong>Belagavi District</strong> · Karnataka, India
        </span>
      </div>

      {/* Scroll hint */}
      <div className="lp-hero__scroll" aria-hidden="true">
        <div className="lp-hero__scroll-line" />
        <span className="lp-hero__scroll-label">Scroll</span>
      </div>
    </section>
  );
}

/* ── The Problem Section ──────────────────────────────────────── */
function ProblemSection() {
  return (
    <section className="lp-problem lp-section" id="problem" aria-label="The problem">
      <div className="lp-container">
        <div className="lp-problem__grid">
          {/* Visual */}
          <div className="lp-problem__visual lp-reveal">
            <img
              src="/images/before-satellite.jpg"
              alt="Satellite imagery showing a river and surrounding land — used to illustrate environmental monitoring context"
              className="lp-problem__img"
              loading="lazy"
              width="800"
              height="600"
            />
            <div className="lp-problem__img-overlay" aria-hidden="true" />
            <span className="lp-problem__img-label">Illustrative satellite imagery</span>
          </div>

          {/* Text */}
          <div className="lp-problem__text">
            <div className="lp-eyebrow lp-reveal">The Challenge</div>

            <h2 className="lp-problem__headline lp-reveal lp-reveal-delay-1">
              Environmental Damage Doesn't Wait for an Inspection.
            </h2>

            <ul className="lp-problem__items" role="list">
              {[
                { num: '01', text: 'Large and remote areas are difficult to monitor manually with the frequency required to detect early-stage changes.' },
                { num: '02', text: 'Environmental disturbances may develop between scheduled field inspections, leaving evidence that is hard to reconstruct.' },
                { num: '03', text: 'Comparing historical land conditions consistently across large regions is technically demanding and resource-intensive.' },
                { num: '04', text: 'Investigators need a scalable way to prioritize which locations are most likely to require further on-the-ground attention.' },
              ].map(({ num, text }, i) => (
                <li key={num} className={`lp-problem__item lp-reveal lp-reveal-delay-${i + 1}`} role="listitem">
                  <span className="lp-problem__item-num" aria-hidden="true">{num}</span>
                  <span className="lp-problem__item-text">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── EFI Approach Section ─────────────────────────────────────── */
function ApproachSection() {
  const cards = [
    {
      num: '01',
      icon: ICONS.satellite,
      title: 'Satellite Observation',
      desc: 'Analyze suitable satellite imagery — including Sentinel-2 — across selected regions and dates, processing multi-spectral bands for environmental signals.',
    },
    {
      num: '02',
      icon: ICONS.clock,
      title: 'Temporal Change Analysis',
      desc: 'Compare imagery over time to identify changes in land cover, exposed soil, surface water bodies, and vegetation density using spectral indices.',
    },
    {
      num: '03',
      icon: ICONS.cpu,
      title: 'AI-Assisted Detection',
      desc: 'Apply image-processing and machine-learning techniques to prioritize patterns — areas of high change — that may warrant closer investigation.',
    },
    {
      num: '04',
      icon: ICONS.map,
      title: 'Geospatial Investigation',
      desc: 'Present candidate locations and supporting spectral evidence on an interactive map, enabling analysts to review and prioritize field visits.',
    },
  ];

  return (
    <section className="lp-approach lp-section" id="approach" aria-label="The EFI approach">
      <div className="lp-container">
        <div className="lp-approach__header">
          <div className="lp-eyebrow lp-reveal">The EFI Approach</div>
          <h2 className="lp-approach__headline lp-reveal lp-reveal-delay-1">
            From Satellite Data to Environmental Intelligence.
          </h2>
          <p className="lp-approach__sub lp-reveal lp-reveal-delay-2">
            EFI brings together satellite observation, temporal comparison, geospatial
            analysis and machine learning to surface potentially significant land-surface changes.
          </p>
        </div>

        <div className="lp-approach__cards lp-reveal lp-reveal-delay-2" role="list">
          {cards.map(({ num, icon, title, desc }) => (
            <article key={num} className="lp-approach__card" role="listitem">
              <div className="lp-approach__card-icon" aria-hidden="true">
                <Icon d={icon} />
              </div>
              <div>
                <div className="lp-approach__card-num">{num}</div>
                <div className="lp-approach__card-title">{title}</div>
              </div>
              <p className="lp-approach__card-desc">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works (Workflow) ──────────────────────────────────── */
function WorkflowSection() {
  const steps = [
    { num: '01', icon: ICONS.satellite, title: 'Acquire', desc: 'Collect historical and recent satellite observations over target regions.' },
    { num: '02', icon: ICONS.layers, title: 'Preprocess', desc: 'Apply cloud masking, image alignment and spectral calibration.' },
    { num: '03', icon: ICONS.search, title: 'Analyze', desc: 'Compute spectral indices — NDVI, BSI, NDWI — and compare across dates.' },
    { num: '04', icon: ICONS.zap, title: 'Detect', desc: 'Identify potential disturbances via change analysis and ML models.' },
    { num: '05', icon: ICONS.eye, title: 'Verify', desc: 'Display candidate locations so human reviewers can investigate further.' },
  ];

  return (
    <section className="lp-workflow lp-section" id="workflow" aria-label="How it works — five step workflow">
      <div className="lp-container">
        <div className="lp-workflow__header">
          <div className="lp-eyebrow">How It Works</div>
          <h2 className="lp-workflow__headline">
            A Clear Path from Observation to Verification.
          </h2>
        </div>

        <div className="lp-workflow__steps" role="list">
          {steps.map(({ num, icon, title, desc }, i) => (
            <div
              key={num}
              className={`lp-workflow__step lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)}`}
              role="listitem"
            >
              <div className="lp-workflow__step-bubble" aria-hidden="true">
                <Icon d={icon} />
              </div>
              <div>
                <div className="lp-workflow__step-num">{num}</div>
                <div className="lp-workflow__step-title">{title}</div>
                <p className="lp-workflow__step-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Before / After Comparison Slider ────────────────────────── */
function ComparisonSection() {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onMouseDown = () => { dragging.current = true; };
  const onMouseMove = (e: React.MouseEvent) => { if (dragging.current) updatePosition(e.clientX); };
  const onMouseUp = () => { dragging.current = false; };

  const onTouchMove = (e: React.TouchEvent) => updatePosition(e.touches[0].clientX);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  return (
    <section className="lp-compare lp-section" id="comparison" aria-label="Before and after satellite comparison">
      <div className="lp-container">
        <div className="lp-compare__header">
          <div className="lp-eyebrow">Change Detection</div>
          <h2 className="lp-compare__headline">The Difference Is in the Change.</h2>
          <p className="lp-compare__sub">
            Comparing land-surface conditions across dates reveals patterns that are
            invisible in a single observation. Drag the slider to compare.
          </p>
        </div>

        <div
          ref={sliderRef}
          className="lp-slider lp-reveal"
          role="img"
          aria-label="Interactive before-and-after comparison of satellite imagery showing potential environmental change. Illustrative imagery."
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchMove={onTouchMove}
        >
          {/* Before image — full width */}
          <img
            src="/images/before-satellite.jpg"
            alt="Earlier observation — lush vegetation, full river"
            className="lp-slider__img"
          />

          {/* After image — clipped */}
          <img
            src="/images/after-satellite.jpg"
            alt="Later observation — exposed soil, potential sand extraction"
            className="lp-slider__img lp-slider__img--after"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          />

          {/* Handle */}
          <div
            className="lp-slider__handle"
            style={{ left: `${position}%` }}
            aria-hidden="true"
          >
            <div className="lp-slider__handle-grip">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="16" height="16">
                <path d="M5 4L2 8l3 4M11 4l3 4-3 4" stroke="#0a0d0a" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Labels */}
          <span className="lp-slider__label lp-slider__label--before">Earlier Observation</span>
          <span className="lp-slider__label lp-slider__label--after">Later Observation</span>
        </div>

        <p className="lp-slider__note">
          Illustrative imagery — not a representation of a verified environmental incident.
          Drag the slider to compare the two observations.
        </p>
      </div>
    </section>
  );
}

/* ── Capabilities Section ─────────────────────────────────────── */
function CapabilitiesSection() {
  const caps = [
    { title: 'Sand Mining & Extraction Screening', desc: 'Identify riverbank and land areas showing signals consistent with potential sand and resource extraction.' },
    { title: 'Land-Surface Change Analysis', desc: 'Detect excavation, earthworks and significant changes to surface topography and composition.' },
    { title: 'Waste Dumping Disturbance Screening', desc: 'Flag areas with unusual spectral characteristics that may indicate surface-level waste disposal.' },
    { title: 'Spectral Index Analysis', desc: 'Compute NDVI, BSI and NDWI indices per satellite scene to quantify vegetation, bare soil and water changes.' },
    { title: 'Geospatial Candidate Mapping', desc: 'Display candidate disturbance locations on an interactive MapLibre map with supporting data.' },
    { title: 'Historical Imagery Comparison', desc: 'Compare any two date ranges to understand how land conditions have changed over time.' },
    { title: 'Evidence and Metadata Presentation', desc: 'Present spectral evidence, change metrics, confidence scores and contextual metadata for each candidate.' },
    { title: 'Human Verification Workflow', desc: 'Enable analysts to review, classify and close candidate events through a structured review interface.' },
  ];

  return (
    <section className="lp-capabilities lp-section" id="capabilities" aria-label="Platform capabilities">
      <div className="lp-container">
        <div className="lp-capabilities__layout">
          <div>
            <div className="lp-eyebrow lp-reveal">Capabilities</div>
            <h2 className="lp-capabilities__headline lp-reveal lp-reveal-delay-1">
              Designed for Environmental Investigation.
            </h2>
          </div>

          <div className="lp-capabilities__grid lp-reveal lp-reveal-delay-2" role="list">
            {caps.map(({ title, desc }) => (
              <div key={title} className="lp-cap-item" role="listitem">
                <span className="lp-cap-item__check" aria-hidden="true">
                  <Icon d={ICONS.check} />
                </span>
                <div className="lp-cap-item__text">
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Map Preview Section ──────────────────────────────────────── */
function MapSection() {
  const navigate = useNavigate();

  return (
    <section className="lp-map-section lp-section" id="map" aria-label="Interactive map platform">
      <div className="lp-container">
        <div className="lp-map-section__layout">
          <div className="lp-map-section__text">
            <div className="lp-eyebrow lp-reveal">Interactive Platform</div>
            <h2 className="lp-map-section__headline lp-reveal lp-reveal-delay-1">
              Locate the Changes.<br />Understand the Context.
            </h2>
            <p className="lp-map-section__desc lp-reveal lp-reveal-delay-2">
              The EFI dashboard provides an interactive satellite map of Belagavi District,
              overlaid with candidate disturbance locations and supporting spectral evidence.
              Analysts can explore each flagged area, review imagery, and record their
              verification decisions.
            </p>
            <div className="lp-reveal lp-reveal-delay-3" style={{ marginTop: '0.5rem' }}>
              <button
                className="lp-btn-primary"
                onClick={() => navigate('/dashboard')}
                id="map-explore-cta"
              >
                Open the Map
                <span className="lp-arrow" aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          {/* Illustrated map preview */}
          <div className="lp-map-frame lp-reveal lp-reveal-delay-2">
            <div className="lp-map-placeholder" aria-label="Illustrative map preview showing Belagavi district with candidate markers">
              {/* Animated grid overlay */}
              <div className="lp-map-placeholder__grid" aria-hidden="true" />

              {/* Candidate markers */}
              {[
                { top: '38%', left: '52%' },
                { top: '55%', left: '34%' },
                { top: '28%', left: '68%' },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="lp-map-placeholder__marker"
                  aria-hidden="true"
                  style={{ top: pos.top, left: pos.left, animationDelay: `${i * 0.7}s` }}
                />
              ))}

              {/* Legend */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="lp-map-placeholder__badge">Belagavi District, Karnataka</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.6rem', color: 'rgba(134,239,172,0.8)',
                  fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--efi-lime)', flexShrink: 0 }} aria-hidden="true"/>
                  Candidate disturbance locations (illustrative)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Impact Section ───────────────────────────────────────────── */
function ImpactSection() {
  const items = [
    {
      icon: ICONS.expand,
      title: 'Broader Coverage',
      desc: 'Satellite imagery enables systematic monitoring of large and remote areas that are impractical to inspect manually on a regular basis.',
    },
    {
      icon: ICONS.clock,
      title: 'Earlier Identification',
      desc: 'Frequent temporal comparisons enable earlier identification of potentially concerning land-surface changes before they become harder to attribute.',
    },
    {
      icon: ICONS.search,
      title: 'Smarter Prioritization',
      desc: 'AI-assisted scoring helps investigators focus field resources on locations most likely to require attention, rather than inspecting indiscriminately.',
    },
    {
      icon: ICONS.shield,
      title: 'Evidence-Based Review',
      desc: 'Supporting spectral data and change metrics give investigators objective information to guide their ground-truth verification decisions.',
    },
    {
      icon: ICONS.grid,
      title: 'Scalable Framework',
      desc: 'The methodology is designed to extend to other districts and regions as data availability and computational resources allow.',
    },
    {
      icon: ICONS.layers,
      title: 'Multi-Source Integration',
      desc: 'EFI can incorporate multiple satellite data sources, spectral bands and temporal windows to improve robustness of detection.',
    },
  ];

  return (
    <section className="lp-impact lp-section" id="impact" aria-label="Platform impact and intended benefits">
      <div className="lp-container">
        <div className="lp-impact__header">
          <div className="lp-eyebrow" style={{ justifyContent: 'center' }}>
            <span style={{ width: 24, height: 1, background: 'var(--efi-lime)', flexShrink: 0 }} aria-hidden="true" />
            Intended Impact
          </div>
          <h2 className="lp-impact__headline lp-reveal">
            Better Monitoring. Earlier Investigation.
          </h2>
        </div>

        <div className="lp-impact__grid" role="list">
          {items.map(({ icon, title, desc }, i) => (
            <article
              key={title}
              className={`lp-impact__item lp-reveal lp-reveal-delay-${Math.min(i % 3 + 1, 4)}`}
              role="listitem"
            >
              <div className="lp-impact__item-icon" aria-hidden="true">
                <Icon d={icon} style={{ width: 28, height: 28 }} />
              </div>
              <h3 className="lp-impact__item-title">{title}</h3>
              <p className="lp-impact__item-desc">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── About Section ────────────────────────────────────────────── */
function AboutSection() {
  return (
    <section className="lp-about lp-section" id="about" aria-label="About the EFI project">
      <div className="lp-container">
        <div className="lp-about__layout">
          <div>
            <div className="lp-eyebrow lp-reveal">About the Project</div>
            <h2 className="lp-about__headline lp-reveal lp-reveal-delay-1">
              Environmental Forensic Intelligence
            </h2>
            <p className="lp-about__desc lp-reveal lp-reveal-delay-2">
              EFI is an Artificial Intelligence and Data Science research project focused on
              improving environmental monitoring through the application of satellite imagery
              analysis, geospatial processing and machine learning.
            </p>
            <p className="lp-about__desc lp-reveal lp-reveal-delay-2" style={{ marginTop: '-0.5rem' }}>
              The system is designed as a decision-support tool. It identifies candidate
              locations for human review — not as a replacement for professional investigation,
              legal process, or regulatory authority. All detections require verification
              by qualified personnel before any action is taken.
            </p>
            <div className="lp-about__institution lp-reveal lp-reveal-delay-3">
              <div className="lp-about__inst-name">
                S. G. Balekundri Institute of Technology
              </div>
              <div className="lp-about__inst-dept">
                Department of Artificial Intelligence and Data Science
              </div>
              <div className="lp-about__inst-loc">
                Belagavi, Karnataka, India
              </div>
            </div>
          </div>

          <div className="lp-about__visual lp-reveal lp-reveal-delay-2">
            <img
              src="/images/after-satellite.jpg"
              alt="Satellite imagery illustrating the kind of land-surface changes EFI is designed to analyze"
              loading="lazy"
              width="800"
              height="600"
            />
            <div className="lp-about__visual-overlay" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA Section ────────────────────────────────────────── */
function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="lp-cta lp-section" id="explore" aria-label="Call to action">
      <div className="lp-container">
        <div className="lp-cta__inner">
          <div className="lp-eyebrow lp-reveal" style={{ justifyContent: 'center' }}>
            <span aria-hidden="true" style={{ width: 24, height: 1, background: 'var(--efi-lime)', flexShrink: 0 }} />
            Get Started
          </div>
          <h2 className="lp-cta__headline lp-reveal lp-reveal-delay-1">
            The First Step Toward Better Environmental Intelligence.
          </h2>
          <p className="lp-cta__sub lp-reveal lp-reveal-delay-2">
            Explore how satellite observations and AI-assisted analysis can help identify
            environmental changes that deserve closer attention.
          </p>
          <div className="lp-cta__actions lp-reveal lp-reveal-delay-3">
            <button
              className="lp-btn-primary lp-btn-lg"
              onClick={() => navigate('/dashboard')}
              id="cta-explore-platform"
            >
              Explore EFI
              <span className="lp-arrow" aria-hidden="true">→</span>
            </button>
            <button
              className="lp-btn-secondary lp-btn-lg"
              onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
              id="cta-methodology"
            >
              Understand the Methodology
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────── */
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="lp-footer" aria-label="Site footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div>
            <div className="lp-footer__brand-name">
              Environmental Forensic Intelligence
            </div>
            <p className="lp-footer__brand-desc">
              An AI-powered geospatial research platform for detecting potential
              environmental disturbances using satellite imagery and machine learning.
            </p>
          </div>

          <nav aria-label="Footer platform links">
            <div className="lp-footer__col-title">Platform</div>
            <ul className="lp-footer__links" role="list">
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/sites">Monitoring Sites</Link></li>
              <li><a href="#workflow" onClick={(e)=>{ e.preventDefault(); document.getElementById('workflow')?.scrollIntoView({behavior:'smooth'}); }}>Methodology</a></li>
              <li><a href="#capabilities">Capabilities</a></li>
            </ul>
          </nav>

          <nav aria-label="Footer project links">
            <div className="lp-footer__col-title">Project</div>
            <ul className="lp-footer__links" role="list">
              <li>
                <a href="https://github.com/sam-init/environment-forensic-intelligence"
                  target="_blank" rel="noopener noreferrer">
                  GitHub Repository
                </a>
              </li>
              <li><a href="#about">About</a></li>
              <li><a href="#problem">The Problem</a></li>
            </ul>
          </nav>
        </div>

        <div className="lp-footer__bottom">
          <div className="lp-footer__copy">
            © {year} Environmental Forensic Intelligence. Research project.
          </div>
          <div className="lp-footer__attr">
            Department of AI &amp; Data Science · S.G. Balekundri Institute of Technology<br />
            Belagavi, Karnataka, India
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Main Landing Page ────────────────────────────────────────── */
export function LandingPage() {
  useScrollReveal();

  // global.css sets body { overflow: hidden } for the map layout.
  // Override it for the landing page so the page can scroll.
  useEffect(() => {
    document.body.classList.add('lp-page');
    return () => document.body.classList.remove('lp-page');
  }, []);

  return (
    <div className="lp" id="top">
      {/* Skip-to-content for accessibility */}
      <a
        href="#main-content"
        style={{
          position: 'absolute', top: -100, left: 8, zIndex: 9999,
          background: 'var(--efi-lime)', color: 'var(--efi-black)',
          padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600,
          borderRadius: 4, transition: 'top 0.15s',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLElement).style.top = '8px'; }}
        onBlur={(e) => { (e.currentTarget as HTMLElement).style.top = '-100px'; }}
      >
        Skip to main content
      </a>

      <Navbar />

      <main id="main-content">
        <HeroSection />
        <ProblemSection />
        <ApproachSection />
        <WorkflowSection />
        <ComparisonSection />
        <CapabilitiesSection />
        <MapSection />
        <ImpactSection />
        <AboutSection />
        <CtaSection />
      </main>

      <Footer />
    </div>
  );
}
