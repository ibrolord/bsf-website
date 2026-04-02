import type {
  ThreatModelCreate,
  ThreatModelResponse,
  ThreatModelListItem,
  DFDResponse,
  DFDBulkSave,
  DFDNodeCreate,
  DFDNodeResponse,
  DFDNodeUpdate,
  DFDEdgeCreate,
  DFDEdgeResponse,
  TrustBoundaryCreate,
  TrustBoundaryResponse,
  DocumentUploadResponse,
  ThreatResponse,
  ThreatTriageRequest,
  AnalyzeResponse,
} from "../types/api";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Threat Models
  createThreatModel: (data: ThreatModelCreate) =>
    request<ThreatModelResponse>("/threat-models", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getThreatModels: () => request<ThreatModelListItem[]>("/threat-models"),

  getThreatModel: (id: string) => request<ThreatModelResponse>(`/threat-models/${id}`),

  // Documents
  uploadDocument: async (threatModelId: string, file: File): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE}/threat-models/${threatModelId}/documents`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body}`);
    }
    return res.json() as Promise<DocumentUploadResponse>;
  },

  // DFD
  getDFD: (threatModelId: string) =>
    request<DFDResponse>(`/threat-models/${threatModelId}/dfd`),

  saveDFD: (threatModelId: string, data: DFDBulkSave) =>
    request<DFDResponse>(`/threat-models/${threatModelId}/dfd`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createNode: (threatModelId: string, data: DFDNodeCreate) =>
    request<DFDNodeResponse>(`/threat-models/${threatModelId}/dfd/nodes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateNode: (threatModelId: string, nodeId: string, data: DFDNodeUpdate) =>
    request<DFDNodeResponse>(`/threat-models/${threatModelId}/dfd/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteNode: (threatModelId: string, nodeId: string) =>
    request<void>(`/threat-models/${threatModelId}/dfd/nodes/${nodeId}`, { method: "DELETE" }),

  createEdge: (threatModelId: string, data: DFDEdgeCreate) =>
    request<DFDEdgeResponse>(`/threat-models/${threatModelId}/dfd/edges`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteEdge: (threatModelId: string, edgeId: string) =>
    request<void>(`/threat-models/${threatModelId}/dfd/edges/${edgeId}`, { method: "DELETE" }),

  createBoundary: (threatModelId: string, data: TrustBoundaryCreate) =>
    request<TrustBoundaryResponse>(`/threat-models/${threatModelId}/dfd/boundaries`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteBoundary: (threatModelId: string, boundaryId: string) =>
    request<void>(`/threat-models/${threatModelId}/dfd/boundaries/${boundaryId}`, {
      method: "DELETE",
    }),

  // Threats
  getThreats: (threatModelId: string, strideFilter?: string) => {
    const params = strideFilter ? `?stride_category=${encodeURIComponent(strideFilter)}` : "";
    return request<ThreatResponse[]>(`/threat-models/${threatModelId}/threats${params}`);
  },

  triageThreat: (threatModelId: string, threatId: string, data: ThreatTriageRequest) =>
    request<ThreatResponse>(`/threat-models/${threatModelId}/threats/${threatId}/triage`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Analyze
  analyze: (threatModelId: string, rulesOnly = false) =>
    request<AnalyzeResponse>(
      `/threat-models/${threatModelId}/analyze${rulesOnly ? "?rules_only=true" : ""}`,
      { method: "POST" }
    ),

  // Report
  generateReport: async (threatModelId: string, dfdImageBase64 = ""): Promise<Blob> => {
    const res = await fetch(`${BASE}/threat-models/${threatModelId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threat_model_id: threatModelId, dfd_image_base64: dfdImageBase64 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body}`);
    }
    return res.blob();
  },
};
