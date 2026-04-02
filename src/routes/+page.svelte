<script lang="ts">
  import {
    Plus,
    Search,
    Network,
    Info,
    X,
    ArrowRight,
    Trash2,
    Undo2,
    Redo2,
    RotateCcw,
    Download,
    Pin,
    PinOff,
  } from "@lucide/svelte";
  import GraphCanvas from "$lib/components/graph_canvas.svelte";
  import type { GraphNode, GraphEdge } from "$lib/graph_types";
  import { findShortestPath } from "$lib/graph_utils";

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
  let redoStack = $state<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);

  const saveToHistory = () => {
    history = [...history, { nodes: [...nodes], edges: [...edges] }];
    redoStack = []; // Clear redo stack on new action
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    redoStack = [...redoStack, { nodes: [...nodes], edges: [...edges] }];
    nodes = previous.nodes;
    edges = previous.edges;
    history = history.slice(0, -1);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    history = [...history, { nodes: [...nodes], edges: [...edges] }];
    nodes = next.nodes;
    edges = next.edges;
    redoStack = redoStack.slice(0, -1);
  };

  let selectedNode = $state<GraphNode | null>(null);
  let selectedEdge = $state<GraphEdge | null>(null);

  const handleNodeClick = (node: GraphNode) => {
    selectedNode = node;
    selectedEdge = null;
  };

  const toggleNodePin = (id: string, forceValue?: boolean) => {
    saveToHistory();
    nodes = nodes.map((n) =>
      n.id === id ? { ...n, pinned: forceValue !== undefined ? forceValue : !n.pinned } : n
    );
    if (selectedNode?.id === id) {
      selectedNode = selectedNode
        ? { ...selectedNode, pinned: forceValue !== undefined ? forceValue : !selectedNode.pinned }
        : null;
    }
  };

  const handleEdgeClick = (edge: GraphEdge) => {
    selectedEdge = edge;
    selectedNode = null;
  };

  const handleUpdateEdgeWeight = (weight: number) => {
    if (!selectedEdge) return;
    saveToHistory();
    edges = edges.map((e) => {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      const selS =
        typeof selectedEdge.source === "string"
          ? selectedEdge.source
          : (selectedEdge.source as any).id;
      const selT =
        typeof selectedEdge.target === "string"
          ? selectedEdge.target
          : (selectedEdge.target as any).id;

      if ((s === selS && t === selT) || (s === selT && t === selS)) {
        return { ...e, weight };
      }
      return e;
    });
    selectedEdge = selectedEdge ? { ...selectedEdge, weight } : null;
  };

  // Keyboard shortcuts
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      [history, redoStack, nodes, edges]; // Dependencies needed for undo/redo to have fresh state

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  let pathStart = $state<string | null>(null);
  let pathEnd = $state<string | null>(null);
  let newNodeName = $state("");
  let showAddNode = $state(false);
  let searchQuery = $state("");
  let resetZoomCounter = $state(0);
  let exportTrigger = $state(0);

  let searchResults = $derived.by(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (n) => n.name.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)
    );
  });

  let highlightedPaths = $derived.by(() => {
    if (pathStart && pathEnd) {
      const path = findShortestPath(nodes, edges, pathStart, pathEnd);
      return path ? [path] : [];
    }
    return [];
  });

  const handleAddNode = () => {
    if (!newNodeName.trim()) return;
    saveToHistory();
    const newNode: GraphNode = {
      id: Math.random().toString(36).substr(2, 9),
      name: newNodeName,
      type: "node",
    };
    nodes = [...nodes, newNode];
    newNodeName = "";
    showAddNode = false;
  };

  const handleAddEdge = (targetId: string) => {
    if (!selectedNode || selectedNode.id === targetId) return;

    // Check if edge already exists
    const exists = edges.some((e) => {
      const s = typeof e.source === "string" ? e.source : (e.source as any).id;
      const t = typeof e.target === "string" ? e.target : (e.target as any).id;
      return (s === selectedNode.id && t === targetId) || (s === targetId && t === selectedNode.id);
    });

    if (!exists) {
      saveToHistory();
      edges = [...edges, { source: selectedNode.id, target: targetId, weight: 5 }];
    }
  };

  const deleteNode = (id: string) => {
    saveToHistory();
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => {
      const s = typeof e.source === "string" ? e.source : (e.source as any).id;
      const t = typeof e.target === "string" ? e.target : (e.target as any).id;
      return s !== id && t !== id;
    });
    if (selectedNode?.id === id) selectedNode = null;
    if (pathStart === id) pathStart = null;
    if (pathEnd === id) pathEnd = null;
  };
</script>

<div class="relative flex h-screen w-full overflow-hidden bg-[#f8fafc] font-sans">
  <!-- Sidebar -->
  <div class="z-20 flex h-full w-80 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
    <div class="border-bottom border-slate-100 p-6">
      <div class="mb-2 flex items-center gap-3">
        <div class="rounded-lg bg-indigo-600 p-2">
          <Network class="h-5 w-5 text-white" />
        </div>
        <h1 class="text-xl font-bold tracking-tight text-nowrap text-slate-900">Nexus Graph</h1>
      </div>
      <p class="text-xs font-semibold tracking-widest text-slate-500 uppercase">
        Relationship Visualizer
      </p>
    </div>

    <div class="flex-1 space-y-6 overflow-y-auto p-4">
      <!-- Search Section -->
      <section class="space-y-3">
        <h2 class="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Search class="h-4 w-4" /> Search Nodes
        </h2>
        <div class="relative">
          <input
            type="text"
            value={searchQuery}
            onchange={(e) => (searchQuery = e.currentTarget.value)}
            placeholder="Search by name or ID..."
            class="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-500" />
          {#if searchQuery}
            <button
              onclick={() => (searchQuery = "")}
              class="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X class="h-4 w-4" />
            </button>
          {/if}
        </div>

        {#if searchResults.length > 0}
          <div
            class="mt-2 max-h-40 divide-y divide-slate-50 overflow-y-auto rounded-lg border border-slate-100 shadow-sm">
            {#each searchResults as n}
              <button
                onclick={() => {
                  handleNodeClick(n);
                  searchQuery = "";
                }}
                class="group flex w-full items-center justify-between p-2.5 text-left text-sm transition-colors hover:bg-slate-50">
                <div class="flex flex-col">
                  <span class="font-medium text-slate-700">{n.name}</span>
                  <span class="font-mono text-[10px] text-slate-400">ID: {n.id}</span>
                </div>
                <ArrowRight
                  class="h-3 w-3 text-slate-300 transition-colors group-hover:text-indigo-500" />
              </button>
            {/each}
          </div>
        {/if}

        {#if searchQuery && searchResults.length === 0}
          <p class="px-1 text-[10px] text-slate-400 italic">No matches found</p>
        {/if}
      </section>

      <!-- Path Discovery Section -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Search class="h-4 w-4" /> Path Discovery
          </h2>
          {#if pathStart || pathEnd}
            <button
              onclick={() => {
                pathStart = null;
                pathEnd = null;
              }}
              class="text-[10px] font-bold tracking-tighter text-indigo-600 uppercase hover:underline">
              Clear
            </button>
          {/if}
        </div>
        <div class="grid grid-cols-1 gap-2">
          <div class="relative">
            <select
              value={pathStart || ""}
              onchange={(e) => (pathStart = e.currentTarget.value || null)}
              class="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-500">
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
              value={pathEnd || ""}
              onchange={(e) => (pathEnd = e.currentTarget.value || null)}
              class="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm transition-all outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select End Node...</option>
              {#each nodes as n}
                <option value={n.id}>{n.name}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if highlightedPaths.length > 0}
          <div class="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p class="text-xs font-medium text-emerald-700">
              Shortest path found! ({highlightedPaths[0].length - 1} steps, total weight: {highlightedPaths[0].reduce(
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
      {#if selectedNode}
        <section class="space-y-4 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {selectedNode.type}
              </p>
              <h3 class="text-lg leading-tight font-bold">{selectedNode.name}</h3>
            </div>
            <button onclick={() => (selectedNode = null)} class="text-slate-400 hover:text-white">
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-2">
            <p class="text-xs text-slate-400">Quick Actions</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                onclick={() => toggleNodePin(selectedNode.id)}
                class={[
                  "flex items-center justify-center gap-2 rounded-lg p-2 text-xs font-bold transition-colors",
                  selectedNode.pinned
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-white/10 text-white hover:bg-white/20",
                ]}>
                {#if selectedNode.pinned}<PinOff class="h-3 w-3" />{:else}
                  <Pin class="h-3 w-3" />{/if}
                {selectedNode.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onclick={() => deleteNode(selectedNode.id)}
                class="flex items-center justify-center gap-2 rounded-lg bg-red-500/10 p-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20">
                <Trash2 class="h-3 w-3" /> Delete
              </button>
            </div>
          </div>

          <div class="border-t border-white/10 pt-2">
            <p class="mb-3 text-xs text-slate-400">Connect to:</p>
            <div class="custom-scrollbar max-h-48 overflow-y-auto pr-1">
              <div class="flex flex-wrap gap-2">
                {#each nodes
                  .filter((n) => n.id !== selectedNode.id)
                  .sort((a, b) => {
                    const aConnected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selectedNode.id && t === a.id) || (s === a.id && t === selectedNode.id);
                    });
                    const bConnected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selectedNode.id && t === b.id) || (s === b.id && t === selectedNode.id);
                    });
                    if (aConnected && !bConnected) return -1;
                    if (!aConnected && bConnected) return 1;
                    return 0;
                  })
                  .map((n) => {
                    const isConnected = edges.some((e) => {
                      const s = typeof e.source === "string" ? e.source : e.source.id;
                      const t = typeof e.target === "string" ? e.target : e.target.id;
                      return (s === selectedNode.id && t === n.id) || (s === n.id && t === selectedNode.id);
                    });
                    return [n, isConnected];
                  }) as [n, isConnected]}
                  <button
                    onclick={() => {
                      if (isConnected) {
                        saveToHistory();
                        edges = edges.filter((e) => {
                          const s = typeof e.source === "string" ? e.source : (e.source as any).id;
                          const t = typeof e.target === "string" ? e.target : (e.target as any).id;
                          return !(
                            (s === selectedNode.id && t === n.id) ||
                            (s === n.id && t === selectedNode.id)
                          );
                        });
                      } else {
                        handleAddEdge(n.id);
                      }
                    }}
                    class={[
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all",
                      isConnected
                        ? "border-indigo-500/30 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
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
      {:else if selectedEdge}
        <section class="space-y-4 rounded-xl bg-slate-900 p-4 text-white shadow-lg">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Relationship
              </p>
              <h3 class="text-sm leading-tight font-bold">
                {nodes.find(
                  (n) =>
                    n.id ===
                    (typeof selectedEdge.source === "string"
                      ? selectedEdge.source
                      : (selectedEdge.source as any).id)
                )?.name}
                <span class="mx-2 text-slate-500">↔</span>
                {nodes.find(
                  (n) =>
                    n.id ===
                    (typeof selectedEdge.target === "string"
                      ? selectedEdge.target
                      : (selectedEdge.target as any).id)
                )?.name}
              </h3>
            </div>
            <button onclick={() => (selectedEdge = null)} class="text-slate-400 hover:text-white">
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs text-slate-400">Connection Weight</p>
              <div class="flex items-center gap-2">
                <span class="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">
                  {selectedEdge.weight ?? 5}
                </span>
                <span class="font-mono text-[10px] text-slate-500">
                  ({(selectedEdge.weight ?? 5) < 3
                    ? "Thin"
                    : (selectedEdge.weight ?? 5) > 6
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
              value={selectedEdge.weight ?? 5}
              onchange={(e) => handleUpdateEdgeWeight(parseInt(e.currentTarget.value))}
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500" />
            <div
              class="flex justify-between text-[10px] font-bold tracking-tighter text-slate-500 uppercase">
              <span>Thin</span>
              <span>Thick</span>
            </div>
          </div>

          <button
            onclick={() => {
              saveToHistory();
              edges = edges.filter((e) => e !== selectedEdge);
              selectedEdge = null;
            }}
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 p-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20">
            <Trash2 class="h-3 w-3" /> Remove Link
          </button>
        </section>
      {:else}
        <section
          class="flex flex-col items-center justify-center space-y-3 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
          <div class="rounded-full bg-slate-50 p-3">
            <div class="rounded-full bg-slate-50 p-3">
              <Info class="h-6 w-6 text-slate-400" />
            </div>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-800">No Selection</h3>
            <p class="mt-1 text-xs text-slate-500">
              Click a node or a link on the graph to view details or edit properties.
            </p>
          </div>
        </section>
      {/if}
    </div>

    <!-- Add Node Button -->
    <div class="border-t border-slate-100 p-4">
      <button
        onclick={() => (showAddNode = true)}
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95">
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
        disabled={redoStack.length === 0}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
        title="Redo">
        <Redo2 class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
      <div class="mx-1 h-10 w-px bg-slate-200" />
      <button
        onclick={() => (resetZoomCounter += 1)}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50"
        title="Reset Zoom">
        <RotateCcw class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
      <button
        onclick={() => (exportTrigger += 1)}
        class="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:bg-slate-50"
        title="Export PNG">
        <Download class="h-5 w-5 text-slate-600 transition-transform group-active:scale-90" />
      </button>
    </div>

    <GraphCanvas
      {nodes}
      {edges}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onNodePin={toggleNodePin}
      {highlightedPaths}
      selectedNodeId={selectedNode?.id}
      {selectedEdge}
      resetZoomTrigger={resetZoomCounter}
      {exportTrigger} />

    <!-- Legend -->
    <div
      class="absolute right-6 bottom-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-xl backdrop-blur-md">
      <p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Legend</p>
      <div class="flex items-center gap-3">
        <div class="h-3 w-3 rounded-full border-2 border-slate-300 bg-white"></div>
        <span class="text-xs font-medium text-slate-600">Node</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="h-3 w-3 rounded-full bg-amber-500"></div>
        <span class="text-xs font-medium text-slate-600">Selected</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="h-3 w-1 rounded-full bg-emerald-500"></div>
        <span class="text-xs font-medium text-slate-600">Path Edge</span>
      </div>
      <div class="mt-1 border-t border-slate-100 pt-2">
        <p class="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Controls</p>
        <p class="text-[10px] leading-tight text-slate-500">
          <span class="font-bold">Right-click</span> node to Pin/Unpin<br />
          <span class="font-bold">Drag</span> node to move
        </p>
      </div>
    </div>

    <!-- Add Node Modal -->
    {#if showAddNode}
      <div
        class="absolute inset-0 z-50 flex items-center justify-center bg-white/2 backdrop-blur-xl"
        onkeydown={(e) => {
          if (e.key === "Escape") showAddNode = false;
        }}>
        <div class="w-96 space-y-6 rounded-3xl border border-white/20 bg-white p-8 shadow-2xl">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-slate-900">Add Node</h2>
            <button
              onclick={() => (showAddNode = false)}
              class="rounded-full p-2 transition-colors hover:bg-slate-100">
              <X class="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-bold tracking-wider text-slate-400 uppercase">Name</label>
              <input
                autoFocus
                type="text"
                value={newNodeName}
                onchange={(e) => (newNodeName = e.currentTarget.value)}
                onkeydown={(e) => {
                  if (e.key === "Enter" && newNodeName.trim()) {
                    handleAddNode();
                  }
                }}
                placeholder="e.g. John Doe"
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-medium transition-all outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <button
            onclick={handleAddNode}
            disabled={!newNodeName.trim()}
            class="w-full rounded-2xl bg-indigo-600 p-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:hover:bg-indigo-600">
            Create Node
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
