import type { RiskLevel } from '../types/api';
import { formatRiskLevel } from '../utils/format';

interface RiskBadgeProps {
  level: RiskLevel | null;
  score?: number | null;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, score, size = 'md' }: RiskBadgeProps) {
  if (!level) return <span className="risk-badge low">Unknown</span>;

  return (
    <span className={`risk-badge ${level} ${size === 'sm' ? 'btn-sm' : ''}`}>
      {score != null && <span>{score}</span>}
      {formatRiskLevel(level)}
    </span>
  );
}
