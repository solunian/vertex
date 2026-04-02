import type { SimulationNodeDatum } from "d3-force";

export type NodeType = "node";

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: NodeType;
  color?: string;
  pinned?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

export interface Path {
  nodes: string[];
  edges: GraphEdge[];
}
