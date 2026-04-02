import { useState, useCallback } from "react";
import type { NodeType } from "../../types/api";
import { api } from "../../api/client";
import type { DFDNodeResponse } from "../../types/api";

interface AddNodeDialogProps {
  threatModelId: string;
  onNodeAdded: (node: DFDNodeResponse) => void;
  onClose: () => void;
}

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: "process", label: "Process" },
  { value: "data_store", label: "Data Store" },
  { value: "external_entity", label: "External Entity" },
];

export function AddNodeDialog({
  threatModelId,
  onNodeAdded,
  onClose,
}: AddNodeDialogProps): JSX.Element {
  const [nodeType, setNodeType] = useState<NodeType>("process");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const node = await api.createNode(threatModelId, {
        node_type: nodeType,
        name: name.trim(),
        position_x: 100,
        position_y: 100,
      });
      onNodeAdded(node);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create node.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [threatModelId, nodeType, name, onNodeAdded]);

  return (
    <div className="dfd-dialog-overlay" onClick={onClose}>
      <div className="dfd-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="dfd-dialog-title">Add Node</h3>

        <div className="form-field">
          <label htmlFor="add-node-type">Type</label>
          <select
            id="add-node-type"
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

        <div className="form-field">
          <label htmlFor="add-node-name">Name</label>
          <input
            id="add-node-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter node name"
            autoFocus
          />
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
            onClick={handleAdd}
            disabled={saving || !name.trim()}
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
