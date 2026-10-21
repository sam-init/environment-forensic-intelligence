import { useCallback, useRef, useState } from 'react';

/**
 * Interactive before/after evidence panel.
 * Pure CSS terrain visualisation — illustrative, not a live detection.
 */
export function CompareSlider() {
  const [pos, setPos] = useState(54);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = (value: number) => Math.min(92, Math.max(8, value));

  const updateFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={trackRef}
      className="cmp"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* BEFORE — baseline scene */}
      <div className="cmp-pane cmp-before">
        <div className="cmp-terrain cmp-terrain-before" />
        <span className="cmp-coords">15.8503° N&nbsp;&nbsp;74.5128° E</span>
      </div>

      {/* AFTER — observation scene, clipped by the divider */}
      <div className="cmp-pane cmp-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <div className="cmp-terrain cmp-terrain-after" />
        <div className="cmp-scar" />
        <div className="cmp-box">
          <span className="cmp-box-label">CHANGE DETECTED</span>
          <span className="cmp-box-meta">0.84 ha · CONF 0.91</span>
        </div>
        <span className="cmp-coords cmp-coords-right">15.8503° N&nbsp;&nbsp;74.5128° E</span>
      </div>

      {/* Labels */}
      <span className="cmp-label cmp-label-before">BEFORE · 15 FEB 2024</span>
      <span className="cmp-label cmp-label-after">AFTER · 15 JAN 2025</span>

      {/* Divider + handle */}
      <div className="cmp-divider" style={{ left: `${pos}%` }}>
        <div
          className="cmp-handle"
          role="slider"
          tabIndex={0}
          aria-label="Compare before and after satellite observations"
          aria-valuemin={8}
          aria-valuemax={92}
          aria-valuenow={Math.round(pos)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setPos((p) => clamp(p - 4));
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              setPos((p) => clamp(p + 4));
            }
          }}
        >
          <span aria-hidden="true">‹</span>
          <span aria-hidden="true">›</span>
        </div>
      </div>

      {/* Readout */}
      <div className="cmp-footer">
        <div className="cmp-metric">
          <span className="cmp-metric-label">BSI Δ</span>
          <span className="cmp-metric-value cmp-up">+0.184</span>
        </div>
        <div className="cmp-metric">
          <span className="cmp-metric-label">NDVI Δ</span>
          <span className="cmp-metric-value cmp-down">−0.097</span>
        </div>
        <div className="cmp-metric">
          <span className="cmp-metric-label">AREA</span>
          <span className="cmp-metric-value">0.84 ha</span>
        </div>
        <div className="cmp-metric cmp-metric-wide">
          <span className="cmp-metric-label">SIGNAL</span>
          <span className="cmp-metric-value">EXCAVATION</span>
        </div>
      </div>
    </div>
  );
}
