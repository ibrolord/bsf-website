interface DFDToolbarProps {
  onAddNode: () => void;
  onDeleteSelected: () => void;
  onCreateBoundary: () => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  hasSelection: boolean;
  hasMultiSelection: boolean;
}

export function DFDToolbar({
  onAddNode,
  onDeleteSelected,
  onCreateBoundary,
  onSave,
  saveStatus,
  hasSelection,
  hasMultiSelection,
}: DFDToolbarProps): JSX.Element {
  const saveLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save Failed"
          : "Save";

  return (
    <div className="dfd-toolbar">
      <button className="dfd-toolbar-btn" onClick={onAddNode}>
        Add Node
      </button>
      <button
        className="dfd-toolbar-btn"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
      >
        Delete Selected
      </button>
      <button
        className="dfd-toolbar-btn"
        onClick={onCreateBoundary}
        disabled={!hasMultiSelection}
      >
        Create Boundary
      </button>
      <button
        className={`dfd-toolbar-btn dfd-toolbar-btn-save${saveStatus === "error" ? " dfd-toolbar-btn-error" : ""}${saveStatus === "saved" ? " dfd-toolbar-btn-saved" : ""}`}
        onClick={onSave}
        disabled={saveStatus === "saving"}
      >
        {saveLabel}
      </button>
    </div>
  );
}
