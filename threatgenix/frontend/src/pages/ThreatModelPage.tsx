import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { ThreatModelResponse, ThreatResponse } from "../types/api";
import { api } from "../api/client";
import { DFDCanvas } from "../components/dfd/DFDCanvas";
import { DocumentUpload } from "../components/DocumentUpload";
import { ThreatTable } from "../components/threats/ThreatTable";
import { StrideFilter } from "../components/threats/StrideFilter";
import { GenerateThreatsButton } from "../components/threats/GenerateThreatsButton";
import { ThreatTriageModal } from "../components/threats/ThreatTriageModal";

function ThreatModelPage() {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState<ThreatModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dfdKey, setDfdKey] = useState(0);
  const [threats, setThreats] = useState<ThreatResponse[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(false);
  const [strideFilter, setStrideFilter] = useState<string | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<ThreatResponse | null>(null);
  const [aiSkippedReason, setAiSkippedReason] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getThreatModel(id)
      .then(setModel)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setThreatsLoading(true);
    api.getThreats(id)
      .then(setThreats)
      .catch(() => {}) // silent — threats may not exist yet
      .finally(() => setThreatsLoading(false));
  }, [id, dfdKey]); // refetch when DFD changes

  const handleUploadComplete = useCallback(() => {
    // Force DFDCanvas to remount and refetch by changing key
    setDfdKey((k) => k + 1);
  }, []);

  const handleGenerated = useCallback((newThreats: ThreatResponse[], skipReason: string | null) => {
    setThreats(newThreats);
    setAiSkippedReason(skipReason);
  }, []);

  const handleThreatClick = useCallback((threat: ThreatResponse) => {
    setSelectedThreat(threat);
  }, []);

  const handleTriaged = useCallback((updated: ThreatResponse) => {
    setThreats((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedThreat(null);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!id) return;
    setExportingPdf(true);
    try {
      const blob = await api.generateReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `threatmodel-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert(`PDF export failed: ${msg}`);
    } finally {
      setExportingPdf(false);
    }
  }, [id]);

  const filteredThreats = useMemo(() => {
    if (!strideFilter) return threats;
    return threats.filter(t => t.stride_category === strideFilter);
  }, [threats, strideFilter]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">Failed to load threat model: {error}</p>;
  if (!model || !id) return <p>Threat model not found.</p>;

  return (
    <div>
      <h2>{model.system_name}</h2>
      <p>{model.description}</p>
      <p>Classification: {model.data_classification}</p>

      <button
        onClick={handleExportPdf}
        disabled={exportingPdf}
        style={{ marginBottom: "1rem" }}
      >
        {exportingPdf ? "Generating PDF..." : "Export PDF"}
      </button>

      <section className="tm-section">
        <DocumentUpload
          threatModelId={id}
          onUploadComplete={handleUploadComplete}
        />
      </section>

      <section className="tm-section">
        <h3>Data Flow Diagram</h3>
        <DFDCanvas key={dfdKey} threatModelId={id} />
      </section>

      <section className="tm-section">
        <h3>Threat Analysis</h3>
        <GenerateThreatsButton
          threatModelId={id}
          onGenerated={handleGenerated}
          disabled={threatsLoading}
        />
        {aiSkippedReason && (
          <div className="ai-skipped-warning" role="alert">
            AI enhancement unavailable — showing rules-only results.
          </div>
        )}
        <StrideFilter
          threats={threats}
          activeFilter={strideFilter}
          onFilterChange={setStrideFilter}
        />
        <ThreatTable
          threats={filteredThreats}
          loading={threatsLoading}
          onThreatClick={handleThreatClick}
        />
      </section>

      {selectedThreat && id && (
        <ThreatTriageModal
          threat={selectedThreat}
          threatModelId={id}
          onClose={() => setSelectedThreat(null)}
          onTriaged={handleTriaged}
        />
      )}
    </div>
  );
}

export default ThreatModelPage;
