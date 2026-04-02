import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ThreatModelListItem, ThreatModelResponse } from "../types/api";
import { api } from "../api/client";
import IntakeForm from "../components/IntakeForm";

function HomePage() {
  const [models, setModels] = useState<ThreatModelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getThreatModels()
      .then(setModels)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSuccess(model: ThreatModelResponse) {
    navigate(`/threat-models/${model.id}`);
  }

  if (loading) return <p>Loading threat models...</p>;
  if (error) return <p className="error">Failed to load models: {error}</p>;

  return (
    <div>
      <h2>Threat Models</h2>
      <button className="btn-create" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Create New Threat Model"}
      </button>
      {showForm && <IntakeForm onSuccess={handleSuccess} />}
      {models.length === 0 ? (
        <p>No threat models yet. Create one to get started.</p>
      ) : (
        <ul className="model-list">
          {models.map((m) => (
            <li key={m.id}>
              <Link to={`/threat-models/${m.id}`}>
                <strong>{m.system_name}</strong> — {m.data_classification}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HomePage;
