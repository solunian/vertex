<script lang="ts">
  import * as d3 from "d3-force";
  import * as d3Zoom from "d3-zoom";
  import * as d3Drag from "d3-drag";
  import { select, pointer } from "d3-selection";
  import "d3-transition";
  import type { GraphNode, GraphEdge } from "../graph_types";

  interface GraphCanvasProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
    onNodeClick: (node: GraphNode) => void;
    onEdgeClick: (edge: GraphEdge) => void;
    onNodePin: (id: string, forceValue?: boolean) => void;
    highlightedPaths: string[][];
    selectedNodeId?: string;
    selectedEdge?: GraphEdge | null;
    resetZoomTrigger?: number;
    exportTrigger?: number;
  }

  let {
    nodes,
    edges,
    onNodeClick,
    onEdgeClick,
    onNodePin,
    highlightedPaths,
    selectedNodeId,
    selectedEdge,
    resetZoomTrigger,
    exportTrigger,
  }: GraphCanvasProps = $props();

  let canvasRef = $state<HTMLCanvasElement>();
  let simulationRef = $state<d3.Simulation<GraphNode, undefined>>();
  let zoomRef = $state<d3Zoom.ZoomBehavior<HTMLCanvasElement, unknown>>();
  let transformRef = $state(d3Zoom.zoomIdentity);
  let dimensions = $state({ width: 0, height: 0 });
  let transform = $state(d3Zoom.zoomIdentity);

  // Helper to find node at coordinates
  const findNodeAt = (x: number, y: number) => {
    return nodes.find((n) => {
      if (!n.x || !n.y) return false;
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 35; // Increased threshold for larger nodes
    });
  };

  // Helper to find edge at coordinates
  const findEdgeAt = (x: number, y: number, k: number) => {
    return edges.find((edge) => {
      const sourceId = typeof edge.source === "string" ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === "string" ? edge.target : (edge.target as any).id;
      const source = nodes.find((n) => n.id === sourceId);
      const target = nodes.find((n) => n.id === targetId);

      if (!source?.x || !source?.y || !target?.x || !target?.y) return false;

      const x1 = source.x;
      const y1 = source.y;
      const x2 = target.x;
      const y2 = target.y;

      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;
      if (len_sq !== 0) param = dot / len_sq;

      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = x - xx;
      const dy = y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 10 / k;
    });
  };

  const render = () => {
    const canvas = canvasRef;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Apply zoom transform
    ctx.save();
    const t = transformRef;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Draw grid dots
    const gridSize = 40;
    ctx.fillStyle = "#cbd5e1"; // slate-300
    // Draw grid in a larger area to cover pan
    const startX = Math.floor(-t.x / t.k / gridSize) * gridSize;
    const startY = Math.floor(-t.y / t.k / gridSize) * gridSize;
    const endX = startX + Math.ceil(dimensions.width / t.k) + gridSize * 2;
    const endY = startY + Math.ceil(dimensions.height / t.k) + gridSize * 2;

    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / t.k, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw edges
    ctx.shadowBlur = 0;
    edges.forEach((edge) => {
      const sourceId = typeof edge.source === "string" ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === "string" ? edge.target : (edge.target as any).id;

      const source = nodes.find((n) => n.id === sourceId);
      const target = nodes.find((n) => n.id === targetId);

      if (source?.x && source?.y && target?.x && target?.y) {
        const isHighlighted = highlightedPaths.some((path) => {
          for (let i = 0; i < path.length - 1; i++) {
            if (
              (path[i] === sourceId && path[i + 1] === targetId) ||
              (path[i] === targetId && path[i + 1] === sourceId)
            )
              return true;
          }
          return false;
        });

        const selS = selectedEdge
          ? typeof selectedEdge.source === "string"
            ? selectedEdge.source
            : (selectedEdge.source as any).id
          : null;
        const selT = selectedEdge
          ? typeof selectedEdge.target === "string"
            ? selectedEdge.target
            : (selectedEdge.target as any).id
          : null;
        const isSelected =
          (selS === sourceId && selT === targetId) || (selS === targetId && selT === sourceId);

        const weight = edge.weight ?? 5;
        // Thicker for more weight: weight 0 -> 1.5px, weight 9 -> 6px
        const baseWidth = weight / 2 + 1.5;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (isSelected) {
          ctx.strokeStyle = "#f59e0b"; // amber-500
          ctx.lineWidth = baseWidth + 2;
        } else if (isHighlighted) {
          ctx.strokeStyle = "#10b981"; // emerald-500
          ctx.lineWidth = baseWidth + 1;
        } else {
          ctx.strokeStyle = "#e5e7eb"; // slate-200
          ctx.lineWidth = baseWidth;
        }

        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      if (node.x && node.y) {
        const isSelected = node.id === selectedNodeId;

        // Shadow / Glow
        ctx.shadowBlur = isSelected ? 30 : 8;
        ctx.shadowColor = isSelected ? "rgba(245, 158, 11, 0.8)" : "rgba(0,0,0,0.1)";

        // Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, 2 * Math.PI); // Increased radius to 30
        ctx.fillStyle = isSelected ? "#f59e0b" : "#ffffff";
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#d97706" : "#d1d5db";
        ctx.lineWidth = isSelected ? 5 : 2;
        ctx.stroke();

        // Pin indicator
        if (node.pinned) {
          ctx.beginPath();
          ctx.arc(node.x + 20, node.y - 20, 6, 0, 2 * Math.PI);
          ctx.fillStyle = "#ef4444"; // red-500
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label with clipping
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, 28, 0, 2 * Math.PI);
        ctx.clip();

        ctx.shadowBlur = 0;
        ctx.fillStyle = isSelected ? "#ffffff" : "#1f2937";
        ctx.font = "bold 12px Inter"; // Slightly larger font
        ctx.textAlign = "center";
        ctx.fillText(node.name, node.x, node.y + 4);
        ctx.restore();
      }
    });

    ctx.restore(); // Restore zoom transform
    ctx.restore(); // Restore DPR scaling
  };

  // Handle re-render when transform or other props change
  $effect(() => {
    render;
    transform;
    render();
  });

  // Initialize zoom and drag
  $effect(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    const zoom = d3Zoom
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        transformRef = event.transform;
        transform = event.transform;
      })
      .filter((event) => {
        if (event.button) return false;
        if (event.ctrlKey && event.type !== "wheel") return false;

        if (event.type === "mousedown" || event.type === "touchstart") {
          const [mx, my] = pointer(event, canvas);
          const t = transformRef;
          const x = (mx - t.x) / t.k;
          const y = (my - t.y) / t.k;

          if (findNodeAt(x, y)) return false;
          if (findEdgeAt(x, y, t.k)) return false;
        }
        return true;
      });

    const drag = d3Drag
      .drag<HTMLCanvasElement, unknown>()
      .subject((event) => {
        const t = transformRef;
        const x = (event.x - t.x) / t.k;
        const y = (event.y - t.y) / t.k;
        return findNodeAt(x, y);
      })
      .on("start", (event) => {
        if (!event.subject) return;
        onNodeClick(event.subject);
        if (!simulationRef) return;
        simulationRef.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        if (!event.subject) return;
        const canvas = canvasRef;
        if (!canvas) return;
        const [mx, my] = pointer(event, canvas);
        const t = transformRef;
        event.subject.fx = (mx - t.x) / t.k;
        event.subject.fy = (my - t.y) / t.k;
      })
      .on("end", (event) => {
        if (!event.subject) return;
        if (!simulationRef) return;
        simulationRef.alphaTarget(0);

        // Only keep fixed position if it was already pinned
        if (!event.subject.pinned) {
          event.subject.fx = null;
          event.subject.fy = null;
        } else {
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }
      });

    zoomRef = zoom;
    const selection = select(canvas);
    selection.call(zoom).call(drag);

    // Handle clicks via D3 to respect defaultPrevented (from drag/zoom)
    selection.on("click", (event) => {
      if (event.defaultPrevented) return;

      const [mx, my] = pointer(event, canvas);
      const t = transformRef;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;

      const node = findNodeAt(x, y);
      if (node) {
        onNodeClick(node);
      } else {
        const edge = findEdgeAt(x, y, t.k);
        if (edge) onEdgeClick(edge);
      }
    });

    selection.on("contextmenu", (event) => {
      event.preventDefault();
      const [mx, my] = pointer(event, canvas);
      const t = transformRef;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;

      const node = findNodeAt(x, y);
      if (node) {
        onNodePin(node.id);
      }
    });

    return () => {
      selection.on("click", null);
      selection.on("contextmenu", null);
    };
  });

  // Handle reset zoom
  $effect(() => {
    if (resetZoomTrigger && canvasRef && zoomRef) {
      select(canvasRef).transition().duration(750).call(zoomRef.transform, d3Zoom.zoomIdentity);
    }
  });

  // Handle Export PNG
  $effect(() => {
    if (exportTrigger && canvasRef) {
      const canvas = canvasRef;
      render();
      const link = document.createElement("a");
      link.download = `nexus-graph-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  });

  // Initialize simulation
  $effect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    if (!simulationRef) {
      simulationRef = d3
        .forceSimulation<GraphNode>(nodes)
        .force(
          "link",
          d3
            .forceLink<GraphNode, any>(edges)
            .id((d) => d.id)
            .distance(120)
        ) // Increased distance
        .force("charge", d3.forceManyBody().strength(-800)) // Stronger repulsion for larger nodes
        .force("collision", d3.forceCollide().radius(60)); // Increased collision radius
    } else {
      simulationRef.nodes(nodes);
      const linkForce = simulationRef.force("link") as d3.ForceLink<GraphNode, any>;
      linkForce.links(edges);
    }

    // Apply pinned state
    nodes.forEach((node) => {
      if (node.pinned) {
        node.fx = node.x;
        node.fy = node.y;
      } else {
        node.fx = null;
        node.fy = null;
      }
    });

    simulationRef
      .force("x", d3.forceX(dimensions.width / 2).strength(0.1))
      .force("y", d3.forceY(dimensions.height / 2).strength(0.1));

    simulationRef.on("tick", render);
    simulationRef.alpha(0.3).restart();

    return () => {
      simulationRef?.on("tick", null);
    };
  });

  // Handle resize and container changes
  $effect(() => {
    const canvas = canvasRef;
    if (!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;

    const updateDimensions = () => {
      const { clientWidth, clientHeight } = parent;
      const dpr = window.devicePixelRatio || 1;

      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;

      dimensions = { width: clientWidth, height: clientHeight };
    };

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(parent);
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<canvas bind:this={canvasRef} class="cursor-grab active:cursor-grabbing"></canvas>
