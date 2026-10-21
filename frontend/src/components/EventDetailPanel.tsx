import { X } from 'lucide-react';
import type { ForensicEvent } from '../types/api';
import { RiskBadge } from './RiskBadge';
import { EventStatusBadge } from './EventStatusBadge';
import { DataQualityBar } from './DataQualityBar';
import {
  formatArea,
  formatDistance,
  formatDate,
  formatConfidence,
  getDurationDays,
  scoreToRiskLevel,
} from '../utils/format';

interface EventDetailPanelProps {
  event: ForensicEvent;
  onClose: () => void;
  onReview?: (status: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  potential_sand_mining: 'POTENTIAL SAND EXTRACTION',
  potential_land_excavation: 'POTENTIAL LAND EXCAVATION',
  potential_land_filling: 'POTENTIAL LAND FILLING / DUMPING',
  vegetation_loss: 'VEGETATION LOSS',
  water_body_alteration: 'WATER BODY ALTERATION',
  general_disturbance: 'GENERAL DISTURBANCE',
  unknown: 'UNKNOWN DISTURBANCE',
};

export function EventDetailPanel({ event, onClose, onReview }: EventDetailPanelProps) {
  const level = event.risk_level ?? scoreToRiskLevel(event.risk_score);
  const explanationLines = parseExplanation(event.explanation);

  return (
    <div className="event-detail-overlay" role="dialog" aria-label={`Event detail: ${event.event_id}`}>
      {/* ── Header ── */}
      <div className="event-detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <div>
            <div className="event-detail-category" style={{ marginBottom: 'var(--space-2)' }}>
              {CATEGORY_LABELS[event.category] ?? event.category.toUpperCase()}
            </div>
            <div className="event-detail-id" style={{ marginBottom: 0 }}>{event.event_id}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close event detail"
            style={{ color: 'var(--color-text-muted)', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>

        {event.is_demo && (
          <div className="eyebrow" style={{ color: 'var(--color-demo)', marginTop: 'var(--space-3)' }}>
            ⚠ DEMO DATA — Not a real incident
          </div>
        )}

        <div className="event-detail-scores" style={{ marginTop: 'var(--space-4)' }}>
          <div>
            <div className={`risk-score-large ${level ?? ''}`}>
              {event.risk_score ?? '—'}
            </div>
            <div className="risk-score-label">/ 100 Risk Score</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {level && <RiskBadge level={level} />}
            <EventStatusBadge status={event.status} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="event-detail-body">

        {/* Metrics */}
        <div className="event-detail-section">
          <div className="event-detail-section-title">Metrics</div>
          <div className="metric-grid">
            <div className="metric-item">
              <div className="metric-label">Area Changed</div>
              <div className="metric-value">{formatArea(event.area_ha)}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Confidence</div>
              <div className={`metric-value ${event.confidence === null ? 'na' : ''}`}>
                {formatConfidence(event.confidence)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">First Observed</div>
              <div className="metric-value" style={{ fontSize: 'var(--text-sm)' }}>
                {formatDate(event.first_observed)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Last Confirmed</div>
              <div className="metric-value" style={{ fontSize: 'var(--text-sm)' }}>
                {formatDate(event.last_observed)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Duration</div>
              <div className="metric-value" style={{ fontSize: 'var(--text-sm)' }}>
                {getDurationDays(event.first_observed, event.last_observed)}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Observations</div>
              <div className="metric-value">{event.observation_count}</div>
            </div>
          </div>
        </div>

        {/* Why flagged */}
        {explanationLines.main.length > 0 && (
          <div className="event-detail-section">
            <div className="event-detail-section-title">Why This Was Flagged</div>
            <ul className="explanation-list">
              {explanationLines.main.map((line, i) => (
                <li key={i} className="explanation-item">{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Regulatory context */}
        <div className="event-detail-section">
          <div className="event-detail-section-title">Regulatory Context</div>
          <div className="regulatory-item">
            <span className="regulatory-label">Mining Lease</span>
            <span className={event.lease_data_available ? 'regulatory-value' : 'regulatory-unavailable'}>
              {event.lease_data_available
                ? (event.inside_mining_lease === true
                    ? 'Inside available boundary'
                    : event.inside_mining_lease === false
                    ? 'Outside available boundary'
                    : 'Boundary check pending')
                : 'Regulatory boundary unavailable'}
            </span>
          </div>
          <div className="regulatory-item">
            <span className="regulatory-label">River Distance</span>
            <span className="regulatory-value">{formatDistance(event.distance_to_river_m)}</span>
          </div>
          <div className="regulatory-item">
            <span className="regulatory-label">Protected Area</span>
            <span className="regulatory-value">{formatDistance(event.distance_to_protected_area_m)}</span>
          </div>
          <div className="regulatory-item">
            <span className="regulatory-label">Road Distance</span>
            <span className="regulatory-value">{formatDistance(event.distance_to_road_m)}</span>
          </div>
        </div>

        {/* Data quality */}
        <div className="event-detail-section">
          <div className="event-detail-section-title">Data Quality</div>
          <DataQualityBar quality="high" />
          {event.limitations && (
            <div className="limitation-notice" style={{ marginTop: 'var(--space-3)' }}>
              <strong style={{ color: 'var(--color-high)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Caution
              </strong>
              <div style={{ marginTop: 'var(--space-1)' }}>{event.limitations}</div>
            </div>
          )}
        </div>

        {/* Recommended actions */}
        {event.recommended_actions && (
          <div className="event-detail-section">
            <div className="event-detail-section-title">Recommended Actions</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-line' }}>
              {event.recommended_actions}
            </div>
          </div>
        )}

        {/* Analyst review */}
        {onReview && (
          <div className="event-detail-section">
            <div className="event-detail-section-title">Analyst Action</div>
            <div className="review-actions">
              <button className="btn btn-secondary btn-block" onClick={() => onReview('under_review')}>
                Mark Under Review
              </button>
              <button className="btn btn-secondary btn-block" onClick={() => onReview('confirmed_disturbance')}>
                Confirm Disturbance
              </button>
              <button className="btn btn-secondary btn-block" onClick={() => onReview('requires_field_verification')}>
                Requires Field Verification
              </button>
              <button className="btn btn-danger btn-block" onClick={() => onReview('false_positive')}>
                Mark as False Positive
              </button>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="disclaimer">
          This system provides remote-sensing intelligence and does not itself constitute a legal
          determination of unauthorized or illegal activity. All outputs require human verification
          before any regulatory action.
        </div>
      </div>
    </div>
  );
}

/** Parse the explanation text into structured bullet points. */
function parseExplanation(text: string | null): { main: string[] } {
  if (!text) return { main: [] };

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('•') || l.startsWith('-') || l.startsWith('+'))
    .map((l) => l.replace(/^[•\-+]\s*/, '').trim())
    .filter((l) => l.length > 0 && !l.includes('DEMO DATA'));

  return { main: lines };
}
