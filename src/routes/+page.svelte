<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import GitCompare from "@lucide/svelte/icons/git-compare";
  import Info from "@lucide/svelte/icons/info";
  import X from "@lucide/svelte/icons/x";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import Locate from "@lucide/svelte/icons/locate";
  import Download from "@lucide/svelte/icons/download";
  import Pin from "@lucide/svelte/icons/pin";
  import PinOff from "@lucide/svelte/icons/pin-off";

  import GraphCanvas from "$lib/components/graph_canvas.svelte";
  import Legend from "$lib/components/legend.svelte";
  import type { GraphNode, GraphEdge } from "$lib/graph_types";
  import { find_shortest_path } from "$lib/graph_utils";

  const INITIAL_NODES: GraphNode[] = [
    { id: "1", name: "Alice", type: "node" },
    { id: "2", name: "Bob", type: "node" },
    { id: "3", name: "Charlie", type: "node" },
    { id: "4", name: "Eve", type: "node" },
    { id: "6", name: "David", type: "node" },
  ];

  const INITIAL_EDGES: GraphEdge[] = [
    { source: "1", target: "2", weight: 5 },
    { source: "2", target: "3", weight: 5 },
    { source: "3", target: "4", weight: 5 },
    { source: "4", target: "1", weight: 5 },
    { source: "6", target: "1", weight: 5 },
  ];

  let nodes = $state<GraphNode[]>(INITIAL_NODES);
  let edges = $state<GraphEdge[]>(INITIAL_EDGES);

  // History state
  let history = $state<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);
  let redo_stack = $state<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);

  const save_to_history = () => {
    history = [...history, { nodes: [...nodes], edges: [...edges] }];
    redo_stack = []; // Clear redo stack on new action
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    redo_stack = [...redo_stack, { nodes: [...nodes], edges: [...edges] }];
    nodes = previous.nodes;
    edges = previous.edges;
    history = history.slice(0, -1);
  };

  const redo = () => {
    if (redo_stack.length === 0) return;
    const next = redo_stack[redo_stack.length - 1];
    history = [...history, { nodes: [...nodes], edges: [...edges] }];
    nodes = next.nodes;
    edges = next.edges;
    redo_stack = redo_stack.slice(0, -1);
  };

  let selected_node = $state<GraphNode | null>(null);
  let selected_edge = $state<GraphEdge | null>(null);

  const handle_node_click = (node: GraphNode) => {
    selected_node = node;
    selected_edge = null;
  };

  const toggle_node_pin = (id: string, forceValue?: boolean) => {
    save_to_history();
    nodes = nodes.map((n) =>
      n.id === id ? { ...n, pinned: forceValue !== undefined ? forceValue : !n.pinned } : n
    );
    if (selected_node?.id === id) {
      selected_node = selected_node
        ? {
            ...selected_node,
            pinned: forceValue !== undefined ? forceValue : !selected_node.pinned,
          }
        : null;
    }
  };

  const handle_edge_click = (edge: GraphEdge) => {
    selected_edge = edge;
    selected_node = null;
  };

  const handle_update_edge_weight = (weight: number) => {
    if (!selected_edge) return;
    save_to_history();
    edges = edges.map((e) => {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      const selS =
        typeof selected_edge.source === "string"
          ? selected_edge.source
          : (selected_edge.source as any).id;
      const selT =
        typeof selected_edge.target === "string"
          ? selected_edge.target
          : (selected_edge.target as any).id;

      if ((s === selS && t === selT) || (s === selT && t === selS)) {
        return { ...e, weight };
      }
      return e;
    });
    selected_edge = selected_edge ? { ...selected_edge, weight } : null;
  };

  // Keyboard shortcuts
  const handle_keydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Z") {
      redo();
    }
  };

  let path_start = $state<string | null>(null);
  let path_end = $state<string | null>(null);
  let new_node_name = $state("");
  let show_add_node = $state(false);
  let search_query = $state("");
  let reset_zoom_counter = $state(0);
  let export_trigger = $state(0);

  let search_results = $derived.by(() => {
    if (!search_query.trim()) return [];
    const query = search_query.toLowerCase();
    return nodes.filter(
      (n) => n.name.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)
    );
  });

  let highlighted_paths = $derived.by(() => {
    if (path_start && path_end) {
      const path = find_shortest_path(nodes, edges, path_start, path_end);
      return path ? [path] : [];
    }
    return [];
  });

  const handle_add_node = () => {
    if (!new_node_name.trim()) return;
    save_to_history();
    const new_node: GraphNode = {
      id: Math.random().toString(36).substr(2, 9),
      name: new_node_name,
      type: "node",
    };
    nodes = [...nodes, new_node];
    new_node_name = "";
    show_add_node = false;
  };

  const handle_add_edge = (target_id: string) => {
    if (!selected_node || selected_node.id === target_id) return;

    // Check if edge already exists
    const exists = edges.some((e) => {
      const s = typeof e.source === "string" ? e.source : (e.source as any).id;
      const t = typeof e.target === "string" ? e.target : (e.target as any).id;
      return (
        (s === selected_node.id && t === target_id) || (s === target_id && t === selected_node.id)
      );
    });

    if (!exists) {
      save_to_history();
      edges = [...edges, { source: selected_node.id, target: target_id, weight: 5 }];
    }
  };

  const delete_node = (id: string) => {
    save_to_history();
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => {
      const s = typeof e.source === "string" ? e.source : (e.source as any).id;
      const t = typeof e.target === "string" ? e.target : (e.target as any).id;
      return s !== id && t !== id;
    });
    if (selected_node?.id === id) selected_node = null;
    if (path_start === id) path_start = null;
    if (path_end === id) path_end = null;
  };
</script>

<svelte:window on:keydown={handle_keydown} />

<div class="relative flex h-screen w-full overflow-hidden font-sans">
  <!-- Sidebar -->
  <div class="z-20 flex h-full w-80 shrink-0 flex-col gap-4 border-r border-slate-200 shadow-sm">
    <div class="space-y-1 border-b border-slate-200 p-6">
      <div class="flex items-center gap-4">
        <div class="rounded-lg bg-violet-600 p-2">
          <GitCompare class="size-5 text-white" />
        </div>
        <h1 class="font-mono text-3xl font-bold text-slate-900">Vertex</h1>
      </div>
    </div>

    <div class="flex-1 space-y-6 overflow-y-auto px-4">
      <!-- Search Section -->
      <section class="space-y-3">
        <h2 class="flex items-center gap-2 text-slate-800">
          <Search class="size-4" />Search Nodes
        </h2>
        <div class="relative">
          <input
            type="text"
            value={search_query}
            onchange={(e) => (search_query = e.currentTarget.value)}
            placeholder="Search by name or ID..."
            class="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-violet-500" />
          {#if search_query}
            <button
              onclick={() => (search_query = "")}
              class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X class="h-4 w-4" />
            </button>
          {/if}
        </div>

        {#if search_results.length > 0}
          <div
            class="mt-2 max-h-40 divide-y divide-slate-50 overflow-y-auto rounded-lg border border-slate-100 shadow-sm">
            {#each search_results as n}
              <button
                onclick={() => {
                  handle_node_click(n);
                  search_query = "";
                }}
                class="group flex w-full items-center justify-between p-2.5 text-left text-sm transition-colors hover:bg-slate-50">
                <div class="flex flex-col">
                  <span class="font-medium text-slate-700">{n.name}</span>
                  <span class="font-mono text-[10px] text-slate-400">ID: {n.id}</span>
                </div>
                <ArrowRight
                  class="h-3 w-3 text-slate-300 transition-colors group-hover:text-violet-500" />
              </button>
            {/each}
          </div>
        {/if}

        {#if search_query && search_results.length === 0}
          <p class="px-1 text-[10px] text-slate-400 italic">No matches found</p>
        {/if}
      </section>

      <!-- Path Discovery Section -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-slate-800">
            <Search class="size-4" />Path Discovery
          </h2>
          {#if path_start || path_end}
            <button
              onclick={() => {
                path_start = null;
                path_end = null;
              }}
              class="text-sm text-violet-600 hover:underline">
              Clear
            </button>
          {/if}
        </div>
        <div class="grid grid-cols-1 gap-2">
          <div class="relative">
            <select
              value={path_start || ""}
              onchange={(e) => (path_start = e.currentTarget.value || null)}
              class="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Select Start Node...</option>
              {#each nodes as n}
                <option value={n.id}>{n.name}</option>
              {/each}
            </select>
          </div>
          <div class="flex justify-center">
            <ArrowRight class="h-4 w-4 text-slate-400" />
          </div>
          <div class="relative">
            <select
              value={path_end || ""}
              onchange={(e) => (path_end = e.currentTarget.value || null)}
              class="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Select End Node...</option>
              {#each nodes as n}
                <option value={n.id}>{n.name}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if highlighted_paths.length > 0}
          <div class="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p class="text-xs font-medium text-emerald-700">
              Shortest path found! ({highlighted_paths[0].length - 1} steps, total weight: {highlighted_paths[0].reduce(
                (acc, curr, idx, arr) => {
                  if (idx === 0) return 0;
                  const prev = arr[idx - 1];
                  const edge = edges.find((e) => {
                    const s = typeof e.source === "string" ? e.source : (e.source as any).id;
                    const t = typeof e.target === "string" ? e.target : (e.target as any).id;
                    return (s === prev && t === curr) || (s === curr && t === prev);
                  });
                  return acc + (edge?.weight ?? 5);
                },
                0
              )})
            </p>
          </div>
        {/if}
      </section>

      <!--Selected Node Info -->
      {#if selected_node}
        <section class="space-y-4 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-slate-400">
                {selected_node.type}
              </p>
              <h3 class="text-lg">{selected_node.name}</h3>
            </div>
            <button onclick={() => (selected_node = null)} class="text-slate-400 hover:text-white">
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-2 text-sm">
            <p class="**:text-slate-400">Quick Actions</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                onclick={() => toggle_node_pin(selected_node.id)}
                class={[
                  "flex items-center justify-center gap-2 rounded-lg p-2 transition-colors",
                  selected_node.pinned
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-white/10 text-white hover:bg-white/20",
                ]}>
                {#if selected_node.pinned}<PinOff class="h-3 w-3" />{:else}
                  <Pin class="size-3" />{/if}
                {selected_node.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onclick={() => delete_node(selected_node.id)}
                class="flex items-center justify-center gap-2 rounded-lg bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500/20">
                <Trash2 class="size-3" /> Delete
              </button>
            </div>
          </div>

          <div class="border-t border-white/10 pt-2">
            <p class="mb-3 text-xs text-slate-400">Connect to:</p>
            <div class="custom-scrollbar max-h-48 overflow-y-auto pr-1">
              <div class="flex flex-wrap gap-2">
                {#each nodes
                  .filter((n) => n.id !== selected_node.id)
                  .sort((a, b) => {
                    const aConnected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selected_node.id && t === a.id) || (s === a.id && t === selected_node.id);
                    });
                    const bConnected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selected_node.id && t === b.id) || (s === b.id && t === selected_node.id);
                    });
                    if (aConnected && !bConnected) return -1;
                    if (!aConnected && bConnected) return 1;
                    return 0;
                  })
                  .map((n) => {
                    const is_connected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selected_node.id && t === n.id) || (s === n.id && t === selected_node.id);
                    });
                    return [n, is_connected];
                  }) as [n, isConnected]}
                  <button
                    onclick={() => {
                      if (isConnected) {
                        save_to_history();
                        edges = edges.filter((e) => {
                          const s = typeof e.source === "string" ? e.source : (e.source as any).id;
                          const t = typeof e.target === "string" ? e.target : (e.target as any).id;
                          return !(
                            (s === selected_node.id && t === n.id) ||
                            (s === n.id && t === selected_node.id)
                          );
                        });
                      } else {
                        handle_add_edge(n.id);
                      }
                    }}
                    class={[
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all",
                      isConnected
                        ? "border-violet-500/30 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10",
                    ]}>
                    {n.name}
                    {#if isConnected}
                      <X class="h-3 w-3" />
                    {:else}
                      <Plus class="h-3 w-3 opacity-50" />
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </section>
      {:else if selected_edge}
        <section class="space-y-4 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[10px] text-slate-400 uppercase">Relationship</p>
              <h3 class="text-sm">
                {nodes.find(
                  (n) =>
                    n.id ===
                    (typeof selected_edge.source === "string"
                      ? selected_edge.source
                      : (selected_edge.source as any).id)
                )?.name}
                <span class="mx-2 text-slate-500">↔</span>
                {nodes.find(
                  (n) =>
                    n.id ===
                    (typeof selected_edge.target === "string"
                      ? selected_edge.target
                      : (selected_edge.target as any).id)
                )?.name}
              </h3>
            </div>
            <button onclick={() => (selected_edge = null)} class="text-slate-400 hover:text-white">
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs text-slate-400">Connection Weight</p>
              <div class="flex items-center gap-2">
                <span class="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">
                  {selected_edge.weight ?? 5}
                </span>
                <span class="font-mono text-[10px] text-slate-500">
                  ({(selected_edge.weight ?? 5) < 3
                    ? "Thin"
                    : (selected_edge.weight ?? 5) > 6
                      ? "Thick"
                      : "Medium"})
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="9"
              step="1"
              value={selected_edge.weight ?? 5}
              onchange={(e) => handle_update_edge_weight(parseInt(e.currentTarget.value))}
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500" />
            <div class="flex justify-between text-[10px] text-slate-500 uppercase">
              <span>Thin</span>
              <span>Thick</span>
            </div>
          </div>

          <button
            onclick={() => {
              save_to_history();
              edges = edges.filter((e) => e !== selected_edge);
              selected_edge = null;
            }}
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500/20">
            <Trash2 class="h-3 w-3" />
            Remove Link
          </button>
        </section>
      {:else}
        <section
          class="flex flex-col items-center justify-center space-y-3 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
          <div class="rounded-full bg-slate-50 p-6">
            <Info class="h-6 w-6 text-slate-400" />
          </div>
          <div class="space-y-1">
            <h3 class="text-slate-800">No Selection</h3>
            <p class="text-xs text-slate-500">
              Click a node or an edge on the graph to view details or edit properties.
            </p>
          </div>
        </section>
      {/if}
    </div>

    <!-- Add Node Button -->
    <div class="border-t border-slate-100 p-4">
      <button
        onclick={() => (show_add_node = true)}
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 p-3 text-white shadow-md shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95">
        <Plus class="h-4 w-4" /> Add New Node
      </button>
    </div>
  </div>

  <!-- Main Graph Area -->
  <div class="relative h-full flex-1 overflow-hidden bg-white">
    <!-- Undo/Redo Controls -->
    <div class="absolute top-6 left-6 z-20 flex gap-2">
      <button
        onclick={undo}
        disabled={history.length === 0}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
        title="Undo">
        <Undo2 class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
      <button
        onclick={redo}
        disabled={redo_stack.length === 0}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
        title="Redo">
        <Redo2 class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
      <div class="mx-1 h-10 w-px bg-slate-200"></div>
      <button
        onclick={() => (reset_zoom_counter += 1)}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50"
        title="Reset Zoom">
        <Locate class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
      <button
        onclick={() => (export_trigger += 1)}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50"
        title="Export PNG">
        <Download class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
    </div>

    <GraphCanvas
      {nodes}
      {edges}
      onNodeClick={handle_node_click}
      onEdgeClick={handle_edge_click}
      onNodePin={toggle_node_pin}
      highlightedPaths={highlighted_paths}
      selectedNodeId={selected_node?.id}
      selectedEdge={selected_edge}
      resetZoomTrigger={reset_zoom_counter}
      exportTrigger={export_trigger} />

    <Legend />

    <!-- Add Node Modal -->
    {#if show_add_node}
      <div
        class="absolute inset-0 z-50 flex items-center justify-center bg-white/2 backdrop-blur-xl"
        onkeydown={(e) => {
          if (e.key === "Escape") show_add_node = false;
        }}>
        <div class="w-96 space-y-6 rounded-3xl border border-white/20 bg-white p-8 shadow-2xl">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl text-slate-900">Add Node</h2>
            <button
              onclick={() => (show_add_node = false)}
              class="rounded-full p-2 transition-colors hover:bg-slate-100">
              <X class="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs text-slate-400 uppercase">Name</label>
              <input
                autoFocus
                type="text"
                value={new_node_name}
                onchange={(e) => (new_node_name = e.currentTarget.value)}
                onkeydown={(e) => {
                  if (e.key === "Enter" && new_node_name.trim()) {
                    handle_add_node();
                  }
                }}
                placeholder="e.g. John Doe"
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-medium transition-all outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <button
            onclick={handle_add_node}
            disabled={!new_node_name.trim()}
            class="w-full rounded-2xl bg-violet-600 p-4 text-white shadow-lg shadow-violet-100 transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50 disabled:hover:bg-violet-600">
            Create Node
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
