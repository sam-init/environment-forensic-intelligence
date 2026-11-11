import React from 'react';
import { X, Download, Printer, ShieldAlert, Sparkles, Building2, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import type { ForensicReport } from '../types/api';

interface ForensicReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ForensicReport | null;
  onFileComplaint?: () => void;
}

export function ForensicReportModal({ isOpen, onClose, report, onFileComplaint }: ForensicReportModalProps) {
  if (!isOpen || !report) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="ai-verdict-overlay" onClick={onClose}>
      <div className="ai-verdict-card modal-report-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Controls (Hidden in Print) */}
        <div className="report-modal-controls no-print">
          <div className="report-controls-left">
            <span className="report-badge-top">
              <Sparkles size={13} style={{ color: '#06b6d4', marginRight: 4 }} />
              NVIDIA NIM 90B Vision + Siamese ResNet-18
            </span>
          </div>
          <div className="report-controls-right">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={13} style={{ marginRight: 5 }} />
              <span>Print</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Download size={13} style={{ marginRight: 5 }} />
              <span>Download PDF</span>
            </button>
            <button type="button" className="ai-verdict-close" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Official Forensic Report Container */}
        <div className="printable-report-body" id="forensic-printable-area">
          {/* Header */}
          <div className="report-doc-header">
            <div className="report-gov-crest">
              <Building2 size={28} style={{ color: '#06b6d4' }} />
            </div>
            <div className="report-gov-titles">
              <div className="report-state-title">GOVERNMENT OF KARNATAKA · DISTRICT ADMINISTRATION BELAGAVI</div>
              <div className="report-dept-title">ENVIRONMENTAL FORENSIC INTELLIGENCE UNIT (EFI)</div>
              <div className="report-sub-title">STATUTORY LAND CHANGE AUDIT & PHYSICAL INSPECTION DOCKET</div>
            </div>
            <div className="report-ref-box">
              <div className="ref-label">DOCKET REF NO.</div>
              <div className="ref-value">{report.report_id}</div>
              <div className="ref-date">DATE: {report.generated_at}</div>
            </div>
          </div>

          <div className="report-divider" />

          {/* Site & Location Summary */}
          <div className="report-section">
            <div className="report-sec-title">1. MONITORED SITE & SPATIAL JURISDICTION</div>
            <div className="report-grid-3col">
              <div className="report-data-item">
                <span className="data-key">Target Site Name</span>
                <span className="data-val highlight">{report.site_name}</span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Area / Taluk Jurisdiction</span>
                <span className="data-val">{report.area_name}</span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Geographic Coordinates</span>
                <span className="data-val mono">{report.coordinates_formatted}</span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Timeline / Occurrence Period</span>
                <span className="data-val">{report.timeline_duration}</span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Baseline Imagery Date</span>
                <span className="data-val mono">{report.before_date}</span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Detection Imagery Date</span>
                <span className="data-val mono">{report.after_date}</span>
              </div>
            </div>
          </div>

          {/* Satellite Evidence Snapshots */}
          <div className="report-section">
            <div className="report-sec-title">2. SATELLITE CHANGE DETECTION EVIDENCE SNAPSHOTS</div>
            <div className="report-evidence-grid">
              <div className="report-evidence-card">
                <div className="evidence-card-label before">
                  BEFORE: {report.before_date} (Baseline Imagery)
                </div>
                <div className="evidence-frame">
                  {report.before_image ? (
                    <img src={report.before_image} alt="Before Satellite Snapshot" className="evidence-img" />
                  ) : (
                    <div className="evidence-placeholder">Baseline Satellite Snapshot Recorded</div>
                  )}
                </div>
              </div>

              <div className="report-evidence-vs">VS</div>

              <div className="report-evidence-card">
                <div className="evidence-card-label after">
                  AFTER: {report.after_date} (Detected Disturbance)
                </div>
                <div className="evidence-frame">
                  <img src={report.after_image} alt="After Satellite Snapshot" className="evidence-img" />
                </div>
              </div>
            </div>
          </div>

          {/* Machine Learning Metrics */}
          <div className="report-section">
            <div className="report-sec-title">3. SIAMESE RESNET-18 NEURAL NETWORK CLASSIFICATION</div>
            <div className="report-grid-4col">
              <div className="report-data-item">
                <span className="data-key">Disruption Classification</span>
                <span className="data-val" style={{ fontWeight: 700, color: '#f87171' }}>
                  {report.change_type}
                </span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Risk / Severity Level</span>
                <span className={`report-sev-badge ${report.severity.toLowerCase()}`}>
                  {report.severity} SEVERITY
                </span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Calibrated Change Probability</span>
                <span className="data-val" style={{ color: report.change_probability >= 0.5 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                  {(report.change_probability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="report-data-item">
                <span className="data-key">Edge Structural Correlation</span>
                <span className="data-val">
                  {report.edge_correlation !== null && report.edge_correlation !== undefined
                    ? `${(report.edge_correlation * 100).toFixed(1)}% (Sobel)`
                    : 'Analyzed'}
                </span>
              </div>
            </div>
          </div>

          {/* NVIDIA NIM Vision Assessment */}
          <div className="report-section">
            <div className="report-sec-title">
              4. NVIDIA NIM VISION FORENSIC ASSESSMENT ({report.ai_model_used})
            </div>
            <div className="report-ai-narrative-box">
              <pre className="report-ai-text">{report.ai_vision_analysis}</pre>
            </div>
          </div>

          {/* Enforcement Directives */}
          <div className="report-section">
            <div className="report-sec-title">5. STATUTORY ENFORCEMENT & PHYSICAL INSPECTION DIRECTIVES</div>
            <div className="report-actions-box">
              <div className="actions-header">
                <span>Statutory Authority: <strong>{report.target_authority}</strong></span>
                {report.complaint_id && (
                  <span>Complaint Reference: <strong>{report.complaint_id}</strong></span>
                )}
              </div>
              <ul className="actions-list">
                {report.recommended_field_actions.map((act, idx) => (
                  <li key={idx}>
                    <CheckCircle2 size={13} style={{ color: '#06b6d4', marginRight: 6, flexShrink: 0 }} />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Signoff */}
          <div className="report-signoff-row">
            <div className="signoff-box">
              <div className="sign-line">Autonomous Satellite Intelligence System</div>
              <div className="sign-role">Environmental Forensic Intelligence Platform</div>
            </div>
            <div className="signoff-box right">
              <div className="sign-line">Authorized Field Officer / Magistrate</div>
              <div className="sign-role">District Enforcement Wing, Belagavi</div>
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="ai-verdict-footer no-print" style={{ marginTop: 12 }}>
          {onFileComplaint && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                onClose();
                onFileComplaint();
              }}
              style={{ background: '#dc2626', borderColor: '#b91c1c' }}
            >
              <Building2 size={13} style={{ marginRight: 5 }} />
              <span>File Official Complaint for Field Inspection</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Report
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            <Download size={13} style={{ marginRight: 6 }} />
            <span>Download PDF Docket</span>
          </button>
        </div>
      </div>
    </div>
  );
}
