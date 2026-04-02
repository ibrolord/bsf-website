import { useState, useMemo } from "react";
import type { ThreatResponse } from "../../types/api";

interface ThreatTableProps {
  threats: ThreatResponse[];
  loading: boolean;
  onThreatClick?: (threat: ThreatResponse) => void;
}

type SortKey = "display_id" | "description" | "stride_category" | "severity" | "source" | "status";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

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

function compareThreatField(a: ThreatResponse, b: ThreatResponse, key: SortKey): number {
  if (key === "severity") {
    return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
  }
  const av = a[key] as string;
  const bv = b[key] as string;
  return av.localeCompare(bv);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "display_id", label: "ID" },
  { key: "description", label: "Description" },
  { key: "stride_category", label: "STRIDE" },
  { key: "severity", label: "Severity" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
];

export function ThreatTable({ threats, loading, onThreatClick }: ThreatTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("display_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = [...threats];
    copy.sort((a, b) => {
      const cmp = compareThreatField(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [threats, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (loading) {
    return (
      <div className="threat-table-loading">
        <div className="dfd-spinner" />
        <span>Loading threats...</span>
      </div>
    );
  }

  if (threats.length === 0) {
    return (
      <div className="threat-table-empty">
        No threats generated yet. Click &quot;Generate Threats&quot; to analyze.
      </div>
    );
  }

  return (
    <div className="threat-table-wrapper">
      <table className="threat-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`threat-table-th ${col.key === "display_id" ? "threat-table-col-id" : ""} ${col.key === "description" ? "threat-table-col-desc" : ""}`}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="threat-table-sort-icon">
                    {sortDir === "asc" ? " \u25B2" : " \u25BC"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((threat) => (
            <tr
              key={threat.id}
              className="threat-table-row"
              onClick={() => onThreatClick?.(threat)}
            >
              <td className="threat-table-col-id">{threat.display_id}</td>
              <td className="threat-table-col-desc" title={threat.description}>
                {truncate(threat.description, 100)}
              </td>
              <td>
                <span className={`threat-badge ${STRIDE_COLORS[threat.stride_category] ?? ""}`}>
                  {threat.stride_category}
                </span>
              </td>
              <td>
                <span className={`threat-badge ${SEVERITY_CLASSES[threat.severity] ?? ""}`}>
                  {threat.severity}
                </span>
              </td>
              <td>{threat.source}</td>
              <td>
                <span className={`threat-badge ${STATUS_CLASSES[threat.status] ?? ""}`}>
                  {threat.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
