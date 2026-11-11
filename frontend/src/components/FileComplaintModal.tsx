import React, { useState } from 'react';
import { X, Send, ShieldAlert, CheckCircle2, FileText, AlertTriangle, Building2, MapPin } from 'lucide-react';
import { api } from '../utils/api';
import type { Complaint } from '../types/api';

interface FileComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteName: string;
  areaName: string;
  latitude: number;
  longitude: number;
  changeType?: string;
  severity?: string;
  summaryEvidence?: string;
  siteId?: string;
}

export function FileComplaintModal({
  isOpen,
  onClose,
  siteName,
  areaName,
  latitude,
  longitude,
  changeType = 'Unauthorized Riverbed Sand Extraction / Ground Excavation',
  severity = 'HIGH',
  summaryEvidence = 'Deep Siamese ResNet-18 neural detection identified physical excavation disturbance and structural disruption on land. Requesting on-site physical inspection and boundary pegging.',
  siteId,
}: FileComplaintModalProps) {
  const [targetAuthority, setTargetAuthority] = useState(
    'Karnataka State Pollution Control Board (KSPCB) Regional Office & Department of Mines & Geology (DMG), Belagavi',
  );
  const [selectedChangeType, setSelectedChangeType] = useState(changeType);
  const [urgency, setUrgency] = useState('Urgent (Within 72 Hours)');
  const [summary, setSummary] = useState(summaryEvidence);
  const [officerNotes, setOfficerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filedComplaint, setFiledComplaint] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post<Complaint>('/complaints', {
        site_id: siteId,
        site_name: siteName,
        area_name: areaName,
        latitude,
        longitude,
        target_authority: targetAuthority,
        change_type: selectedChangeType,
        severity,
        urgency,
        statutory_violation:
          'Karnataka Minor Mineral Concession Rules 1994 (Rule 31R) & Environment (Protection) Act 1986',
        summary,
        officer_notes: officerNotes,
      });

      setFiledComplaint(res.data);
    } catch (err: any) {
      console.error('Failed to file complaint:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to file inspection complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ai-verdict-overlay" onClick={onClose}>
      <div className="ai-verdict-card modal-complaint-card" onClick={(e) => e.stopPropagation()}>
        <div className="ai-verdict-header">
          <div className="ai-verdict-title">
            <Building2 size={18} style={{ color: '#ef4444' }} />
            <span>File Complaint & Request Physical Field Inspection</span>
          </div>
          <button type="button" className="ai-verdict-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {filedComplaint ? (
          <div className="complaint-success-box">
            <div className="success-icon-wrap">
              <CheckCircle2 size={40} style={{ color: '#10b981' }} />
            </div>
            <div className="success-headline">Inspection Request Officially Dispatched</div>
            <div className="complaint-ref-badge">
              <span>STATUTORY COMPLAINT NUMBER:</span>
              <strong>{filedComplaint.id}</strong>
            </div>

            <div className="complaint-meta-summary">
              <div className="meta-row">
                <span>Target Authority:</span>
                <strong>{filedComplaint.target_authority}</strong>
              </div>
              <div className="meta-row">
                <span>Site Coordinates:</span>
                <strong>{latitude.toFixed(5)}°N, {longitude.toFixed(5)}°E ({areaName})</strong>
              </div>
              <div className="meta-row">
                <span>Urgency Deadline:</span>
                <strong style={{ color: '#ef4444' }}>{filedComplaint.urgency}</strong>
              </div>
              <div className="meta-row">
                <span>Status:</span>
                <strong style={{ color: '#06b6d4' }}>{filedComplaint.status}</strong>
              </div>
            </div>

            <p className="complaint-note">
              This notice has been logged into the Belagavi District Enforcement System. A physical inspection team from the Department of Mines & Geology and KSPCB will be directed to peg perimeter boundaries and verify environmental clearance.
            </p>

            <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div className="compare-ai-error" style={{ position: 'static' }}>
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Target Authority */}
            <div>
              <label className="form-label">Statutory Enforcement Authority</label>
              <select
                className="form-input"
                value={targetAuthority}
                onChange={(e) => setTargetAuthority(e.target.value)}
              >
                <option value="Karnataka State Pollution Control Board (KSPCB) Regional Office & Department of Mines & Geology (DMG), Belagavi">
                  KSPCB Regional Office & District Mines Department, Belagavi
                </option>
                <option value="Deputy Commissioner & District Magistrate, Belagavi (District Task Force on Mining)">
                  Deputy Commissioner & District Magistrate, Belagavi (Mining Task Force)
                </option>
                <option value="Deputy Conservator of Forests (DCF), Belagavi Forest Division">
                  Deputy Conservator of Forests (DCF), Belagavi Division
                </option>
                <option value="Assistant Commissioner & Sub-Divisional Magistrate, Belagavi Sub-Division">
                  Assistant Commissioner & Sub-Divisional Magistrate, Belagavi
                </option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Monitored Land Target</label>
                <div className="complaint-readonly-field">
                  <MapPin size={13} style={{ color: '#06b6d4', flexShrink: 0 }} />
                  <span>{siteName} · {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E</span>
                </div>
              </div>
              <div>
                <label className="form-label">Inspection Urgency</label>
                <select className="form-input" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                  <option value="Immediate (Within 48 hours)">Immediate (Within 48 hours)</option>
                  <option value="Urgent (Within 72 Hours)">Urgent (Within 72 Hours)</option>
                  <option value="Standard (Within 7 Days)">Standard (Within 7 Days)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">Suspected Disturbance Type</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedChangeType}
                  onChange={(e) => setSelectedChangeType(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Detected Risk Severity</label>
                <div className={`complaint-severity-pill ${severity.toLowerCase()}`}>
                  <AlertTriangle size={13} />
                  <span>{severity} SEVERITY LEVEL</span>
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">AI Forensic Evidence & Inspection Directive</label>
              <textarea
                className="form-input"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Additional Instructions / Complainant Notes (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ingress observed via northern village road; request drone volumetric measurement."
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
              />
            </div>

            <div className="ai-verdict-footer" style={{ marginTop: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={isSubmitting}
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
              >
                <Send size={13} style={{ marginRight: 6 }} />
                <span>{isSubmitting ? 'Transmitting Notice…' : 'Dispatch Physical Inspection Notice'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
