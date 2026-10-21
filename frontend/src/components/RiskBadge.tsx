import type { RiskLevel } from '../types/api';
import { formatRiskLevel } from '../utils/format';

interface RiskBadgeProps {
  level: RiskLevel | null;
  score?: number | null;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, score, size = 'md' }: RiskBadgeProps) {
  if (!level) {
    return (
      <span className="risk-badge low" aria-label="Risk level unknown">
        Unknown
      </span>
    );
  }

  return (
    <span
      className={`risk-badge ${level}${size === 'sm' ? ' sm' : ''}`}
      aria-label={`Risk level: ${formatRiskLevel(level)}${score != null ? `, score ${score}` : ''}`}
    >
      {score != null && (
        <span style={{ opacity: 0.85 }}>{score}</span>
      )}
      {formatRiskLevel(level)}
    </span>
  );
}
