import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";

// Node data shape
type DFDNodeData = { label: string };

// Custom node types for ReactFlow
export type ProcessNodeType = Node<DFDNodeData, "process">;
export type DataStoreNodeType = Node<DFDNodeData, "data_store">;
export type ExternalEntityNodeType = Node<DFDNodeData, "external_entity">;

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const baseStyle: React.CSSProperties = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 14,
  fontWeight: 500,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  padding: "0 12px",
};

export function ProcessNode({ data }: NodeProps<ProcessNodeType>) {
  const label = data.label || "Unnamed";
  return (
    <div
      style={{
        ...baseStyle,
        background: "#4A90D2",
        borderRadius: 8,
      }}
      title={label}
    >
      <Handle type="target" position={Position.Left} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function DataStoreNode({ data }: NodeProps<DataStoreNodeType>) {
  const label = data.label || "Unnamed";
  return (
    <div
      style={{
        ...baseStyle,
        background: "#F5A623",
        borderTop: "4px double #fff",
        borderBottom: "4px double #fff",
        borderLeft: "none",
        borderRight: "none",
      }}
      title={label}
    >
      <Handle type="target" position={Position.Left} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function ExternalEntityNode({ data }: NodeProps<ExternalEntityNodeType>) {
  const label = data.label || "Unnamed";
  return (
    <div
      style={{
        ...baseStyle,
        background: "#7B8D8E",
      }}
      title={label}
    >
      <Handle type="target" position={Position.Left} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = {
  process: ProcessNode,
  data_store: DataStoreNode,
  external_entity: ExternalEntityNode,
} as const;
