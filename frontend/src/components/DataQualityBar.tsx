import type { DataQuality } from '../types/api';

interface DataQualityBarProps {
  quality: DataQuality;
  label?: boolean;
}

const QUALITY_SEGMENTS: Record<DataQuality, number> = {
  high: 4,
  medium: 2,
  low: 1,
  insufficient: 0,
};

const QUALITY_LABELS: Record<DataQuality, string> = {
  high: 'High quality data',
  medium: 'Medium quality data',
  low: 'Low quality data — interpret with caution',
  insufficient: 'Insufficient data',
};

export function DataQualityBar({ quality, label = true }: DataQualityBarProps) {
  const filled = QUALITY_SEGMENTS[quality];

  return (
    <div>
      <div className="data-quality-bar">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`data-quality-segment ${i <= filled ? `filled ${quality}` : ''}`}
          />
        ))}
      </div>
      {label && (
        <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {QUALITY_LABELS[quality]}
        </div>
      )}
    </div>
  );
}
