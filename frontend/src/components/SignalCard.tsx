import type { ForensicEvent } from '../types/api';
import { RiskBadge } from './RiskBadge';
import { EventStatusBadge } from './EventStatusBadge';
import { formatCategory, formatArea, formatShortDate, scoreToRiskLevel } from '../utils/format';

interface SignalCardProps {
  event: ForensicEvent;
  selected?: boolean;
  onClick: () => void;
}

export function SignalCard({ event, selected, onClick }: SignalCardProps) {
  const level = event.risk_level ?? scoreToRiskLevel(event.risk_score);

  return (
    <div
      className={`signal-card risk-${level} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Event ${event.event_id}: ${formatCategory(event.category)}`}
      aria-pressed={selected}
    >
      <div className="signal-card-header">
        <span className="signal-card-id">{event.event_id}</span>
        <RiskBadge level={level} score={event.risk_score} size="sm" />
      </div>

      <div className="signal-card-category">{formatCategory(event.category)}</div>

      <div className="signal-card-meta">
        <span>{formatArea(event.area_ha)}</span>
        <span>·</span>
        <span>{event.observation_count} obs.</span>
        {event.last_observed && (
          <>
            <span>·</span>
            <span>Last: {formatShortDate(event.last_observed)}</span>
          </>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-2)' }}>
        <EventStatusBadge status={event.status} />
      </div>

      {event.is_demo && (
        <div className="eyebrow" style={{ marginTop: 'var(--space-2)', color: 'var(--color-demo)' }}>
          DEMO
        </div>
      )}
    </div>
  );
}
