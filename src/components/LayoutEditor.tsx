import React, { useRef, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group, Transformer } from 'react-konva';
import { useStore } from '../store/useStore';
import { useAnalyzerStore } from '../store/useAnalyzerStore';

// Helper to get color between blue (cold) and red (hot)
const getHeatmapColor = (value: number, max: number) => {
  if (max === 0 || value === 0) return '#3b82f6'; // blue-500
  const ratio = Math.min(1, value / max);
  // Blue -> Cyan -> Green -> Yellow -> Red
  const hue = ((1 - ratio) * 240).toString(10);
  return `hsl(${hue}, 100%, 50%)`;
};

export const LayoutEditor: React.FC = () => {
  const { branches, activeBranchId, selectedShapeIds, setSelectedShapeId, searchQuery, articles, isEditMode, activeLevel, currentUserRole, viewMode } = useStore();
  const isAdmin = currentUserRole === 'ADMIN';
  const inventoryRecords = useAnalyzerStore(state => state.inventoryRecords);

  const maxExits = useMemo(() => {
    return inventoryRecords.reduce((max, r) => Math.max(max, r.exits || 0), 0);
  }, [inventoryRecords]);

  const getRackStatusColor = (rack: any) => {
    if (selectedShapeIds.includes(rack.id)) return '#3b82f6'; // Selected Blue
    if (!rack.cells || rack.cells.length === 0) {
       return viewMode === 'EMPTY' ? '#22c55e' : '#0f172a'; // Green if searching empty, else Slate
    }
    
    let hasRed = false, hasYellow = false, hasGreen = false, hasUnknown = false;
    let hasMatch = false;
    let isEmpty = true;
    let maxRackExits = 0;

    rack.cells.forEach((cell: any) => {
      const items = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{ articleId: cell.articleId }] : []);
      if (items.length > 0) isEmpty = false;
      
      items.forEach((item: any) => {
        if (item.articleId) {
          if (searchQuery && item.articleId.toLowerCase().includes(searchQuery.toLowerCase())) {
            hasMatch = true;
          }
          
          if (viewMode === 'HEATMAP') {
            const record = inventoryRecords.find(r => r.id === item.articleId);
            if (record) {
               maxRackExits = Math.max(maxRackExits, record.exits || 0);
            }
          }

          const art = articles.find(a => a.id === item.articleId);
          if (art) {
            if (searchQuery && art.description && art.description.toLowerCase().includes(searchQuery.toLowerCase())) {
              hasMatch = true;
            }
            if (art.status === 'SCRAP' || art.status === 'DAMAGED') hasRed = true;
            else if (art.status === 'SLOW' || art.status === 'OFFLINE') hasYellow = true;
            else hasGreen = true;
          } else {
            hasUnknown = true;
          }
        }
      });
    });

    if (searchQuery) {
       if (!hasMatch) return '#cbd5e1'; // light slate
       return '#a855f7'; // highlight purple for matches!
    }

    if (viewMode === 'DISABLED') return rack.color || '#0f172a';
    
    if (viewMode === 'EMPTY') {
       return isEmpty ? '#22c55e' : '#cbd5e1'; // Green if empty, else dimmed
    }
    
    if (viewMode === 'UNKNOWN') {
       return hasUnknown ? '#06b6d4' : '#cbd5e1'; // Cyan if unknown, else dimmed
    }
    
    if (viewMode === 'HEATMAP') {
       if (isEmpty) return '#cbd5e1';
       return getHeatmapColor(maxRackExits, maxExits);
    }

    // DEFAULT MODE
    if (hasRed) return '#ef4444';
    if (hasYellow) return '#facc15';
    if (hasUnknown) return '#06b6d4';
    if (hasGreen) return '#22c55e';
    
    return rack.color || '#0f172a';
  };

  const branch = branches.find(b => b.id === activeBranchId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth - 384, height: window.innerHeight });
  const [stageScale, setStageScale] = useState(window.innerWidth < 768 ? 0.3 : 1);
  const [stagePos, setStagePos] = useState({ x: window.innerWidth < 768 ? 20 : 50, y: window.innerWidth < 768 ? 140 : 50 }); // Start slightly offset to see room border and clear mobile toolbar
  const [hasAutoZoomedInit, setHasAutoZoomedInit] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  const getRelativePointerPosition = (node: any) => {
    const transform = node.getAbsoluteTransform().copy();
    transform.invert();
    const pos = node.getStage().getPointerPosition();
    return transform.point(pos);
  };

  const handleStageMouseDown = (e: any) => {
    // If we click on an empty area AND we hold Ctrl, start selection
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.id() === 'branch-bg';
    if (clickedOnEmpty) {
      if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
        // Start selection
        e.target.getStage().draggable(false);
        const pos = getRelativePointerPosition(layerRef.current);
        if (pos) {
          setSelectionRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        }
      } else {
        useStore.getState().setSelectedShapeId(null);
        e.target.getStage().draggable(true);
      }
    }
  };

  const handleStageMouseMove = () => {
    if (selectionRect && layerRef.current) {
      const pos = getRelativePointerPosition(layerRef.current);
      if (pos) {
        setSelectionRect(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
      }
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (selectionRect && layerRef.current) {
      const stage = e.target.getStage();
      stage.draggable(true);
      
      const box = {
        x: Math.min(selectionRect.x1, selectionRect.x2),
        y: Math.min(selectionRect.y1, selectionRect.y2),
        width: Math.abs(selectionRect.x1 - selectionRect.x2),
        height: Math.abs(selectionRect.y1 - selectionRect.y2),
      };

      if (box.width > 5 && box.height > 5 && branch) {
        const newSelectedIds: string[] = [];
        
        // Find all shapes that intersect with the box
        // We will check all Racks, Areas, and Rooms.
        const allSelectableIds: string[] = [];
        branch.rooms.forEach(r => {
           allSelectableIds.push(r.id);
           r.areas.forEach(a => {
              allSelectableIds.push(a.id);
              a.racks.forEach(rk => allSelectableIds.push(rk.id));
           });
           r.racks.forEach(rk => allSelectableIds.push(rk.id));
        });

        allSelectableIds.forEach(id => {
           const node = layerRef.current.findOne(`#${id}`);
           if (node) {
             const nodeRect = node.getClientRect({ relativeTo: layerRef.current });
             // Check intersection
             if (!(
                nodeRect.x > box.x + box.width ||
                nodeRect.x + nodeRect.width < box.x ||
                nodeRect.y > box.y + box.height ||
                nodeRect.y + nodeRect.height < box.y
             )) {
               newSelectedIds.push(id);
             }
           }
        });

        useStore.getState().setSelectedShapeIds(newSelectedIds);
      }
      setSelectionRect(null);
    }
  };

  React.useEffect(() => {
    if (!branch || !containerRef.current || hasAutoZoomedInit) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (cw === 0 || ch === 0) return;
    
    const bWidth = branch.width || 2000;
    const bHeight = branch.height || 1500;
    
    // Calculate scale to fit with a bit of padding (0.9)
    const fitScale = Math.min(cw / bWidth, ch / bHeight) * 0.9;
    setStageScale(fitScale);
    
    // Center it
    setStagePos({
      x: (cw - bWidth * fitScale) / 2,
      y: (ch - bHeight * fitScale) / 2
    });
    setHasAutoZoomedInit(true);
  }, [branch, hasAutoZoomedInit, dimensions]);

  // Auto zoom on search match
  React.useEffect(() => {
    if (!searchQuery || !branch) return;
    
    // Find first matching rack
    let targetRack: any = null;
    let targetRackAbsX = 0;
    let targetRackAbsY = 0;

    for (const r of branch.rooms.filter(room => (room.level || 0) === activeLevel)) {
      const allRacks = [...r.racks];
      r.areas.forEach(a => allRacks.push(...a.racks));
      
      for (const rack of allRacks) {
        let hasMatch = false;
        rack.cells?.forEach((cell: any) => {
          const items = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{ articleId: cell.articleId }] : []);
          items.forEach((item: any) => {
            if (item.articleId && item.articleId.toLowerCase().includes(searchQuery.toLowerCase())) {
              hasMatch = true;
            }
            const art = articles.find(a => a.id === item.articleId);
            if (art && art.description && art.description.toLowerCase().includes(searchQuery.toLowerCase())) {
              hasMatch = true;
            }
          });
        });

        if (hasMatch) {
          targetRack = rack;
          // Calculate absolute position roughly
          // rack.x is relative to its parent (Room or Area)
          // To be precise we need Area + Room or Room coords.
          let absX = (r.x || 50);
          let absY = (r.y || 50);
          
          // If rack is inside an area, add area coords
          const parentArea = r.areas.find(a => a.racks.some(ar => ar.id === rack.id));
          if (parentArea) {
            absX += parentArea.x;
            absY += parentArea.y;
          }
          absX += rack.x;
          absY += rack.y;
          
          targetRackAbsX = absX;
          targetRackAbsY = absY;
          break; // Stop at first match
        }
      }
      if (targetRack) break;
    }

    if (targetRack) {
      // Zoom in
      const newScale = 1.2;
      setStageScale(newScale);
      
      // Center the rack in the viewport
      const viewportW = containerRef.current ? containerRef.current.clientWidth : window.innerWidth;
      const viewportH = containerRef.current ? containerRef.current.clientHeight : window.innerHeight;
      
      setStagePos({
        x: (viewportW / 2) - (targetRackAbsX * newScale),
        y: (viewportH / 2) - (targetRackAbsY * newScale)
      });
      
      setSelectedShapeId(targetRack.id);
    }
  }, [searchQuery, branch, activeLevel, articles]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const PAN_STEP = 50;
      if (e.code === 'Space') {
        e.preventDefault();
        setStagePos({ x: 50, y: 50 }); // Center/Reset
        setStageScale(1);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setStagePos(p => ({ ...p, y: p.y + PAN_STEP }));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setStagePos(p => ({ ...p, y: p.y - PAN_STEP }));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setStagePos(p => ({ ...p, x: p.x + PAN_STEP }));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setStagePos(p => ({ ...p, x: p.x - PAN_STEP }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    
    // Pinch to zoom or Ctrl+Scroll
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const mousePointTo = {
        x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
        y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
      };

      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setStageScale(newScale);
      setStagePos({
        x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
        y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
      });
    } else {
      // Trackpad panning or normal mouse wheel panning
      setStagePos(p => ({
        x: p.x - e.evt.deltaX,
        y: p.y - e.evt.deltaY
      }));
    }
  };

  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const dragStartNodes = useRef<Record<string, {x: number, y: number}>>({});

  React.useEffect(() => {
    if (isEditMode && isAdmin && selectedShapeIds && selectedShapeIds.length > 0 && trRef.current && layerRef.current) {
      const nodes = selectedShapeIds.map(id => layerRef.current.findOne(`#${id}`)).filter((node: any) => node && node.draggable());
      if (nodes.length > 0) {
        trRef.current.nodes(nodes);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedShapeIds, isEditMode, isAdmin]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!branch) return <div className="p-4">Seleccione una sucursal</div>;

  const GRID_SIZE = 50; // Visual grid
  const SNAP_SIZE = 10; // Drag snap step
  const snapToGrid = function(this: any, pos: any) {
    if (!this || !this.getParent) return pos; // Fallback
    // Convert proposed absolute pos to relative pos
    const transform = this.getParent().getAbsoluteTransform().copy();
    transform.invert();
    const relativePos = transform.point(pos);
    
    // Snap relative position
    const snappedRelX = Math.round(relativePos.x / SNAP_SIZE) * SNAP_SIZE;
    const snappedRelY = Math.round(relativePos.y / SNAP_SIZE) * SNAP_SIZE;
    
    // Convert back to absolute
    const absoluteTransform = this.getParent().getAbsoluteTransform();
    return absoluteTransform.point({ x: snappedRelX, y: snappedRelY });
  };

  const branchWidth = branch.width || 2000;
  const branchHeight = branch.height || 1500;
  const gridLines = [];
  for (let i = 0; i < branchWidth / GRID_SIZE; i++) {
    gridLines.push(<Rect key={`v-${i}`} x={i * GRID_SIZE} y={0} width={1} height={branchHeight} fill="rgba(0,0,0,0.05)" listening={false} />);
  }
  for (let i = 0; i < branchHeight / GRID_SIZE; i++) {
    gridLines.push(<Rect key={`h-${i}`} x={0} y={i * GRID_SIZE} width={branchWidth} height={1} fill="rgba(0,0,0,0.05)" listening={false} />);
  }

  return (
    <div className="w-full h-full bg-slate-200 overflow-hidden outline-none relative" ref={containerRef} tabIndex={0}>
      <div className="absolute bottom-20 left-4 md:bottom-4 flex flex-col gap-2 z-10 pointer-events-auto">
        <button className="bg-white/90 backdrop-blur shadow-md w-10 h-10 flex items-center justify-center rounded-full text-slate-700 font-bold text-xl" onClick={(e) => { e.preventDefault(); setStageScale(s => s * 1.2); }}>+</button>
        <button className="bg-white/90 backdrop-blur shadow-md w-10 h-10 flex items-center justify-center rounded-full text-slate-700 font-bold text-xl" onClick={(e) => { e.preventDefault(); setStageScale(s => s / 1.2); }}>-</button>
      </div>
      <Stage 
        width={dimensions.width} 
        height={dimensions.height} 
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
        onWheel={handleWheel}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
             setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
      >
        <Layer ref={layerRef}>
          {/* Terreno / Branch */}
          <Rect
            id="branch-bg"
            x={0}
            y={0}
            width={branchWidth}
            height={branchHeight}
            fill="#e2e8f0"
            stroke="#64748b"
            strokeWidth={4}
            listening={true}
            onClick={(e) => { e.cancelBubble = true; setSelectedShapeId(branch.id); }}
            onTap={(e) => { e.cancelBubble = true; setSelectedShapeId(branch.id); }}
          />
          {gridLines}
          <Text x={10} y={10} text={`Terreno: ${branch.name} (${branchWidth}x${branchHeight}cm)`} fontSize={24} fill="#475569" listening={false} />

          {/* Rooms */}
          {branch.rooms.filter(room => (room.level || 0) <= activeLevel).sort((a, b) => (a.level || 0) - (b.level || 0)).map(room => {
            const isLowerFloor = (room.level || 0) < activeLevel;
            return (
            <Group 
              key={room.id} 
              id={room.id} 
              x={room.x || 50} 
              y={room.y || 50} 
              opacity={isLowerFloor ? 0.3 : 1}
              listening={!isLowerFloor}
              draggable={!isLowerFloor && isEditMode && isAdmin && !room.isLocked} dragBoundFunc={snapToGrid}
              onClick={(e) => { e.cancelBubble = true; setSelectedShapeId(room.id); }}
              onTap={(e) => { e.cancelBubble = true; setSelectedShapeId(room.id); }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                if (e.target.id() === room.id) {
                  useStore.getState().updateRoomPosition(branch.id, room.id, Math.round(e.target.x()), Math.round(e.target.y()));
                }
              }}
              onTransform={(e) => {
                const node = e.target;
                if (node.id() === room.id) {
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const w = Math.round(Math.max(10, (room.width || 1000) * scaleX));
                  const h = Math.round(Math.max(10, (room.height || 800) * scaleY));
                  useStore.getState().updateRoomProperties(room.id, { width: w, height: h, x: node.x(), y: node.y() });
                }
              }}
            >
              <Rect
                width={room.width || 1000}
                height={room.height || 800}
                fill={room.color || "#ffffff"}
                opacity={0.6}
                stroke={selectedShapeIds.includes(room.id) ? "#3b82f6" : "#94a3b8"}
                strokeWidth={selectedShapeIds.includes(room.id) ? 4 : 2}
                dash={[10, 10]}
              />
              <Text x={10} y={10} text={room.name} fontSize={20} fill="#64748b" />
              {selectedShapeIds.includes(room.id) && (
                <Text x={10} y={35} text={`L: ${Math.round(room.width || 1000)}cm x F: ${Math.round(room.height || 800)}cm`} fontSize={14} fill="#2563eb" fontStyle="bold" />
              )}
              
              {/* Areas */}
              {room.areas.map(area => (
                <Group 
                  key={area.id} 
                  id={area.id} 
                  x={area.x} 
                  y={area.y} 
                  draggable={isEditMode && isAdmin && !area.isLocked} dragBoundFunc={snapToGrid}
                  onClick={(e) => { 
                    e.cancelBubble = true; 
                    if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
                       useStore.getState().toggleShapeSelection(area.id);
                    } else {
                       setSelectedShapeId(area.id); 
                    }
                  }}
                  onTap={(e) => { 
                    e.cancelBubble = true; 
                    if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
                       useStore.getState().toggleShapeSelection(area.id);
                    } else {
                       setSelectedShapeId(area.id); 
                    }
                  }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    if (e.target.id() === area.id) {
                      useStore.getState().updateAreaPosition(branch.id, room.id, area.id, Math.round(e.target.x()), Math.round(e.target.y()));
                    }
                  }}
                  onTransform={(e) => {
                    const node = e.target;
                    if (node.id() === area.id) {
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      const w = Math.round(Math.max(10, area.width * scaleX));
                      const h = Math.round(Math.max(10, area.height * scaleY));
                      useStore.getState().updateAreaProperties(area.id, { width: w, height: h, x: node.x(), y: node.y() });
                    }
                  }}
                >
                  <Rect
                    width={area.width}
                    height={area.height}
                    fill={area.color || "rgba(255, 255, 0, 0.2)"}
                    opacity={0.6}
                    stroke={selectedShapeIds.includes(area.id) ? "#3b82f6" : "#cbd5e1"}
                    strokeWidth={selectedShapeIds.includes(area.id) ? 3 : 1}
                    dash={[5, 5]}
                  />
                  <Text x={5} y={5} text={area.name} fontSize={16} fill="#475569" />
                  {selectedShapeIds.includes(area.id) && (
                    <Text x={5} y={25} text={`L: ${Math.round(area.width)}cm x F: ${Math.round(area.height)}cm`} fontSize={14} fill="#2563eb" fontStyle="bold" />
                  )}
                  
                  {/* Racks in Area */}
                  {area.racks.map(rack => (
                      <Group
                        key={rack.id}
                        id={rack.id}
                        x={rack.x}
                        y={rack.y}
                        rotation={rack.rotation}
                        draggable={isEditMode && isAdmin && !rack.isLocked} dragBoundFunc={snapToGrid}
                        onClick={(e) => { 
                          e.cancelBubble = true; 
                          if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
                             useStore.getState().toggleShapeSelection(rack.id);
                          } else {
                             setSelectedShapeId(rack.id); 
                          }
                        }}
                        onTap={(e) => { 
                          e.cancelBubble = true; 
                          if (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey) {
                             useStore.getState().toggleShapeSelection(rack.id);
                          } else {
                             setSelectedShapeId(rack.id); 
                          }
                        }}
                        onDblClick={(e) => { e.cancelBubble = true; useStore.getState().setActiveRack(rack.id); }}
                        onDblTap={(e) => { e.cancelBubble = true; useStore.getState().setActiveRack(rack.id); }}
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          if (selectedShapeIds.includes(rack.id)) {
                            dragStartNodes.current = {};
                            selectedShapeIds.forEach(id => {
                              const node = layerRef.current?.findOne(`#${id}`);
                              if (node) dragStartNodes.current[id] = { x: node.x(), y: node.y() };
                            });
                          }
                        }}
                        onDragMove={(e) => {
                          if (selectedShapeIds.includes(rack.id) && dragStartNodes.current[rack.id]) {
                            const dx = e.target.x() - dragStartNodes.current[rack.id].x;
                            const dy = e.target.y() - dragStartNodes.current[rack.id].y;
                            selectedShapeIds.forEach(id => {
                              if (id !== rack.id && dragStartNodes.current[id]) {
                                const node = layerRef.current?.findOne(`#${id}`);
                                if (node) {
                                  node.x(dragStartNodes.current[id].x + dx);
                                  node.y(dragStartNodes.current[id].y + dy);
                                }
                              }
                            });
                          }
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          if (e.target.id() === rack.id) {
                            if (selectedShapeIds.includes(rack.id) && dragStartNodes.current[rack.id]) {
                              const dx = e.target.x() - dragStartNodes.current[rack.id].x;
                              const dy = e.target.y() - dragStartNodes.current[rack.id].y;
                              useStore.getState().moveShapesByDelta(selectedShapeIds, Math.round(dx), Math.round(dy));
                            } else {
                              useStore.getState().updateRackPosition(branch.id, room.id, area.id, rack.id, Math.round(e.target.x()), Math.round(e.target.y()), e.target.rotation());
                            }
                          }
                        }}
                        onTransform={(e) => {
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          node.scaleX(1);
                          node.scaleY(1);
                          const newWidth = Math.max(5, rack.width * scaleX);
                          const newDepth = Math.max(5, rack.depth * scaleY);
                          useStore.getState().updateRackProperties(rack.id, { 
                            width: Math.round(newWidth), 
                            depth: Math.round(newDepth),
                            rotation: node.rotation(),
                            x: Math.round(node.x()),
                            y: Math.round(node.y())
                          });
                        }}
                        onTransformEnd={(e) => {
                          const node = e.target;
                          useStore.getState().updateRackPosition(branch.id, room.id, area.id, rack.id, node.x(), node.y(), node.rotation());
                        }}
                      >
                        <Rect
                          width={rack.width}
                          height={rack.depth}
                          fill={getRackStatusColor(rack)}
                        />
                        <Text x={5} y={5} text={rack.name} fontSize={14} fill="#ffffff" />
                        {selectedShapeIds.includes(rack.id) && (
                          <Text x={0} y={-20} text={`L: ${Math.round(rack.width)}cm x F: ${Math.round(rack.depth)}cm | Rot: ${Math.round(rack.rotation)}°`} fontSize={12} fill="#ef4444" fontStyle="bold" />
                        )}
                      </Group>
                  ))}
                </Group>
              ))}

              {/* Racks outside areas but in room */}
              {room.racks.map(rack => (
                 <Group
                 key={rack.id}
                 id={rack.id}
                 x={rack.x}
                 y={rack.y}
                 rotation={rack.rotation}
                 draggable={isEditMode && isAdmin && !rack.isLocked} dragBoundFunc={snapToGrid}
                 onClick={(e) => { e.cancelBubble = true; setSelectedShapeId(rack.id); }}
                 onTap={(e) => { e.cancelBubble = true; setSelectedShapeId(rack.id); }}
                 onDblClick={(e) => { e.cancelBubble = true; useStore.getState().setActiveRack(rack.id); }}
                 onDblTap={(e) => { e.cancelBubble = true; useStore.getState().setActiveRack(rack.id); }}
                 onDragStart={(e) => {
                   e.cancelBubble = true;
                   if (selectedShapeIds.includes(rack.id)) {
                     dragStartNodes.current = {};
                     selectedShapeIds.forEach(id => {
                       const node = layerRef.current?.findOne(`#${id}`);
                       if (node) dragStartNodes.current[id] = { x: node.x(), y: node.y() };
                     });
                   }
                 }}
                 onDragMove={(e) => {
                   if (selectedShapeIds.includes(rack.id) && dragStartNodes.current[rack.id]) {
                     const dx = e.target.x() - dragStartNodes.current[rack.id].x;
                     const dy = e.target.y() - dragStartNodes.current[rack.id].y;
                     selectedShapeIds.forEach(id => {
                       if (id !== rack.id && dragStartNodes.current[id]) {
                         const node = layerRef.current?.findOne(`#${id}`);
                         if (node) {
                           node.x(dragStartNodes.current[id].x + dx);
                           node.y(dragStartNodes.current[id].y + dy);
                         }
                       }
                     });
                   }
                 }}
                 onDragEnd={(e) => {
                   e.cancelBubble = true;
                   if (e.target.id() === rack.id) {
                     if (selectedShapeIds.includes(rack.id) && dragStartNodes.current[rack.id]) {
                       const dx = e.target.x() - dragStartNodes.current[rack.id].x;
                       const dy = e.target.y() - dragStartNodes.current[rack.id].y;
                       useStore.getState().moveShapesByDelta(selectedShapeIds, Math.round(dx), Math.round(dy));
                     } else {
                       useStore.getState().updateRackPosition(branch.id, room.id, null, rack.id, Math.round(e.target.x()), Math.round(e.target.y()), e.target.rotation());
                     }
                   }
                 }}
                 onTransform={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    const newWidth = Math.max(5, rack.width * scaleX);
                    const newDepth = Math.max(5, rack.depth * scaleY);
                    useStore.getState().updateRackProperties(rack.id, { 
                      width: Math.round(newWidth), 
                      depth: Math.round(newDepth),
                      rotation: node.rotation(),
                      x: Math.round(node.x()),
                      y: Math.round(node.y())
                    });
                 }}
                 onTransformEnd={(e) => {
                    const node = e.target;
                    useStore.getState().updateRackPosition(branch.id, room.id, null, rack.id, node.x(), node.y(), node.rotation());
                 }}
               >
                 <Rect
                   width={rack.width}
                   height={rack.depth}
                   fill={getRackStatusColor(rack)}
                 />
                 <Text x={5} y={5} text={rack.name} fontSize={14} fill="#ffffff" />
                 {selectedShapeIds.includes(rack.id) && (
                   <Text x={0} y={-20} text={`L: ${Math.round(rack.width)}cm x F: ${Math.round(rack.depth)}cm | Rot: ${Math.round(rack.rotation)}°`} fontSize={12} fill="#ef4444" fontStyle="bold" />
                 )}
               </Group>
              ))}
            </Group>
            );
          })}
          
          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.abs(selectionRect.x1 - selectionRect.x2)}
              height={Math.abs(selectionRect.y1 - selectionRect.y2)}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={1}
              listening={false}
            />
          )}

          <Transformer  
            ref={trRef} 
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < SNAP_SIZE || newBox.height < SNAP_SIZE) {
                return oldBox;
              }
              newBox.width = Math.round(newBox.width / SNAP_SIZE) * SNAP_SIZE;
              newBox.height = Math.round(newBox.height / SNAP_SIZE) * SNAP_SIZE;
              newBox.x = Math.round(newBox.x / SNAP_SIZE) * SNAP_SIZE;
              newBox.y = Math.round(newBox.y / SNAP_SIZE) * SNAP_SIZE;
              return newBox;
            }}
            keepRatio={false}
            enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right']}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          />
        </Layer>
      </Stage>

      {/* Minimap */}
      <div className="hidden md:block absolute bottom-4 right-4 md:right-[18rem] bg-white border border-slate-300 shadow-xl rounded-lg overflow-hidden pointer-events-auto z-10" style={{ width: 200, height: 150 }}>
        <Stage
          width={200}
          height={150}
          scaleX={Math.min(200 / branchWidth, 150 / branchHeight)}
          scaleY={Math.min(200 / branchWidth, 150 / branchHeight)}
          onClick={(e) => {
            const pos = e.target.getStage()?.getPointerPosition();
            if (pos) {
              const scale = Math.min(200 / branchWidth, 150 / branchHeight);
              const realX = pos.x / scale;
              const realY = pos.y / scale;
              // Center the clicked point
              setStagePos({
                x: (dimensions.width / 2) - (realX * stageScale),
                y: (dimensions.height / 2) - (realY * stageScale)
              });
            }
          }}
          onDragMove={(e) => {
             if (e.target.id() === 'viewport-box') {
                // e.target.x() is in scaled coordinates? No, it's in unscaled coordinates of its parent.
                // Since it's inside a scaled Stage, e.target.x() is the absolute unscaled x.
                setStagePos({
                  x: -e.target.x() * stageScale,
                  y: -e.target.y() * stageScale
                });
             }
          }}
        >
          <Layer>
            <Rect width={branchWidth} height={branchHeight} fill="#e2e8f0" />
            {branch.rooms.filter(r => (r.level || 0) === activeLevel).map(room => (
              <Group key={`mini-${room.id}`} x={room.x || 50} y={room.y || 50}>
                <Rect width={room.width || 1000} height={room.height || 800} fill={room.color || "#ffffff"} />
                {room.areas.map(area => (
                  <Group key={`mini-${area.id}`} x={area.x} y={area.y}>
                    <Rect width={area.width} height={area.height} fill={area.color || "rgba(255, 255, 0, 0.2)"} />
                    {area.racks.map(rack => (
                      <Rect key={`mini-${rack.id}`} x={rack.x} y={rack.y} rotation={rack.rotation} width={rack.width} height={rack.depth} fill={getRackStatusColor(rack)} />
                    ))}
                  </Group>
                ))}
                {room.racks.map(rack => (
                  <Rect key={`mini-${rack.id}`} x={rack.x} y={rack.y} rotation={rack.rotation} width={rack.width} height={rack.depth} fill={getRackStatusColor(rack)} />
                ))}
              </Group>
            ))}
            
            {/* Viewport indicator */}
            <Rect 
              id="viewport-box"
              x={-stagePos.x / stageScale}
              y={-stagePos.y / stageScale}
              width={dimensions.width / stageScale}
              height={dimensions.height / stageScale}
              stroke="#ef4444"
              strokeWidth={4 / Math.min(200 / branchWidth, 150 / branchHeight)}
              fill="rgba(239, 68, 68, 0.2)"
              draggable
              dragBoundFunc={(pos) => {
                return {
                   x: pos.x,
                   y: pos.y
                };
              }}
            />
          </Layer>
        </Stage>
      </div>

    </div>
  );
};
