// Mirrors backend Pydantic schemas exactly

export interface ThreatModelCreate {
  system_name: string;
  description?: string;
  data_classification: "Public" | "Internal" | "Confidential" | "Restricted";
}

export interface ThreatModelResponse {
  id: string;
  system_name: string;
  description: string;
  data_classification: string;
  created_at: string;
  updated_at: string;
}

export interface ThreatModelListItem {
  id: string;
  system_name: string;
  data_classification: string;
  created_at: string;
  updated_at: string;
  threat_count: number;
}

// DFD

export type NodeType = "process" | "data_store" | "external_entity";

export interface DFDNodeCreate {
  node_type: NodeType;
  name: string;
  position_x?: number;
  position_y?: number;
  trust_boundary_id?: string | null;
}

export interface DFDNodeResponse {
  id: string;
  node_type: NodeType;
  name: string;
  position_x: number;
  position_y: number;
  trust_boundary_id: string | null;
  properties: Record<string, unknown>;
}

export interface DFDNodeUpdate {
  name?: string;
  node_type?: NodeType;
  position_x?: number;
  position_y?: number;
  trust_boundary_id?: string | null;
}

export interface DFDEdgeCreate {
  source_node_id: string;
  target_node_id: string;
  label?: string;
}

export interface DFDEdgeResponse {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface TrustBoundaryCreate {
  name?: string;
  node_ids: string[];
}

export interface TrustBoundaryResponse {
  id: string;
  name: string;
  node_ids: string[];
}

export interface DFDResponse {
  nodes: DFDNodeResponse[];
  edges: DFDEdgeResponse[];
  trust_boundaries: TrustBoundaryResponse[];
}

export interface DFDBulkSave {
  nodes: DFDNodeCreate[];
  edges: DFDEdgeCreate[];
  trust_boundaries?: TrustBoundaryCreate[];
}

// Document

export interface ParsedComponent {
  name: string;
  component_type: NodeType;
  confidence: number;
  description: string;
}

export interface ParsedFlow {
  source: string;
  target: string;
  label: string;
  confidence: number;
}

export interface ParsedBoundary {
  name: string;
  contains: string[];
}

export interface DocumentParseResult {
  components: ParsedComponent[];
  flows: ParsedFlow[];
  boundaries: ParsedBoundary[];
  raw_text_excerpt: string;
}

export interface DocumentUploadResponse {
  document_id: string;
  filename: string;
  page_count: number;
  parse_result: DocumentParseResult;
}

// Threats

export interface ComplianceControlRef {
  nist_control_id: string;
  nist_control_name: string;
}

export interface ThreatResponse {
  id: string;
  display_id: string;
  description: string;
  stride_category: string;
  severity: string;
  source: string;
  status: string;
  dismiss_reason: string | null;
  rule_id: string | null;
  ai_enhanced: boolean;
  original_rule_threat_id: string | null;
  affected_node_ids: string[];
  affected_edge_ids: string[];
  compliance_controls: ComplianceControlRef[];
  created_at: string;
}

export interface AnalyzeResponse {
  threats: ThreatResponse[];
  ai_skipped_reason: string | null;
}

export interface ThreatTriageRequest {
  status: "Accepted" | "Dismissed";
  dismiss_reason?: string | null;
}

// Report

export interface ReportRequest {
  threat_model_id: string;
  dfd_image_base64?: string;
}
