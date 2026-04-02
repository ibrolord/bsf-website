import { useState } from "react";
import type { ThreatModelCreate, ThreatModelResponse } from "../types/api";
import { api } from "../api/client";

interface IntakeFormProps {
  onSuccess: (model: ThreatModelResponse) => void;
}

function IntakeForm({ onSuccess }: IntakeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data: ThreatModelCreate = {
      system_name: formData.get("system_name") as string,
      description: (formData.get("description") as string) || undefined,
      data_classification: formData.get("data_classification") as ThreatModelCreate["data_classification"],
    };

    try {
      const model = await api.createThreatModel(data);
      onSuccess(model);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="system_name">System Name</label>
        <input
          id="system_name"
          name="system_name"
          type="text"
          required
          maxLength={255}
          placeholder="e.g., Online Banking Portal"
        />
      </div>
      <div className="form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          maxLength={500}
          placeholder="Describe the system being modeled..."
          rows={3}
        />
      </div>
      <div className="form-field">
        <label htmlFor="data_classification">Data Classification</label>
        <select id="data_classification" name="data_classification" defaultValue="Internal">
          <option value="Public">Public</option>
          <option value="Internal">Internal</option>
          <option value="Confidential">Confidential</option>
          <option value="Restricted">Restricted</option>
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Threat Model"}
      </button>
    </form>
  );
}

export default IntakeForm;
