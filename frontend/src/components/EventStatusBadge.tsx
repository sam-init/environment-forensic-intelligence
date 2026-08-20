import type { EventStatus } from '../types/api';
import { formatEventStatus } from '../utils/format';

interface EventStatusBadgeProps {
  status: EventStatus;
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  return (
    <span className={`event-status ${status}`}>
      <span className="event-status-dot" />
      {formatEventStatus(status)}
    </span>
  );
}
