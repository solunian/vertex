import type { GraphNode, GraphEdge } from "./graph_types";

/**
 * Finds the shortest path between two nodes using Dijkstra's algorithm
 */
export function find_shortest_path(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startId: string,
  endId: string
): string[] | null {
  if (startId === endId) return [startId];

  const adjacency: Record<string, { node: string; weight: number }[]> = {};
  edges.forEach((edge) => {
    const s = typeof edge.source === "string" ? edge.source : (edge.source as any).id;
    const t = typeof edge.target === "string" ? edge.target : (edge.target as any).id;
    const weight = edge.weight ?? 5;

    if (!adjacency[s]) adjacency[s] = [];
    if (!adjacency[t]) adjacency[t] = [];
    adjacency[s].push({ node: t, weight });
    adjacency[t].push({ node: s, weight });
  });

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const nodes_set = new Set<string>();

  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    nodes_set.add(node.id);
  });

  distances[startId] = 0;

  while (nodes_set.size > 0) {
    // Find node with smallest distance
    let closest_node: string | null = null;
    for (const nodeId of nodes_set) {
      if (closest_node === null || distances[nodeId] < distances[closest_node]) {
        closest_node = nodeId;
      }
    }

    if (closest_node === null || distances[closest_node] === Infinity) break;
    if (closest_node === endId) break;

    nodes_set.delete(closest_node);

    const neighbors = adjacency[closest_node] || [];
    for (const neighbor of neighbors) {
      if (!nodes_set.has(neighbor.node)) continue;

      const alt = distances[closest_node] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = closest_node;
      }
    }
  }

  if (distances[endId] === Infinity) return null;

  const path: string[] = [];
  let curr: string | null = endId;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  return path;
}
