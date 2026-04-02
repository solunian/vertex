import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Network, 
  Info, 
  X, 
  ArrowRight,
  UserPlus,
  Link as LinkIcon,
  Trash2,
  Undo2,
  Redo2,
  Maximize,
  Minimize,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Pin,
  PinOff
} from 'lucide-react';
import GraphCanvas from './components/GraphCanvas';
import { GraphNode, GraphEdge, NodeType } from './types';
import { findShortestPath } from './utils/graphUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIAL_NODES: GraphNode[] = [
  { id: '1', name: 'Alice', type: 'node' },
  { id: '2', name: 'Bob', type: 'node' },
  { id: '3', name: 'Charlie', type: 'node' },
  { id: '4', name: 'Eve', type: 'node' },
  { id: '6', name: 'David', type: 'node' },
];

const INITIAL_EDGES: GraphEdge[] = [
  { source: '1', target: '2', weight: 5 },
  { source: '2', target: '3', weight: 5 },
  { source: '3', target: '4', weight: 5 },
  { source: '4', target: '1', weight: 5 },
  { source: '6', target: '1', weight: 5 },
];

export default function App() {
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  
  // History state
  const [history, setHistory] = useState<{ nodes: GraphNode[], edges: GraphEdge[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: GraphNode[], edges: GraphEdge[] }[]>([]);

  const saveToHistory = () => {
    setHistory(prev => [...prev, { nodes: [...nodes], edges: [...edges] }]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, { nodes: [...nodes], edges: [...edges] }]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setHistory(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, { nodes: [...nodes], edges: [...edges] }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const toggleNodePin = (id: string, forceValue?: boolean) => {
    saveToHistory();
    setNodes(prev => prev.map(n => 
      n.id === id ? { ...n, pinned: forceValue !== undefined ? forceValue : !n.pinned } : n
    ));
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, pinned: forceValue !== undefined ? forceValue : !prev.pinned } : null);
    }
  };

  const handleEdgeClick = (edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleUpdateEdgeWeight = (weight: number) => {
    if (!selectedEdge) return;
    saveToHistory();
    setEdges(prev => prev.map(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
      const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
      const selS = typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any).id;
      const selT = typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any).id;
      
      if ((s === selS && t === selT) || (s === selT && t === selS)) {
        return { ...e, weight };
      }
      return e;
    }));
    setSelectedEdge(prev => prev ? { ...prev, weight } : null);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, redoStack, nodes, edges]); // Dependencies needed for undo/redo to have fresh state
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [showAddNode, setShowAddNode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetZoomCounter, setResetZoomCounter] = useState(0);
  const [exportTrigger, setExportTrigger] = useState(0);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return nodes.filter(n => 
      n.name.toLowerCase().includes(query) || 
      n.id.toLowerCase().includes(query)
    );
  }, [nodes, searchQuery]);

  const highlightedPaths = useMemo(() => {
    if (pathStart && pathEnd) {
      const path = findShortestPath(nodes, edges, pathStart, pathEnd);
      return path ? [path] : [];
    }
    return [];
  }, [nodes, edges, pathStart, pathEnd]);

  const handleAddNode = () => {
    if (!newNodeName.trim()) return;
    saveToHistory();
    const newNode: GraphNode = {
      id: Math.random().toString(36).substr(2, 9),
      name: newNodeName,
      type: 'node',
    };
    setNodes([...nodes, newNode]);
    setNewNodeName('');
    setShowAddNode(false);
  };

  const handleAddEdge = (targetId: string) => {
    if (!selectedNode || selectedNode.id === targetId) return;
    
    // Check if edge already exists
    const exists = edges.some(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
      const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
      return (s === selectedNode.id && t === targetId) ||
             (s === targetId && t === selectedNode.id);
    });

    if (!exists) {
      saveToHistory();
      setEdges([...edges, { source: selectedNode.id, target: targetId, weight: 5 }]);
    }
  };

  const deleteNode = (id: string) => {
    saveToHistory();
    setNodes(nodes.filter(n => n.id !== id));
    setEdges(edges.filter(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
      const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
      return s !== id && t !== id;
    }));
    if (selectedNode?.id === id) setSelectedNode(null);
    if (pathStart === id) setPathStart(null);
    if (pathEnd === id) setPathEnd(null);
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden font-sans relative">
      {/* Sidebar */}
      <div className="h-full w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 shrink-0">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Network className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight text-nowrap">Nexus Graph</h1>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Relationship Visualizer</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search Section */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4" /> Search Nodes
            </h2>
            <div className="relative">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50 shadow-sm">
                {searchResults.map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      handleNodeClick(n);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 text-sm flex items-center justify-between group transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{n.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {n.id}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <p className="text-[10px] text-slate-400 italic px-1">No matches found</p>
            )}
          </section>

          {/* Path Discovery Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-4 h-4" /> Path Discovery
              </h2>
              {(pathStart || pathEnd) && (
                <button 
                  onClick={() => { setPathStart(null); setPathEnd(null); }}
                  className="text-[10px] text-indigo-600 hover:underline font-bold uppercase tracking-tighter"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="relative">
                <select 
                  value={pathStart || ''} 
                  onChange={(e) => setPathStart(e.target.value || null)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">Select Start Node...</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="flex justify-center">
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
              <div className="relative">
                <select 
                  value={pathEnd || ''} 
                  onChange={(e) => setPathEnd(e.target.value || null)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">Select End Node...</option>
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </div>
            
            {highlightedPaths.length > 0 && (
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-xs text-emerald-700 font-medium">
                  Shortest path found! ({highlightedPaths[0].length - 1} steps, total weight: {
                    highlightedPaths[0].reduce((acc, curr, idx, arr) => {
                      if (idx === 0) return 0;
                      const prev = arr[idx - 1];
                      const edge = edges.find(e => {
                        const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
                        const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
                        return (s === prev && t === curr) || (s === curr && t === prev);
                      });
                      return acc + (edge?.weight ?? 5);
                    }, 0)
                  })
                </p>
              </div>
            )}
          </section>

          {/* Selected Node Info */}
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.section
                key={selectedNode.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-slate-900 rounded-xl text-white space-y-4 shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{selectedNode.type}</p>
                    <h3 className="text-lg font-bold leading-tight">{selectedNode.name}</h3>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => toggleNodePin(selectedNode.id)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-colors",
                        selectedNode.pinned 
                          ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" 
                          : "bg-white/10 hover:bg-white/20 text-white"
                      )}
                    >
                      {selectedNode.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      {selectedNode.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button 
                      onClick={() => deleteNode(selectedNode.id)}
                      className="flex items-center justify-center gap-2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-slate-400 mb-3">Connect to:</p>
                  <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="flex flex-wrap gap-2">
                      {nodes
                        .filter(n => n.id !== selectedNode.id)
                        .sort((a, b) => {
                          const aConnected = edges.some(e => {
                            const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
                            const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
                            return (s === selectedNode.id && t === a.id) || (s === a.id && t === selectedNode.id);
                          });
                          const bConnected = edges.some(e => {
                            const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
                            const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
                            return (s === selectedNode.id && t === b.id) || (s === b.id && t === selectedNode.id);
                          });
                          if (aConnected && !bConnected) return -1;
                          if (!aConnected && bConnected) return 1;
                          return 0;
                        })
                        .map(n => {
                          const isConnected = edges.some(e => {
                            const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
                            const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
                            return (s === selectedNode.id && t === n.id) || (s === n.id && t === selectedNode.id);
                          });

                          return (
                            <button 
                              key={n.id}
                              onClick={() => {
                                if (isConnected) {
                                  saveToHistory();
                                  setEdges(prev => prev.filter(e => {
                                    const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
                                    const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
                                    return !((s === selectedNode.id && t === n.id) || (s === n.id && t === selectedNode.id));
                                  }));
                                } else {
                                  handleAddEdge(n.id);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 border",
                                isConnected 
                                  ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30" 
                                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                              )}
                            >
                              {n.name}
                              {isConnected ? (
                                <X className="w-3 h-3" />
                              ) : (
                                <Plus className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          );
                        })
                      }
                    </div>
                  </div>
                </div>
              </motion.section>
            ) : selectedEdge ? (
              <motion.section
                key={`edge-${typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any).id}-${typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any).id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-slate-900 rounded-xl text-white space-y-4 shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Relationship</p>
                    <h3 className="text-sm font-bold leading-tight">
                      {nodes.find(n => n.id === (typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any).id))?.name} 
                      <span className="mx-2 text-slate-500">↔</span>
                      {nodes.find(n => n.id === (typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any).id))?.name}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedEdge(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-400">Connection Weight</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                        {selectedEdge.weight ?? 5}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({(selectedEdge.weight ?? 5) < 3 ? 'Thin' : (selectedEdge.weight ?? 5) > 6 ? 'Thick' : 'Medium'})
                      </span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="9" 
                    step="1"
                    value={selectedEdge.weight ?? 5}
                    onChange={(e) => handleUpdateEdgeWeight(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                    <span>Thin</span>
                    <span>Thick</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    saveToHistory();
                    setEdges(prev => prev.filter(e => e !== selectedEdge));
                    setSelectedEdge(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove Link
                </button>
              </motion.section>
            ) : (
              <section className="p-6 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 bg-slate-50 rounded-full">
                  <div className="p-3 bg-slate-50 rounded-full">
                    <Info className="w-6 h-6 text-slate-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">No Selection</h3>
                  <p className="text-xs text-slate-500 mt-1">Click a node or a link on the graph to view details or edit properties.</p>
                </div>
              </section>
            )}
          </AnimatePresence>
        </div>

        {/* Add Node Button */}
        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setShowAddNode(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add New Node
          </button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 h-full relative bg-white overflow-hidden">
        {/* Undo/Redo Controls */}
        <div className="absolute top-6 left-6 flex gap-2 z-20">
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all group"
            title="Undo"
          >
            <Undo2 className="w-5 h-5 text-slate-600 group-active:scale-90 transition-transform" />
          </button>
          <button 
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all group"
            title="Redo"
          >
            <Redo2 className="w-5 h-5 text-slate-600 group-active:scale-90 transition-transform" />
          </button>
          <div className="w-px h-10 bg-slate-200 mx-1" />
          <button 
            onClick={() => setResetZoomCounter(prev => prev + 1)}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all group"
            title="Reset Zoom"
          >
            <RotateCcw className="w-5 h-5 text-slate-600 group-active:scale-90 transition-transform" />
          </button>
          <button 
            onClick={() => setExportTrigger(prev => prev + 1)}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all group"
            title="Export PNG"
          >
            <Download className="w-5 h-5 text-slate-600 group-active:scale-90 transition-transform" />
          </button>
        </div>

        <GraphCanvas 
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodePin={toggleNodePin}
          highlightedPaths={highlightedPaths}
          selectedNodeId={selectedNode?.id}
          selectedEdge={selectedEdge}
          resetZoomTrigger={resetZoomCounter}
          exportTrigger={exportTrigger}
        />

        {/* Legend */}
        <div className="absolute bottom-6 right-6 p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl flex flex-col gap-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Legend</p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div>
            <span className="text-xs font-medium text-slate-600">Node</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs font-medium text-slate-600">Selected</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-xs font-medium text-slate-600">Path Edge</span>
          </div>
          <div className="mt-1 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Controls</p>
            <p className="text-[10px] text-slate-500 leading-tight">
              <span className="font-bold">Right-click</span> node to Pin/Unpin<br/>
              <span className="font-bold">Drag</span> node to move
            </p>
          </div>
        </div>

      {/* Add Node Modal */}
        <AnimatePresence>
          {showAddNode && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-white/[0.02] backdrop-blur-xl"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowAddNode(false);
              }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white p-8 rounded-3xl shadow-2xl w-96 space-y-6 border border-white/20"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Add Node</h2>
                  <button onClick={() => setShowAddNode(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newNodeName}
                      onChange={(e) => setNewNodeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newNodeName.trim()) {
                          handleAddNode();
                        }
                      }}
                      placeholder="e.g. John Doe"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddNode}
                  disabled={!newNodeName.trim()}
                  className="w-full p-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95"
                >
                  Create Node
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
