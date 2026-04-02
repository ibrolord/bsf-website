import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Node, Edge, Connection, OnNodeDrag } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

import { api } from "../../api/client";
import type { DFDResponse, NodeType, DFDBulkSave } from "../../types/api";
import { nodeTypes } from "./DFDNodeTypes";
import { TrustBoundaryNode, buildBoundaryNodes } from "./TrustBoundaryNode";
import { AddNodeDialog } from "./AddNodeDialog";
import { NodeEditor } from "./NodeEditor";
import { DFDToolbar } from "./DFDToolbar";

interface DFDCanvasProps {
  threatModelId: string;
}

type LoadState = "loading" | "empty" | "error" | "data";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

// Locked dagre config
const DAGRE_CONFIG = {
  rankdir: "LR" as const,
  nodesep: 80,
  ranksep: 120,
  edgesep: 30,
  marginx: 40,
  marginy: 40,
};

// Merge custom node types including trust boundary
const allNodeTypes = {
  ...nodeTypes,
  trustBoundary: TrustBoundaryNode,
};

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[]
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph(DAGRE_CONFIG);

  // Only layout non-boundary nodes
  for (const node of nodes) {
    if (node.type === "trustBoundary") continue;
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    if (node.type === "trustBoundary") return node;
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

function convertDFDToReactFlow(dfd: DFDResponse): { nodes: Node[]; edges: Edge[] } {
  // 1. Create edges from DFDEdgeResponse
  const edges: Edge[] = dfd.edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label || undefined,
    style: { stroke: "#555", strokeWidth: 2 },
    labelStyle: { fontSize: 12 },
    labelBgStyle: { fill: "#fff", padding: "4px" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#555" },
  }));

  // 2. Create data flow nodes from DFDNodeResponse
  const dataNodes: Node[] = dfd.nodes.map((n) => ({
    id: n.id,
    type: n.node_type,
    position: { x: n.position_x, y: n.position_y },
    data: { label: n.name },
  }));

  // 3. Apply dagre layout to get final positions
  const layoutNodes = applyDagreLayout(dataNodes, edges);

  // 4. Build position map for boundary sizing
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const node of layoutNodes) {
    positionMap.set(node.id, node.position);
  }

  // 5. Build trust boundary group nodes
  const boundaryNodes = buildBoundaryNodes(dfd.trust_boundaries, positionMap);

  // 6. Map node_ids to boundary for parentId assignment
  const nodeToBoundary = new Map<string, string>();
  for (const boundary of dfd.trust_boundaries) {
    for (const nodeId of boundary.node_ids) {
      nodeToBoundary.set(nodeId, boundary.id);
    }
  }

  // 7. Adjust child node positions to be relative to parent boundary
  const finalDataNodes = layoutNodes.map((node) => {
    const boundaryId = nodeToBoundary.get(node.id);
    if (!boundaryId) return node;
    const boundary = boundaryNodes.find((b) => b.id === boundaryId);
    if (!boundary) return node;
    return {
      ...node,
      parentId: boundaryId,
      position: {
        x: node.position.x - boundary.position.x,
        y: node.position.y - boundary.position.y,
      },
    };
  });

  // 8. Group nodes MUST come before their children in the array
  const allNodes: Node[] = [...boundaryNodes, ...finalDataNodes];

  return { nodes: allNodes, edges };
}

export function DFDCanvas({ threatModelId }: DFDCanvasProps): JSX.Element {
  const [state, setState] = useState<LoadState>("loading");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<{
    id: string;
    name: string;
    type: NodeType;
  } | null>(null);

  const loadDFD = useCallback(async () => {
    setState("loading");
    try {
      const dfd = await api.getDFD(threatModelId);
      if (dfd.nodes.length === 0 && dfd.edges.length === 0) {
        setState("empty");
        return;
      }
      const { nodes: rfNodes, edges: rfEdges } = convertDFDToReactFlow(dfd);
      setNodes(rfNodes);
      setEdges(rfEdges);
      setState("data");
    } catch {
      setState("error");
    }
  }, [threatModelId, setNodes, setEdges]);

  useEffect(() => {
    loadDFD();
  }, [loadDFD]);

  // Block 5: Drag stop handler — update local node positions
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: node.position } : n
        )
      );
    },
    [setNodes]
  );

  // Block 7 + 9: Delete selected nodes/edges on Delete/Backspace
  const handleKeyDown = useCallback(
    async (event: React.KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      // Don't trigger delete if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      const selectedNodes = nodes.filter(
        (n) => n.selected && n.type !== "trustBoundary"
      );
      const selectedEdges = edges.filter((e) => e.selected);

      // Block 7: Delete selected nodes
      for (const node of selectedNodes) {
        try {
          await api.deleteNode(threatModelId, node.id);
        } catch {
          // continue deleting others
        }
      }
      if (selectedNodes.length > 0) {
        const deletedIds = new Set(selectedNodes.map((n) => n.id));
        setNodes((nds) => nds.filter((n) => !deletedIds.has(n.id)));
        // Also remove edges connected to deleted nodes
        setEdges((eds) =>
          eds.filter(
            (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
          )
        );
      }

      // Block 9: Delete selected edges
      for (const edge of selectedEdges) {
        try {
          await api.deleteEdge(threatModelId, edge.id);
        } catch {
          // continue deleting others
        }
      }
      if (selectedEdges.length > 0) {
        const deletedEdgeIds = new Set(selectedEdges.map((e) => e.id));
        setEdges((eds) => eds.filter((e) => !deletedEdgeIds.has(e.id)));
      }
    },
    [nodes, edges, threatModelId, setNodes, setEdges]
  );

  // Block 8: Connect handler — create edge on drag between handles
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        const created = await api.createEdge(threatModelId, {
          source_node_id: connection.source,
          target_node_id: connection.target,
        });
        const newEdge: Edge = {
          id: created.id,
          source: created.source_node_id,
          target: created.target_node_id,
          label: created.label || undefined,
          style: { stroke: "#555", strokeWidth: 2 },
          labelStyle: { fontSize: 12 },
          labelBgStyle: { fill: "#fff", padding: "4px" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#555" },
        };
        setEdges((eds) => [...eds, newEdge]);
      } catch {
        // silently fail — could show error toast in the future
      }
    },
    [threatModelId, setEdges]
  );

  // Block 10: Node click handler — open inline editor
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Don't open editor for boundary nodes
      if (node.type === "trustBoundary") return;
      const nodeType = node.type as NodeType;
      setEditingNode({
        id: node.id,
        name: (node.data as { label: string }).label || "",
        type: nodeType,
      });
    },
    []
  );

  // Block 6: Add node callback
  const handleNodeAdded = useCallback(
    (apiNode: { id: string; node_type: NodeType; name: string; position_x: number; position_y: number }) => {
      const newNode: Node = {
        id: apiNode.id,
        type: apiNode.node_type,
        position: { x: apiNode.position_x, y: apiNode.position_y },
        data: { label: apiNode.name },
      };
      setNodes((nds) => [...nds, newNode]);
      setShowAddDialog(false);
      // Move to data state if we were in empty
      setState("data");
    },
    [setNodes]
  );

  // Block 10: Node updated callback
  const handleNodeSaved = useCallback(
    (updated: { id: string; node_type: NodeType; name: string }) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === updated.id
            ? { ...n, type: updated.node_type, data: { label: updated.name } }
            : n
        )
      );
      setEditingNode(null);
    },
    [setNodes]
  );

  // Block 11: Create trust boundary from selected nodes
  const handleCreateBoundary = useCallback(async () => {
    const selectedNodes = nodes.filter(
      (n) => n.selected && n.type !== "trustBoundary"
    );
    if (selectedNodes.length < 2) return;

    try {
      await api.createBoundary(threatModelId, {
        node_ids: selectedNodes.map((n) => n.id),
      });
      // Reload DFD to get proper grouping
      await loadDFD();
    } catch {
      // silently fail
    }
  }, [nodes, threatModelId, loadDFD]);

  // Block 12: Save DFD — convert ReactFlow state to DFDBulkSave format
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      // Build bulk save payload from current ReactFlow state
      const dataNodes = nodes.filter((n) => n.type !== "trustBoundary");
      const boundaryNodes = nodes.filter((n) => n.type === "trustBoundary");

      const bulkSave: DFDBulkSave = {
        nodes: dataNodes.map((n) => ({
          node_type: n.type as NodeType,
          name: (n.data as { label: string }).label || "Unnamed",
          position_x: n.position.x,
          position_y: n.position.y,
          trust_boundary_id: n.parentId || null,
        })),
        edges: edges.map((e) => ({
          source_node_id: e.source,
          target_node_id: e.target,
          label: (e.label as string) || undefined,
        })),
        trust_boundaries: boundaryNodes.map((b) => ({
          name: (b.data as { label: string }).label || "Trust Boundary",
          node_ids: dataNodes
            .filter((n) => n.parentId === b.id)
            .map((n) => n.id),
        })),
      };

      await api.saveDFD(threatModelId, bulkSave);
      setSaveStatus("saved");
      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [nodes, edges, threatModelId]);

  // Block 13: Toolbar state — compute selection state
  const selectedNodeCount = useMemo(
    () => nodes.filter((n) => n.selected && n.type !== "trustBoundary").length,
    [nodes]
  );
  const selectedEdgeCount = useMemo(
    () => edges.filter((e) => e.selected).length,
    [edges]
  );
  const hasSelection = selectedNodeCount > 0 || selectedEdgeCount > 0;
  const hasMultiSelection = selectedNodeCount >= 2;

  // Block 13: Delete selected handler for toolbar button
  const handleDeleteSelected = useCallback(() => {
    // Simulate a keyboard delete event by reusing the same logic
    const syntheticEvent = {
      key: "Delete",
      target: { tagName: "DIV" },
    } as unknown as React.KeyboardEvent;
    handleKeyDown(syntheticEvent);
  }, [handleKeyDown]);

  const memoizedNodeTypes = useMemo(() => allNodeTypes, []);

  if (state === "loading") {
    return (
      <div className="dfd-canvas-container" id={`dfd-canvas-${threatModelId}`}>
        <div className="dfd-state-message">
          <div className="dfd-spinner" />
          <p>Loading DFD...</p>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="dfd-canvas-container" id={`dfd-canvas-${threatModelId}`}>
        <DFDToolbar
          onAddNode={() => setShowAddDialog(true)}
          onDeleteSelected={handleDeleteSelected}
          onCreateBoundary={handleCreateBoundary}
          onSave={handleSave}
          saveStatus={saveStatus}
          hasSelection={false}
          hasMultiSelection={false}
        />
        <div className="dfd-state-message">
          <p>No DFD generated yet. Upload a document or add nodes manually.</p>
        </div>
        {showAddDialog && (
          <AddNodeDialog
            threatModelId={threatModelId}
            onNodeAdded={handleNodeAdded}
            onClose={() => setShowAddDialog(false)}
          />
        )}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="dfd-canvas-container" id={`dfd-canvas-${threatModelId}`}>
        <div className="dfd-state-message dfd-state-error">
          <p>Failed to load DFD. Try refreshing.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="dfd-canvas-container"
      id={`dfd-canvas-${threatModelId}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <DFDToolbar
        onAddNode={() => setShowAddDialog(true)}
        onDeleteSelected={handleDeleteSelected}
        onCreateBoundary={handleCreateBoundary}
        onSave={handleSave}
        saveStatus={saveStatus}
        hasSelection={hasSelection}
        hasMultiSelection={hasMultiSelection}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={memoizedNodeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag
        zoomOnScroll
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        selectionOnDrag
        selectNodesOnDrag
      >
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {showAddDialog && (
        <AddNodeDialog
          threatModelId={threatModelId}
          onNodeAdded={handleNodeAdded}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {editingNode && (
        <NodeEditor
          threatModelId={threatModelId}
          nodeId={editingNode.id}
          initialName={editingNode.name}
          initialType={editingNode.type}
          onSaved={handleNodeSaved}
          onClose={() => setEditingNode(null)}
        />
      )}
    </div>
  );
}

export { type DFDCanvasProps };
