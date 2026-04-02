import { useState } from "react";
import type { ThreatResponse } from "../../types/api";
import { api } from "../../api/client";

interface GenerateThreatsButtonProps {
  threatModelId: string;
  onGenerated: (threats: ThreatResponse[], aiSkippedReason: string | null) => void;
  disabled?: boolean;
}

export function GenerateThreatsButton({
  threatModelId,
  onGenerated,
  disabled,
}: GenerateThreatsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyze(threatModelId);
      onGenerated(result.threats, result.ai_skipped_reason);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate threats";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="generate-threats">
      <button
        className="btn-generate-threats"
        onClick={handleClick}
        disabled={disabled || loading}
      >
        {loading ? (
          <>
            <span className="btn-spinner" />
            Generating...
          </>
        ) : (
          "Generate Threats"
        )}
      </button>
      {error && <p className="generate-threats-error">{error}</p>}
    </div>
  );
}
