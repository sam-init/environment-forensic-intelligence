/**
 * Utility functions for formatting, display labels, and risk UI logic.
 */
import type { EventCategory, EventStatus, RiskLevel } from '../types/api';

export function formatRiskLevel(level: RiskLevel | null): string {
  if (!level) return 'UNKNOWN';
  return level.toUpperCase();
}

export function formatCategory(category: EventCategory): string {
  const map: Record<EventCategory, string> = {
    potential_sand_mining: 'Potential Sand Extraction',
    potential_land_excavation: 'Potential Land Excavation',
    potential_land_filling: 'Potential Land Filling',
    vegetation_loss: 'Vegetation Loss',
    water_body_alteration: 'Water Body Alteration',
    general_disturbance: 'General Disturbance',
    unknown: 'Unknown Disturbance',
  };
  return map[category] ?? category;
}

export function formatEventStatus(status: EventStatus): string {
  const map: Record<EventStatus, string> = {
    unreviewed: 'Unreviewed',
    under_review: 'Under Review',
    confirmed_disturbance: 'Confirmed',
    false_positive: 'False Positive',
    requires_field_verification: 'Field Verification Required',
    closed: 'Closed',
  };
  return map[status] ?? status;
}

export function getRiskColor(level: RiskLevel | null): string {
  const map: Record<RiskLevel, string> = {
    critical: 'var(--color-critical)',
    high: 'var(--color-high)',
    moderate: 'var(--color-moderate)',
    low: 'var(--color-low)',
  };
  return level ? (map[level] ?? 'var(--color-text-muted)') : 'var(--color-text-muted)';
}

export function scoreToRiskLevel(score: number | null): RiskLevel | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

export function formatArea(ha: number | null): string {
  if (ha === null || ha === undefined) return 'N/A';
  if (ha < 1) return `${(ha * 10000).toFixed(0)} m²`;
  return `${ha.toFixed(2)} ha`;
}

export function formatDistance(m: number | null): string {
  if (m === null || m === undefined) return 'Not available';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatConfidence(conf: number | null): string {
  if (conf === null || conf === undefined) return 'N/A';
  return `${Math.round(conf * 100)}%`;
}

export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function getDurationDays(start: string | null, end: string | null): string {
  if (!start || !end) return 'N/A';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Same day';
  if (days === 1) return '1 day';
  return `${days} days`;
}
