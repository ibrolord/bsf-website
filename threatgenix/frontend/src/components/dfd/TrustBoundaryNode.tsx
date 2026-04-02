import type { Node, NodeProps } from "@xyflow/react";
import type { TrustBoundaryResponse } from "../../types/api";

type TrustBoundaryData = { label: string };
export type TrustBoundaryNodeType = Node<TrustBoundaryData, "trustBoundary">;

const BOUNDARY_PADDING = 20;

export function TrustBoundaryNode({ data }: NodeProps<TrustBoundaryNodeType>) {
  const label = data.label || "Trust Boundary";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "2px dashed #999",
        borderRadius: 4,
        background: "transparent",
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: 8,
          fontSize: 12,
          fontWeight: 600,
          color: "#666",
          background: "rgba(255,255,255,0.85)",
          padding: "1px 6px",
          borderRadius: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Builds ReactFlow group nodes from trust boundary data.
 * Each boundary becomes a group node sized to encompass its child nodes + padding.
 * Child nodes should have their parentId set to the boundary node id in DFDCanvas.
 */
export function buildBoundaryNodes(
  boundaries: TrustBoundaryResponse[],
  nodePositions: Map<string, { x: number; y: number }>
): Node[] {
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 60;

  return boundaries
    .filter((b) => b.node_ids.length > 0)
    .map((boundary) => {
      // Find the bounding box of all child nodes
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const nodeId of boundary.node_ids) {
        const pos = nodePositions.get(nodeId);
        if (!pos) continue;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + NODE_WIDTH);
        maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
      }

      // If no valid positions found, skip with a default size
      if (!isFinite(minX)) {
        return {
          id: boundary.id,
          type: "trustBoundary",
          position: { x: 0, y: 0 },
          data: { label: boundary.name },
          style: { width: 200, height: 100 },
        };
      }

      return {
        id: boundary.id,
        type: "trustBoundary",
        position: {
          x: minX - BOUNDARY_PADDING,
          y: minY - BOUNDARY_PADDING,
        },
        data: { label: boundary.name },
        style: {
          width: maxX - minX + BOUNDARY_PADDING * 2,
          height: maxY - minY + BOUNDARY_PADDING * 2,
        },
      };
    });
}
