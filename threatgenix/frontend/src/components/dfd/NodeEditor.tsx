import { useState, useCallback } from "react";
import type { NodeType } from "../../types/api";
import { api } from "../../api/client";
import type { DFDNodeResponse } from "../../types/api";

interface NodeEditorProps {
  threatModelId: string;
  nodeId: string;
  initialName: string;
  initialType: NodeType;
  onSaved: (updated: DFDNodeResponse) => void;
  onClose: () => void;
}

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: "process", label: "Process" },
  { value: "data_store", label: "Data Store" },
  { value: "external_entity", label: "External Entity" },
];

export function NodeEditor({
  threatModelId,
  nodeId,
  initialName,
  initialType,
  onSaved,
  onClose,
}: NodeEditorProps): JSX.Element {
  const [name, setName] = useState(initialName);
  const [nodeType, setNodeType] = useState<NodeType>(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateNode(threatModelId, nodeId, {
        name: name.trim(),
        node_type: nodeType,
      });
      onSaved(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update node.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [threatModelId, nodeId, name, nodeType, onSaved]);

  return (
    <div className="dfd-dialog-overlay" onClick={onClose}>
      <div className="dfd-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="dfd-dialog-title">Edit Node</h3>

        <div className="form-field">
          <label htmlFor="edit-node-name">Name</label>
          <input
            id="edit-node-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="edit-node-type">Type</label>
          <select
            id="edit-node-type"
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value as NodeType)}
          >
            {NODE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="dfd-dialog-actions">
          <button
            className="btn-triage btn-triage-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn-create"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
