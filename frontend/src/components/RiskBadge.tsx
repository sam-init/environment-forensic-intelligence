import type { RiskLevel } from '../types/api';
import { formatRiskLevel } from '../utils/format';

interface RiskBadgeProps {
  level: RiskLevel | null;
  score?: number | null;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, score, size = 'md' }: RiskBadgeProps) {
  if (!level) return <span className="risk-badge low">Unknown</span>;

  const showDot = level === 'critical' || level === 'high';

  return (
    <span className={`risk-badge ${level} ${size === 'sm' ? 'btn-sm' : ''}`}>
      {showDot && <span className="risk-dot" aria-hidden="true" />}
      {score != null && <span>{score}</span>}
      {formatRiskLevel(level)}
    </span>
  );
}
