import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Clock, Layers, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '../utils/api';
import type { Site } from '../types/api';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteAdded: (newSite: Site) => void;
  initialCenter?: [number, number];
  initialGeometry?: any;
  initialAreaHa?: number;
  initialName?: string;
  initialAreaName?: string;
  isGridCell?: boolean;
}

const DURATION_OPTIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
];

export function AddSiteModal({
  isOpen,
  onClose,
  onSiteAdded,
  initialCenter,
  initialGeometry,
  initialAreaHa,
  initialName,
  initialAreaName,
  isGridCell,
}: AddSiteModalProps) {
  const defaultLat = initialCenter ? Number(initialCenter[1].toFixed(5)) : 16.1685;
  const defaultLon = initialCenter ? Number(initialCenter[0].toFixed(5)) : 74.8352;

  const [name, setName] = useState(initialName || '');
  const [areaName, setAreaName] = useState(initialAreaName || 'Gokak Taluk, Belagavi District');
  const [latitude, setLatitude] = useState(defaultLat);
  const [longitude, setLongitude] = useState(defaultLon);
  const [radiusMeters, setRadiusMeters] = useState(1000);
  const [durationMonths, setDurationMonths] = useState(3);
  const [description, setDescription] = useState(
    isGridCell
      ? 'System 1×1 km grid cell under active satellite surveillance.'
      : initialGeometry
      ? 'Custom user-selected area under active satellite surveillance.'
      : 'Continuous remote-sensing surveillance site.',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when props change
  useEffect(() => {
    if (initialName) setName(initialName);
    if (initialAreaName) setAreaName(initialAreaName);
    if (initialCenter) {
      setLatitude(Number(initialCenter[1].toFixed(5)));
      setLongitude(Number(initialCenter[0].toFixed(5)));
    }
    if (isGridCell) {
      setDescription(`1×1 km grid parcel ${initialName || ''} under surveillance.`);
    } else if (initialGeometry) {
      setDescription('Custom user-selected area under active surveillance.');
    }
  }, [initialName, initialAreaName, initialCenter, initialGeometry, isGridCell]);

  if (!isOpen) return null;

  // Compute estimated end date
  const computeEndDate = (months: number) => {
    const d = new Date();
    d.setDate(d.getDate() + months * 30);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the monitoring site.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        area_name: areaName.trim() || 'Belagavi District, Karnataka',
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radiusMeters),
        monitoring_duration_months: Number(durationMonths),
        description: description.trim() || 'Active satellite surveillance site.',
        monitoring_interval_days: 5,
        cloud_threshold: 25.0,
        min_valid_pixels: 75.0,
        risk_threshold: 40,
      };

      if (initialGeometry) {
        payload.geometry = initialGeometry;
      }
      if (initialAreaHa) {
        payload.area_ha = Number(initialAreaHa.toFixed(1));
      }

      const res = await api.post<Site>('/sites', payload);

      onSiteAdded(res.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to create site:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to create monitoring site.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ai-verdict-overlay" onClick={onClose}>
      <div className="ai-verdict-card modal-site-card" onClick={(e) => e.stopPropagation()}>
        <div className="ai-verdict-header">
          <div className="ai-verdict-title">
            <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />
            <span>
              {isGridCell
                ? 'Add 1×1 km Grid Cell to Monitoring'
                : initialGeometry
                ? 'Send Selected Area to Site Monitoring'
                : 'Add Site to Continuous Monitoring'}
            </span>
          </div>
          <button type="button" className="ai-verdict-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Selected Area / Grid Banner */}
        {initialGeometry && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(134, 239, 172, 0.08)',
              border: '1px solid rgba(134, 239, 172, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-primary)',
            }}
          >
            <Layers size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <div>
              <strong>
                {isGridCell
                  ? `Standard 1×1 km Grid Cell (${initialAreaHa ?? 100} ha)`
                  : `Custom Boundary Area (${initialAreaHa ? initialAreaHa.toFixed(1) : '—'} ha)`}
              </strong>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Spatial coordinates and polygon geometry have been captured directly from the map.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div className="compare-ai-error" style={{ position: 'static' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="form-label">Site Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder={isGridCell ? 'e.g. Belagavi Grid Cell BEL-1KM-...' : 'e.g. Ghataprabha Sand Reach Sector'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Area / Taluk Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Gokak Taluk, Belagavi"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">
                {initialGeometry ? 'Approx. Coverage' : 'Surveillance Radius'}
              </label>
              {initialGeometry ? (
                <input
                  type="text"
                  className="form-input"
                  value={`${initialAreaHa ? initialAreaHa.toFixed(1) : 100} hectares`}
                  disabled
                  style={{ opacity: 0.85 }}
                />
              ) : (
                <select
                  className="form-input"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                >
                  <option value={500}>500 meters (Local Parcel)</option>
                  <option value={1000}>1,000 meters (1 km Standard Cell)</option>
                  <option value={2000}>2,000 meters (2 km Basin Reach)</option>
                  <option value={5000}>5,000 meters (5 km Regional Corridor)</option>
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Centroid Latitude (°N)</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="form-label">Centroid Longitude (°E)</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Monitoring Duration */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} style={{ color: 'var(--color-accent)' }} />
              <span>Monitoring Surveillance Window</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  className={`btn-pill-choice ${durationMonths === opt.months ? 'active' : ''}`}
                  onClick={() => setDurationMonths(opt.months)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="site-duration-hint" style={{ marginTop: 8 }}>
              <Calendar size={12} style={{ color: 'var(--color-accent)', marginRight: 4 }} />
              <span>
                Surveillance active until: <strong>{computeEndDate(durationMonths)}</strong> (Sentinel-2 5-day cadence)
              </span>
            </div>
          </div>

          <div>
            <label className="form-label">Surveillance Notes (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Monitored for mechanized sand mining and surface excavation."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="ai-verdict-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering Site…' : 'Start Monitoring This Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
