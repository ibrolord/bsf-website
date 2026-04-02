import { useState } from "react";
import type { ThreatResponse, ThreatTriageRequest } from "../../types/api";
import { api } from "../../api/client";

interface ThreatTriageModalProps {
  threat: ThreatResponse;
  threatModelId: string;
  onClose: () => void;
  onTriaged: (updated: ThreatResponse) => void;
}

const STRIDE_COLORS: Record<string, string> = {
  Spoofing: "stride-spoofing",
  Tampering: "stride-tampering",
  Repudiation: "stride-repudiation",
  "Information Disclosure": "stride-info-disclosure",
  "Denial of Service": "stride-dos",
  "Elevation of Privilege": "stride-eop",
};

const SEVERITY_CLASSES: Record<string, string> = {
  Critical: "severity-critical",
  High: "severity-high",
  Medium: "severity-medium",
  Low: "severity-low",
};

const STATUS_CLASSES: Record<string, string> = {
  Open: "status-open",
  Accepted: "status-accepted",
  Dismissed: "status-dismissed",
};

export function ThreatTriageModal({
  threat,
  threatModelId,
  onClose,
  onTriaged,
}: ThreatTriageModalProps) {
  const [dismissReason, setDismissReason] = useState("");
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTriage(status: "Accepted" | "Dismissed") {
    if (status === "Dismissed" && !dismissReason.trim()) {
      setError("A dismiss reason is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const body: ThreatTriageRequest = {
      status,
      dismiss_reason: status === "Dismissed" ? dismissReason.trim() : null,
    };

    try {
      const updated = await api.triageThreat(threatModelId, threat.id, body);
      onTriaged(updated);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Triage failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="triage-modal-overlay" onClick={onClose}>
      <div className="triage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="triage-modal-header">
          <h3>{threat.display_id}</h3>
          <button className="triage-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="triage-modal-body">
          <p className="triage-modal-description">{threat.description}</p>

          <div className="triage-modal-badges">
            <span className={`threat-badge ${STRIDE_COLORS[threat.stride_category] ?? ""}`}>
              {threat.stride_category}
            </span>
            <span className={`threat-badge ${SEVERITY_CLASSES[threat.severity] ?? ""}`}>
              {threat.severity}
            </span>
            <span className={`threat-badge ${STATUS_CLASSES[threat.status] ?? ""}`}>
              {threat.status}
            </span>
          </div>

          {threat.compliance_controls.length > 0 && (
            <div className="triage-modal-section">
              <h4>Compliance Controls</h4>
              <ul className="triage-modal-controls-list">
                {threat.compliance_controls.map((c) => (
                  <li key={c.nist_control_id}>
                    {c.nist_control_id} &mdash; {c.nist_control_name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {threat.affected_node_ids.length > 0 && (
            <div className="triage-modal-section">
              <h4>Affected Nodes</h4>
              <ul className="triage-modal-controls-list">
                {threat.affected_node_ids.map((nid) => (
                  <li key={nid}>{nid}</li>
                ))}
              </ul>
            </div>
          )}

          {showDismissInput && (
            <div className="triage-modal-section">
              <label htmlFor="dismiss-reason">Dismiss Reason (required)</label>
              <input
                id="dismiss-reason"
                className="triage-dismiss-input"
                type="text"
                placeholder="Why is this threat being dismissed?"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
              />
            </div>
          )}

          {error && <p className="triage-modal-error">{error}</p>}
        </div>

        <div className="triage-modal-actions">
          {!showDismissInput ? (
            <>
              <button
                className="btn-triage btn-triage-accept"
                disabled={loading}
                onClick={() => handleTriage("Accepted")}
              >
                {loading ? "Saving..." : "Accept Risk"}
              </button>
              <button
                className="btn-triage btn-triage-dismiss"
                disabled={loading}
                onClick={() => setShowDismissInput(true)}
              >
                Dismiss
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-triage btn-triage-dismiss"
                disabled={loading}
                onClick={() => handleTriage("Dismissed")}
              >
                {loading ? "Saving..." : "Confirm Dismiss"}
              </button>
              <button
                className="btn-triage btn-triage-cancel"
                disabled={loading}
                onClick={() => {
                  setShowDismissInput(false);
                  setDismissReason("");
                  setError(null);
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
