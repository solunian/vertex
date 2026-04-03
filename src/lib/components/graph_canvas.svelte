<script lang="ts">
  import * as d3 from "d3-force";
  import * as d3Zoom from "d3-zoom";
  import * as d3Drag from "d3-drag";
  import { select, pointer } from "d3-selection";
  import type { GraphNode, GraphEdge } from "../graph_types";

  interface GraphCanvasProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
    on_nodeclick: (node: GraphNode) => void;
    on_edgeclick: (edge: GraphEdge) => void;
    on_nodepin: (id: string, forceValue?: boolean) => void;
    highlighted_paths: string[][];
    selected_nodeid?: string;
    selected_edge?: GraphEdge | null;
    reset_zoom_trigger?: number;
    export_trigger?: number;
  }

  let {
    nodes,
    edges,
    on_nodeclick,
    on_edgeclick,
    on_nodepin,
    highlighted_paths,
    selected_nodeid,
    selected_edge,
    reset_zoom_trigger,
    export_trigger = $bindable(),
  }: GraphCanvasProps = $props();

  let canvas_ref = $state<HTMLCanvasElement>();
  let simulation_ref = $state<d3.Simulation<GraphNode, undefined>>();
  let zoom_ref = $state<d3Zoom.ZoomBehavior<HTMLCanvasElement, unknown>>();
  let transform_ref = $state(d3Zoom.zoomIdentity);
  let dimensions = $state({ width: 0, height: 0 });
  let transform = $state(d3Zoom.zoomIdentity);

  // Helper to find node at coordinates
  const find_node_at = (x: number, y: number) => {
    return nodes.find((n) => {
      if (!n.x || !n.y) return false;
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 35; // Increased threshold for larger nodes
    });
  };

  // Helper to find edge at coordinates
  const find_edge_at = (x: number, y: number, k: number) => {
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
    const canvas = canvas_ref;
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
    const t = transform_ref;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Draw grid dots
    const gridSize = 40;
    ctx.fillStyle = "#cbd5e1"; // slate-300
    // Draw grid in a larger area to cover pan
    const startx = Math.floor(-t.x / t.k / gridSize) * gridSize;
    const starty = Math.floor(-t.y / t.k / gridSize) * gridSize;
    const endx = startx + Math.ceil(dimensions.width / t.k) + gridSize * 2;
    const endy = starty + Math.ceil(dimensions.height / t.k) + gridSize * 2;

    for (let x = startx; x <= endx; x += gridSize) {
      for (let y = starty; y <= endy; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / t.k, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw edges
    ctx.shadowBlur = 0;
    edges.forEach((edge) => {
      const src_id = typeof edge.source === "string" ? edge.source : (edge.source as any).id;
      const target_id = typeof edge.target === "string" ? edge.target : (edge.target as any).id;

      const src = nodes.find((n) => n.id === src_id);
      const target = nodes.find((n) => n.id === target_id);

      if (src?.x && src?.y && target?.x && target?.y) {
        const is_highlighted = highlighted_paths.some((path) => {
          for (let i = 0; i < path.length - 1; i++) {
            if (
              (path[i] === src_id && path[i + 1] === target_id) ||
              (path[i] === target_id && path[i + 1] === src_id)
            )
              return true;
          }
          return false;
        });

        const selS = selected_edge
          ? typeof selected_edge.source === "string"
            ? selected_edge.source
            : (selected_edge.source as any).id
          : null;
        const selT = selected_edge
          ? typeof selected_edge.target === "string"
            ? selected_edge.target
            : (selected_edge.target as any).id
          : null;
        const is_selected =
          (selS === src_id && selT === target_id) || (selS === target_id && selT === src_id);

        const weight = edge.weight ?? 5;
        // Thicker for more weight: weight 0 -> 1.5px, weight 9 -> 6px
        const base_width = weight / 2 + 1.5;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(target.x, target.y);

        if (is_selected) {
          ctx.strokeStyle = "#f59e0b"; // amber-500
          ctx.lineWidth = base_width + 2;
        } else if (is_highlighted) {
          ctx.strokeStyle = "#10b981"; // emerald-500
          ctx.lineWidth = base_width + 1;
        } else {
          ctx.strokeStyle = "#e5e7eb"; // slate-200
          ctx.lineWidth = base_width;
        }

        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      if (node.x && node.y) {
        const is_selected = node.id === selected_nodeid;

        // Shadow / Glow
        ctx.shadowBlur = is_selected ? 30 : 8;
        ctx.shadowColor = is_selected ? "rgba(245, 158, 11, 0.8)" : "rgba(0,0,0,0.1)";

        // Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, 2 * Math.PI); // Increased radius to 30
        ctx.fillStyle = is_selected ? "#f59e0b" : "#ffffff";
        ctx.fill();

        ctx.strokeStyle = is_selected ? "#d97706" : "#d1d5db";
        ctx.lineWidth = is_selected ? 5 : 2;
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
        ctx.fillStyle = is_selected ? "#ffffff" : "#1f2937";
        ctx.font = "bold 12px Nova Round"; // Slightly larger font
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
    transform;
    nodes;
    edges;
    render();
  });

  // Initialize zoom and drag
  $effect(() => {
    const canvas = canvas_ref;
    if (!canvas) return;

    const zoom = d3Zoom
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        transform_ref = event.transform;
        transform = event.transform;
      })
      .filter((event) => {
        if (event.button) return false;
        if (event.ctrlKey && event.type !== "wheel") return false;

        if (event.type === "mousedown" || event.type === "touchstart") {
          const [mx, my] = pointer(event, canvas);
          const t = transform_ref;
          const x = (mx - t.x) / t.k;
          const y = (my - t.y) / t.k;

          if (find_node_at(x, y)) return false;
          if (find_edge_at(x, y, t.k)) return false;
        }
        return true;
      });

    const drag = d3Drag
      .drag<HTMLCanvasElement, unknown>()
      .subject((event) => {
        const t = transform_ref;
        const x = (event.x - t.x) / t.k;
        const y = (event.y - t.y) / t.k;
        return find_node_at(x, y);
      })
      .on("start", (event) => {
        if (!event.subject) return;
        on_nodeclick(event.subject);
        if (!simulation_ref) return;
        simulation_ref.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        if (!event.subject) return;
        const canvas = canvas_ref;
        if (!canvas) return;
        const [mx, my] = pointer(event, canvas);
        const t = transform_ref;
        event.subject.fx = (mx - t.x) / t.k;
        event.subject.fy = (my - t.y) / t.k;
      })
      .on("end", (event) => {
        if (!event.subject) return;
        if (!simulation_ref) return;
        simulation_ref.alphaTarget(0);

        // Only keep fixed position if it was already pinned
        if (!event.subject.pinned) {
          event.subject.fx = null;
          event.subject.fy = null;
        } else {
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }
      });

    zoom_ref = zoom;
    const selection = select(canvas);
    selection.call(zoom).call(drag);

    // Handle clicks via D3 to respect defaultPrevented (from drag/zoom)
    selection.on("click", (event) => {
      if (event.defaultPrevented) return;

      const [mx, my] = pointer(event, canvas);
      const t = transform_ref;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;

      const node = find_node_at(x, y);
      if (node) {
        on_nodeclick(node);
      } else {
        const edge = find_edge_at(x, y, t.k);
        if (edge) on_edgeclick(edge);
      }
    });

    selection.on("contextmenu", (event) => {
      event.preventDefault();
      const [mx, my] = pointer(event, canvas);
      const t = transform_ref;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;

      const node = find_node_at(x, y);
      if (node) {
        on_nodepin(node.id);
      }
    });

    return () => {
      selection.on("click", null);
      selection.on("contextmenu", null);
    };
  });

  // Handle reset zoom
  $effect(() => {
    if (reset_zoom_trigger && canvas_ref && zoom_ref) {
      select(canvas_ref).transition().duration(750).call(zoom_ref.transform, d3Zoom.zoomIdentity);
    }
  });

  // Handle Export PNG
  $effect(() => {
    if (export_trigger && export_trigger > 0 && canvas_ref) {
      const canvas = canvas_ref;
      render();
      const link = document.createElement("a");
      link.download = `vertex-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      while (export_trigger > 0) {
        link.click();
        export_trigger -= 1;
      }
    }
  });

  // Initialize simulation
  $effect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    if (!simulation_ref) {
      simulation_ref = d3
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
      simulation_ref.nodes(nodes);
      const linkForce = simulation_ref.force("link") as d3.ForceLink<GraphNode, any>;
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

    simulation_ref
      .force("x", d3.forceX(dimensions.width / 2).strength(0.1))
      .force("y", d3.forceY(dimensions.height / 2).strength(0.1));

    simulation_ref.on("tick", render);
    simulation_ref.alpha(0.3).restart(); // this made the graph rotate and bug out

    return () => {
      simulation_ref?.on("tick", null);
    };
  });

  // Handle resize and container changes
  $effect(() => {
    const canvas = canvas_ref;
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

<canvas bind:this={canvas_ref} class="cursor-grab active:cursor-grabbing"></canvas>
