import { useRef, useState } from "react";
import { api } from "../api/client";

interface DocumentUploadProps {
  threatModelId: string;
  onUploadComplete: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function DocumentUpload({ threatModelId, onUploadComplete }: DocumentUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setState("uploading");
    setErrorMsg("");

    try {
      await api.uploadDocument(threatModelId, file);
      setState("success");
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
      // Notify parent to refresh DFD
      onUploadComplete();
    } catch (e: unknown) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="document-upload">
      <h3>Upload Document</h3>
      <div className="document-upload-row">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          disabled={state === "uploading"}
        />
        <button
          className="btn-upload"
          onClick={handleUpload}
          disabled={state === "uploading"}
        >
          {state === "uploading" ? "Uploading and analyzing..." : "Upload"}
        </button>
      </div>
      {state === "success" && (
        <p className="upload-success">Document uploaded. DFD has been refreshed.</p>
      )}
      {state === "error" && (
        <p className="upload-error">Upload failed: {errorMsg}</p>
      )}
    </div>
  );
}
