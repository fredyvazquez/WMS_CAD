import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import { 
  X, Save, Plus, Trash2, ScanBarcode, Camera, Search, Info, 
  ArrowLeft, Minus, Edit2, Package, CheckCircle2,
  ArrowDown, ArrowUp, ArrowDownUp, RotateCcw, GripVertical,
  AlertTriangle, Check, StickyNote
} from 'lucide-react';
import { CameraScanner } from './CameraScanner';

// Helper to check if an article is unknown (no description / missing)
export const isArticleUnknown = (_articleId?: string, art?: any) => {
  if (!art) return true;
  if (!art.description) return true;
  const desc = String(art.description).trim();
  return desc === '' || desc === '-' || desc.toLowerCase() === 'desconocido' || desc.toLowerCase().includes('sin descripcion');
};


export const ARTICLE_NOTE_PRESETS = [
  '🏷️ Sin etiqueta',
  '📍 Ubicación auxiliar',
  '📦 Empaque dañado',
  '🔍 Por verificar',
  '⚠️ Conteo pendiente',
  '🔄 Muestra / Devolución',
  '🔒 Apartado'
];

export const RACK_NOTE_PRESETS = [
  '🔧 En mantenimiento',
  '⚠️ Mercancía pesada niveles 1-2',
  '📦 Área temporal de recepción',
  '🔒 Mercancía de alto valor',
  '💡 Iluminación deficiente'
];

// Helper to get color between blue (cold) and red (hot)
const getCellHeatmapColor = (value: number, max: number) => {
  if (max === 0 || value === 0) return 'bg-blue-300 border-blue-400';
  const ratio = Math.min(1, value / max);
  if (ratio < 0.2) return 'bg-cyan-300 border-cyan-400';
  if (ratio < 0.5) return 'bg-green-300 border-green-400';
  if (ratio < 0.8) return 'bg-yellow-300 border-yellow-400';
  if (ratio < 0.95) return 'bg-orange-400 border-orange-500 text-white';
  return 'bg-red-500 border-red-600 text-white';
};

export const RackFrontalView: React.FC = () => {
  const { 
    branches, 
    activeBranchId, 
    activeRackId, 
    setActiveRack, 
    articles, 
    updateCellItems, 
    updateRackProperties,
    searchQuery, 
    currentUserRole, 
    viewMode 
  } = useStore();
  const isVentas = currentUserRole === 'VENTAS';
  const inventoryRecords = useAnalyzerStore(state => state.inventoryRecords);

  const maxExits = useMemo(() => {
    return inventoryRecords.reduce((max, r) => Math.max(max, r.exits || 0), 0);
  }, [inventoryRecords]);

  const articleMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!articles) return map;
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      if (art && art.id) {
        map.set(art.id.trim().toUpperCase(), art);
      }
    }
    return map;
  }, [articles]);

  const [selectedCell, setSelectedCell] = useState<{row: number, col: number, items: {id: string, articleId: string, quantity: number, notes?: string}[]} | null>(null);

  // For the active edit form of an item inside the selected cell
  const [editingItem, setEditingItem] = useState<{id?: string, articleId?: string, quantity?: number | string, notes?: string} | null>(null);
  const [editingModalItem, setEditingModalItem] = useState<{id: string, articleId: string, quantity: number | string, notes?: string} | null>(null);
  const [showRackNotesModal, setShowRackNotesModal] = useState(false);
  const [rackNotesDraft, setRackNotesDraft] = useState('');

  const [showCamera, setShowCamera] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearchText, setCatalogSearchText] = useState('');

  // Drag and drop & row management state
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSourceCell, setReorderSourceCell] = useState<{ row: number; col: number; items: any[] } | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetRow, setMoveTargetRow] = useState<number>(0);
  const [moveTargetCol, setMoveTargetCol] = useState<number>(0);

  const [draggedCell, setDraggedCell] = useState<{ row: number; col: number; items: any[] } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ row: number; col: number } | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [undoState, setUndoState] = useState<{ cells: any[]; message: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = React.useRef<{ x: number; y: number; row: number; col: number; time: number } | null>(null);
  const isDraggingRef = React.useRef<boolean>(false);
  const startDragRef = React.useRef<any>(null);
  const executeMoveAndShiftRef = React.useRef<any>(null);

  React.useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!pointerStartRef.current) return;
      const start = pointerStartRef.current;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);

      if (!isDraggingRef.current) {
        if (reorderMode && dist > 10) {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          startDragRef.current?.(start.row, start.col, e.clientX, e.clientY);
        } else if (!reorderMode && dist > 15) {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        }
      }

      if (isDraggingRef.current) {
        setDragPosition({ x: e.clientX, y: e.clientY });

        // Auto-scroll container if dragging near edges
        if (gridContainerRef.current) {
          const rect = gridContainerRef.current.getBoundingClientRect();
          if (e.clientY < rect.top + 50) {
            gridContainerRef.current.scrollTop -= 8;
          } else if (e.clientY > rect.bottom - 50) {
            gridContainerRef.current.scrollTop += 8;
          }
        }

        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cellEl = el?.closest('[data-cell-row]') as HTMLElement | null;
        if (cellEl) {
          const tr = parseInt(cellEl.getAttribute('data-cell-row') || '-1', 10);
          const tc = parseInt(cellEl.getAttribute('data-cell-col') || '-1', 10);
          if (tr >= 0 && tc >= 0) {
            setDropTarget({ row: tr, col: tc });
            return;
          }
        }
        setDropTarget(null);
      }
    };

    const handleWindowPointerUp = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (isDraggingRef.current && pointerStartRef.current) {
        const source = pointerStartRef.current;
        setDropTarget(currentDrop => {
          if (currentDrop && (currentDrop.row !== source.row || currentDrop.col !== source.col)) {
            executeMoveAndShiftRef.current?.(source.row, source.col, currentDrop.row, currentDrop.col);
          }
          return null;
        });
        setDraggedCell(null);
        setDragPosition(null);
        isDraggingRef.current = false;
      }

      pointerStartRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [reorderMode]);

  React.useEffect(() => {
    if (!searchQuery) return;
    const branch = branches.find(b => b.id === activeBranchId);
    let rack: any;
    if (branch) {
      for (const r of branch.rooms) {
        for (const area of r.areas) {
          rack = area.racks.find(rk => rk.id === activeRackId);
          if (rack) break;
        }
        if (rack) break;
        rack = r.racks.find(rk => rk.id === activeRackId);
        if (rack) break;
      }
    }
    if (!rack) return;

    let foundMatch = false;
    for (let rIndex = 0; rIndex < rack.levels; rIndex++) {
      for (let cIndex = 0; cIndex < rack.columns; cIndex++) {
        const cell = rack.cells?.find((c: any) => c.row === rIndex && c.col === cIndex);
        if (!cell) continue;
        const cellItems = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{id: Date.now().toString(), articleId: cell.articleId, quantity: cell.quantity || 1}] : []);
        const hasMatch = cellItems.some((i: any) => {
          const a = articleMap.get(i.articleId?.trim().toUpperCase());
          return i.articleId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (a && a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()));
        });
        if (hasMatch) {
          setSelectedCell({ row: rIndex, col: cIndex, items: cellItems });
          foundMatch = true;
          break;
        }
      }
      if (foundMatch) break;
    }
  }, [searchQuery, activeRackId, branches, articles, activeBranchId]);

  if (!activeRackId) return null;

  const branch = branches.find(b => b.id === activeBranchId);
  
  let rack;
  let foundRoom;
  if (branch) {
    for (const r of branch.rooms) {
      for (const area of r.areas) {
        rack = area.racks.find(rk => rk.id === activeRackId);
        if (rack) { foundRoom = r; break; }
      }
      if (rack) break;
      rack = r.racks.find(rk => rk.id === activeRackId);
      if (rack) { foundRoom = r; break; }
    }
  }

  if (!rack) return null;

  const processScannedCode = (code: string) => {
    if (!selectedCell || !rack) return;
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    
    const newItems = [...selectedCell.items];
    const existingIndex = newItems.findIndex(i => i.articleId.trim().toUpperCase() === cleanCode);
    
    if (existingIndex >= 0) {
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + 1
      };
    } else {
      newItems.push({
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        articleId: cleanCode,
        quantity: 1
      });
    }
    
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({...selectedCell, items: newItems});
  };

  const handleRemoveScannedCode = (code: string) => {
    if (!selectedCell || !rack) return;
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    const newItems = [...selectedCell.items];
    const existingIndex = newItems.findIndex(i => i.articleId.trim().toUpperCase() === cleanCode);
    if (existingIndex >= 0) {
      if (newItems[existingIndex].quantity > 1) {
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity - 1
        };
      } else {
        newItems.splice(existingIndex, 1);
      }
      updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
      setSelectedCell({ ...selectedCell, items: newItems });
    }
  };

  const handleSaveSubdivision = () => {
    if (!selectedCell || !editingItem) return;
    const cleanCode = (editingItem.articleId || '').trim().toUpperCase();
    if (!cleanCode) return;
    
    const qty = Number(editingItem.quantity);
    const validQuantity = !isNaN(qty) && qty > 0 ? qty : 1;
    const itemId = editingItem.id || (Date.now().toString() + Math.random().toString(36).substring(7));
    
    const rawNote = editingItem.notes ? editingItem.notes.trim() : '';
    const itemNote = rawNote.length > 0 ? rawNote : undefined;

    let newItems = [...selectedCell.items];
    const existingIndex = newItems.findIndex(i => i.id === itemId);
    if (existingIndex >= 0) {
      const updatedItem: any = {
        id: itemId,
        articleId: cleanCode,
        quantity: validQuantity
      };
      if (itemNote) {
        updatedItem.notes = itemNote;
      }
      newItems[existingIndex] = updatedItem;
    } else {
      const sameCodeIndex = newItems.findIndex(i => i.articleId.trim().toUpperCase() === cleanCode);
      if (sameCodeIndex >= 0) {
        const updatedItem: any = {
          ...newItems[sameCodeIndex],
          quantity: newItems[sameCodeIndex].quantity + validQuantity
        };
        if (itemNote) {
          updatedItem.notes = itemNote;
        } else if (editingItem.notes !== undefined) {
          delete updatedItem.notes;
        }
        newItems[sameCodeIndex] = updatedItem;
      } else {
        const newItem: any = {
          id: itemId,
          articleId: cleanCode,
          quantity: validQuantity
        };
        if (itemNote) {
          newItem.notes = itemNote;
        }
        newItems.push(newItem);
      }
    }
    
    // Save to store immediately
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({...selectedCell, items: newItems});
    setEditingItem(null);
    useStore.getState().saveToCloud();
  };

  const handleSaveModalItem = () => {
    if (!selectedCell || !rack || !editingModalItem) return;
    const cleanCode = editingModalItem.articleId.trim().toUpperCase();
    if (!cleanCode) return;

    const qty = Number(editingModalItem.quantity);
    const validQuantity = !isNaN(qty) && qty > 0 ? qty : 1;
    const rawNote = editingModalItem.notes ? editingModalItem.notes.trim() : '';
    const itemNote = rawNote.length > 0 ? rawNote : undefined;

    const newItems = selectedCell.items.map(item => {
      if (item.id === editingModalItem.id) {
        const updated: any = {
          ...item,
          articleId: cleanCode,
          quantity: validQuantity
        };
        if (itemNote) {
          updated.notes = itemNote;
        } else {
          delete updated.notes;
        }
        return updated;
      }
      return item;
    });

    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({ ...selectedCell, items: newItems });
    setEditingModalItem(null);
    useStore.getState().saveToCloud();
  };

  const handleDeleteSubdivision = (id: string) => {
    if (!selectedCell) return;
    const newItems = selectedCell.items.filter(i => i.id !== id);
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({...selectedCell, items: newItems});
    if (editingModalItem?.id === id) {
      setEditingModalItem(null);
    }
    useStore.getState().saveToCloud();
  };

  const handleRemoveItemNote = (itemId: string) => {
    if (!selectedCell || !rack) return;
    const newItems = selectedCell.items.map(i => {
      if (i.id === itemId) {
        const copy = { ...i };
        delete copy.notes;
        return copy;
      }
      return i;
    });
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({ ...selectedCell, items: newItems });
    if (editingItem?.id === itemId) {
      setEditingItem({ ...editingItem, notes: '' });
    }
    if (editingModalItem?.id === itemId) {
      setEditingModalItem({ ...editingModalItem, notes: '' });
    }
    useStore.getState().saveToCloud();
  };

  const handleUpdateItemQuantity = (itemId: string, delta: number) => {
    if (!selectedCell || !rack) return;
    let newItems = [...selectedCell.items];
    const index = newItems.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newQty = newItems[index].quantity + delta;
    if (newQty <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index] = { ...newItems[index], quantity: newQty };
    }
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({ ...selectedCell, items: newItems });
  };

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 5500);
  };

  const hasItemsInRow = (rowIndex: number) => {
    if (!rack?.cells) return false;
    return rack.cells.some((c: any) => c.row === rowIndex && ((c.items && c.items.length > 0) || (c.articleId && c.quantity > 0)));
  };

  const handleAddRowTop = () => {
    if (!rack || isVentas) return;
    const newRows = rack.rows + 1;
    const existingCells = rack.cells || [];
    const newCells = existingCells.map((c: any) => ({
      ...c,
      row: c.row + 1,
      id: `${rack.id}-${c.row + 1}-${c.col}`
    }));
    updateRackProperties(rack.id, { rows: newRows, cells: newCells });
    if (selectedCell) {
      setSelectedCell({ ...selectedCell, row: selectedCell.row + 1 });
    }
    showToastNotification(`Nuevo renglón superior agregado (Fila 1). Filas totales: ${newRows}`);
    if (navigator.vibrate) navigator.vibrate([30]);
  };

  const handleAddRowBottom = () => {
    if (!rack || isVentas) return;
    const newRows = rack.rows + 1;
    updateRackProperties(rack.id, { rows: newRows });
    showToastNotification(`Nuevo renglón inferior agregado (Fila ${newRows}). Filas totales: ${newRows}`);
    if (navigator.vibrate) navigator.vibrate([30]);
  };

  const handleDeleteRowTop = () => {
    if (!rack || rack.rows <= 1 || isVentas) return;
    if (hasItemsInRow(0)) {
      alert('No se puede eliminar el renglón superior porque contiene artículos. Vacía las casillas de la Fila 1 primero.');
      return;
    }
    const newRows = rack.rows - 1;
    const remainingCells = (rack.cells || [])
      .filter((c: any) => c.row !== 0)
      .map((c: any) => ({
        ...c,
        row: c.row - 1,
        id: `${rack.id}-${c.row - 1}-${c.col}`
      }));
    updateRackProperties(rack.id, { rows: newRows, cells: remainingCells });
    if (selectedCell) {
      if (selectedCell.row === 0) setSelectedCell(null);
      else setSelectedCell({ ...selectedCell, row: selectedCell.row - 1 });
    }
    showToastNotification(`Renglón superior eliminado. Filas totales: ${newRows}`);
    useStore.getState().saveToCloud();
  };

  const handleDeleteRowBottom = () => {
    if (!rack || rack.rows <= 1 || isVentas) return;
    const lastRowIndex = rack.rows - 1;
    if (hasItemsInRow(lastRowIndex)) {
      alert(`No se puede eliminar el renglón inferior porque contiene artículos. Vacía las casillas de la Fila ${rack.rows} primero.`);
      return;
    }
    const newRows = rack.rows - 1;
    const remainingCells = (rack.cells || []).filter((c: any) => c.row !== lastRowIndex);
    updateRackProperties(rack.id, { rows: newRows, cells: remainingCells });
    if (selectedCell && selectedCell.row === lastRowIndex) {
      setSelectedCell(null);
    }
    showToastNotification(`Renglón inferior eliminado. Filas totales: ${newRows}`);
    useStore.getState().saveToCloud();
  };

  const startDrag = (rIndex: number, cIndex: number, clientX: number, clientY: number) => {
    if (!rack || isVentas) return;
    const cell = rack.cells?.find((c: any) => c.row === rIndex && c.col === cIndex);
    let cellItems = cell?.items || [];
    if (cellItems.length === 0 && cell?.articleId) {
      cellItems = [{ id: 'legacy', articleId: cell.articleId, quantity: cell.quantity || 0 }];
    }
    if (cellItems.length === 0) return;

    isDraggingRef.current = true;
    setDraggedCell({ row: rIndex, col: cIndex, items: cellItems });
    setDragPosition({ x: clientX, y: clientY });
    if (navigator.vibrate) {
      navigator.vibrate([35]);
    }
  };

  const applyNewGrid = (grid: any[][], previousCellsSnapshot: any[], message: string) => {
    if (!rack) return;
    const newCells: any[] = [];
    for (let r = 0; r < rack.rows; r++) {
      for (let c = 0; c < rack.cols; c++) {
        const items = grid[r][c];
        const first = items.length > 0 ? items[0] : null;
        newCells.push({
          id: `${rack.id}-${r}-${c}`,
          row: r,
          col: c,
          articleId: first ? first.articleId : null,
          quantity: items.reduce((acc: number, i: any) => acc + i.quantity, 0),
          items: items
        });
      }
    }
    updateRackProperties(rack.id, { cells: newCells });
    setUndoState({ cells: previousCellsSnapshot, message });
    showToastNotification(message);
    useStore.getState().saveToCloud();
    if (selectedCell) {
      setSelectedCell(null);
    }
    if (navigator.vibrate) {
      navigator.vibrate([40, 50, 40]);
    }
  };

  const executeMoveAndShift = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
  ) => {
    if (!rack) return;
    if (fromRow === toRow && fromCol === toCol) return;

    const currentCells = rack.cells || [];
    const getCellItems = (r: number, c: number) => {
      const cell = currentCells.find((x: any) => x.row === r && x.col === c);
      if (!cell) return [];
      if (cell.items && cell.items.length > 0) return [...cell.items];
      if (cell.articleId) {
        return [{ id: 'legacy', articleId: cell.articleId, quantity: cell.quantity || 0 }];
      }
      return [];
    };

    const sourceItems = getCellItems(fromRow, fromCol);
    if (sourceItems.length === 0) return;

    const previousCellsSnapshot = JSON.parse(JSON.stringify(currentCells));

    // Build 2D grid
    const grid: any[][] = [];
    for (let r = 0; r < rack.rows; r++) {
      grid[r] = [];
      for (let c = 0; c < rack.cols; c++) {
        grid[r][c] = getCellItems(r, c);
      }
    }

    const targetItems = grid[toRow][toCol];

    // Case 1: Target empty
    if (targetItems.length === 0) {
      grid[toRow][toCol] = sourceItems;
      grid[fromRow][fromCol] = [];
      applyNewGrid(grid, previousCellsSnapshot, `Movido a F${toRow + 1}-C${toCol + 1}`);
      return;
    }

    // Case 2: Target occupied -> Shift Down
    if (fromCol === toCol) {
      // Same column
      if (fromRow > toRow) {
        // Dragging upwards: fromRow is vacated, intermediate rows shift DOWN into fromRow
        for (let r = fromRow - 1; r >= toRow; r--) {
          grid[r + 1][fromCol] = grid[r][fromCol];
        }
        grid[toRow][toCol] = sourceItems;
        applyNewGrid(grid, previousCellsSnapshot, `Movido a F${toRow + 1}-C${toCol + 1} (F${toRow + 1}..F${fromRow} desplazadas abajo)`);
        return;
      } else {
        // Dragging downwards in same column
        let emptyRow = -1;
        for (let r = toRow + 1; r < rack.rows; r++) {
          if (grid[r][fromCol].length === 0) {
            emptyRow = r;
            break;
          }
        }

        if (emptyRow !== -1) {
          // Shift toRow..emptyRow-1 down into emptyRow
          for (let r = emptyRow - 1; r >= toRow; r--) {
            grid[r + 1][fromCol] = grid[r][fromCol];
          }
          grid[toRow][toCol] = sourceItems;
          grid[fromRow][fromCol] = [];
          applyNewGrid(grid, previousCellsSnapshot, `Movido a F${toRow + 1}-C${toCol + 1} (desplazadas abajo hacia F${emptyRow + 1})`);
          return;
        } else {
          // No empty below toRow, shift intermediate rows UP into vacated fromRow
          for (let r = fromRow + 1; r <= toRow; r++) {
            grid[r - 1][fromCol] = grid[r][fromCol];
          }
          grid[toRow][toCol] = sourceItems;
          applyNewGrid(grid, previousCellsSnapshot, `Movido a F${toRow + 1}-C${toCol + 1}`);
          return;
        }
      }
    } else {
      // Different column
      let emptyRow = -1;
      for (let r = toRow; r < rack.rows; r++) {
        if (grid[r][toCol].length === 0) {
          emptyRow = r;
          break;
        }
      }

      if (emptyRow === -1) {
        alert(`⚠️ No se puede desplazar hacia abajo: la Columna C${toCol + 1} no tiene celdas vacías al fondo (la última fila F${rack.rows} está ocupada). Usa el botón [+ Renglón Abajo] para agregar espacio o libera una casilla.`);
        return;
      }

      for (let r = emptyRow - 1; r >= toRow; r--) {
        grid[r + 1][toCol] = grid[r][toCol];
      }
      grid[toRow][toCol] = sourceItems;
      grid[fromRow][fromCol] = [];
      applyNewGrid(grid, previousCellsSnapshot, `Movido de C${fromCol + 1} a C${toCol + 1} (artículos desplazados abajo hacia F${emptyRow + 1})`);
    }
  };

  const handleUndo = () => {
    if (!rack || !undoState) return;
    updateRackProperties(rack.id, { cells: undoState.cells });
    setUndoState(null);
    showToastNotification('↶ Movimiento deshecho. Estado anterior restaurado.');
    useStore.getState().saveToCloud();
    if (navigator.vibrate) {
      navigator.vibrate([30]);
    }
  };

  startDragRef.current = startDrag;
  executeMoveAndShiftRef.current = executeMoveAndShift;

  // Render a grid based on rack rows and cols
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 truncate">Vista Frontal: {rack.name}</h2>
              <button
                type="button"
                onClick={() => {
                  setRackNotesDraft(rack.notes || '');
                  setShowRackNotesModal(true);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all shadow-sm ${
                  rack.notes 
                    ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900 font-bold ring-1 ring-amber-300' 
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                }`}
                title="Ver o editar notas del rack"
              >
                <StickyNote size={13} className={rack.notes ? 'text-amber-700' : 'text-slate-500'} />
                <span>{rack.notes ? 'Nota del Rack' : '+ Nota del Rack'}</span>
              </button>
            </div>
            <p className="text-xs md:text-sm text-slate-500 truncate mt-0.5">
              {branch?.name} &gt; {foundRoom?.name} &gt; {rack.width}x{rack.height}x{rack.depth} cm
            </p>
          </div>
          <button 
            onClick={() => setActiveRack(null)}
            className="p-2 hover:bg-slate-200 rounded-full shrink-0"
            title="Cerrar vista frontal"
          >
            <X size={22} className="text-slate-500" />
          </button>
        </div>

        {/* Visible Rack Note Banner if exists */}
        {rack.notes && (
          <div className="px-3 md:px-4 py-2 bg-amber-50/95 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-950 font-medium shrink-0 shadow-inner">
            <div className="flex items-center gap-2 min-w-0">
              <StickyNote size={15} className="text-amber-700 shrink-0" />
              <span className="font-bold text-amber-900 shrink-0">Nota del Rack:</span>
              <span className="truncate">{rack.notes}</span>
            </div>
            <button 
              type="button"
              onClick={() => {
                setRackNotesDraft(rack.notes || '');
                setShowRackNotesModal(true);
              }}
              className="text-amber-800 hover:text-amber-950 font-bold underline shrink-0 text-[11px]"
            >
              Editar
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Content (Grid) */}
          <div 
            ref={gridContainerRef}
            className={`flex-1 p-3 md:p-6 bg-slate-100 flex flex-col items-center justify-start md:justify-center ${
              draggedCell ? 'overflow-hidden touch-none' : 'overflow-auto'
            } ${selectedCell ? 'hidden md:flex' : 'flex'}`}
          >
            <div className="w-full max-w-4xl flex flex-col items-center m-auto">
              {/* Top Toolbar / Corner Controls */}
              {!isVentas && (
                <div className="w-full flex items-center justify-between gap-2 p-2 mb-2 bg-white/95 backdrop-blur rounded-xl shadow-sm border border-slate-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddRowTop}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                      title="Insertar un renglón al inicio del rack (desplaza todas las filas abajo)"
                    >
                      <Plus size={14} /> <ArrowUp size={14} />
                      <span>Renglón Arriba</span>
                    </button>
                    {rack.rows > 1 && !hasItemsInRow(0) && (
                      <button
                        type="button"
                        onClick={handleDeleteRowTop}
                        className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs px-2 py-1.5 rounded-lg border border-slate-200 transition-colors"
                        title="Quitar Fila 1 (vacía)"
                      >
                        <Minus size={13} />
                      </button>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-slate-600">
                    <span>{rack.rows} Filas × {rack.cols} Columnas</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReorderMode(!reorderMode)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                        reorderMode
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                      }`}
                      title="Activa el modo para arrastrar divisiones con desplazamiento hacia abajo"
                    >
                      <ArrowDownUp size={14} />
                      <span>{reorderMode ? 'Reordenando...' : 'Modo Reordenar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reorder Mode Helper Banner & Tap-to-Move Guidance */}
              {(reorderMode || reorderSourceCell) && (
                <div className="w-full bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs p-2.5 rounded-xl mb-2 flex items-center justify-between gap-2 shadow-md animate-in fade-in shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ArrowDownUp size={15} />
                    </div>
                    <div className="min-w-0">
                      {reorderSourceCell ? (
                        <div>
                          <span className="font-bold text-amber-900 block truncate">
                            📍 Moviendo Fila {reorderSourceCell.row + 1} • Col {reorderSourceCell.col + 1} ({reorderSourceCell.items.reduce((a, b) => a + b.quantity, 0)} piezas)
                          </span>
                          <span className="text-[11px] text-amber-800">
                            Desplázate por el rack y <strong>toca la casilla destino</strong> donde deseas colocarla.
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-amber-900 block">Modo Reordenar Activo</span>
                          <span className="text-[11px] text-amber-800">
                            <strong>Toca una celda</strong> para seleccionarla y moverla sin que el rack se deslice.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {reorderSourceCell && (
                      <button
                        type="button"
                        onClick={() => setReorderSourceCell(null)}
                        className="px-2.5 py-1 text-xs font-bold text-amber-900 hover:text-black bg-amber-200/90 hover:bg-amber-300 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => {
                        setReorderMode(false);
                        setReorderSourceCell(null);
                      }}
                      className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}

              {/* Grid */}
              <div 
                className="grid gap-2 p-2 md:p-4 bg-orange-600 rounded-lg shadow-lg border-4 md:border-8 border-orange-700 relative w-full overflow-x-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${rack.cols}, minmax(80px, 1fr))`,
                  gridTemplateRows: `repeat(${rack.rows}, minmax(60px, 1fr))`,
                  minHeight: '55vh'
                }}
              >
              {Array.from({ length: rack.rows }).map((_, rIndex) => (
                Array.from({ length: rack.cols }).map((_, cIndex) => {
                  const cell = rack.cells?.find((c: any) => c.row === rIndex && c.col === cIndex);
                  let cellItems = cell?.items || [];
                  if (cellItems.length === 0 && cell?.articleId) {
                    // Backward compat
                    cellItems = [{ id: 'legacy', articleId: cell.articleId, quantity: cell.quantity || 0 }];
                  }

                  let cellColor = "bg-slate-50 border-slate-200";
                  let text = "Vacío";
                  let hasMatch = false;
                  let unknownCount = 0;
                  
                  if (cellItems.length > 0) {
                     const firstItem = cellItems[0];
                     text = cellItems.length > 1 ? `Múltiples (${cellItems.length})` : firstItem.articleId;
                     
                     let hasRed = false, hasYellow = false, hasGreen = false, hasUnknown = false;
                     let maxCellExits = 0;

                     cellItems.forEach((i: any) => {
                        const a = articleMap.get(i.articleId?.trim().toUpperCase());
                        const isUnk = isArticleUnknown(i.articleId, a);
                        if (isUnk) {
                           hasUnknown = true;
                           unknownCount++;
                        } else if (a) {
                           if (a.status === 'SCRAP' || a.status === 'DAMAGED') hasRed = true;
                           else if (a.status === 'SLOW' || a.status === 'OFFLINE') hasYellow = true;
                           else hasGreen = true;
                        } else {
                           hasUnknown = true;
                           unknownCount++;
                        }

                        if (searchQuery) {
                           if (i.articleId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (a && a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()))) {
                              hasMatch = true;
                           }
                        }
                        
                        if (viewMode === 'HEATMAP') {
                           const record = inventoryRecords.find(r => r.id === i.articleId);
                           if (record) {
                              maxCellExits = Math.max(maxCellExits, record.exits || 0);
                           }
                        }
                     });

                     if (hasMatch) {
                        cellColor = 'bg-purple-500 border-purple-700 text-white shadow-lg shadow-purple-500/50';
                     } else if (searchQuery) {
                        cellColor = 'bg-slate-200 border-slate-300 opacity-50'; // Dim non-matches
                     } else if (viewMode === 'DISABLED') {
                        cellColor = 'bg-slate-200 border-slate-300';
                     } else if (viewMode === 'EMPTY') {
                        cellColor = 'bg-slate-200 border-slate-300 opacity-50'; // Dimmed because it's not empty
                     } else if (viewMode === 'UNKNOWN') {
                        cellColor = hasUnknown ? 'bg-cyan-200 border-cyan-400' : 'bg-slate-200 border-slate-300 opacity-50';
                     } else if (viewMode === 'HEATMAP') {
                        cellColor = getCellHeatmapColor(maxCellExits, maxExits);
                     } else {
                        // DEFAULT MODE
                        if (hasRed) {
                           cellColor = 'bg-red-200 border-red-400';
                        } else if (hasYellow) {
                           cellColor = 'bg-yellow-200 border-yellow-400';
                        } else if (hasUnknown) {
                           cellColor = 'bg-cyan-200 border-cyan-400';
                        } else if (hasGreen) {
                           cellColor = 'bg-green-200 border-green-400';
                        }
                     }
                  } else {
                     // Empty cell
                     if (searchQuery) {
                        cellColor = 'bg-slate-200 border-slate-300 opacity-50'; // Dim empty if searching
                     } else if (viewMode === 'EMPTY') {
                        cellColor = 'bg-green-200 border-green-400 shadow-inner'; // Highlight empty
                     }
                  }
                  
                  const cellId = `${rack?.id}-r${rIndex}-c${cIndex}`;
                  const isSource = draggedCell?.row === rIndex && draggedCell?.col === cIndex;
                  const isTarget = dropTarget?.row === rIndex && dropTarget?.col === cIndex && !isSource;
                  const isSelectedForMove = reorderSourceCell?.row === rIndex && reorderSourceCell?.col === cIndex;

                  return (
                    <div 
                      key={cellId} 
                      data-cell-row={rIndex}
                      data-cell-col={cIndex}
                      style={{ touchAction: reorderMode || isDraggingRef.current || reorderSourceCell ? 'none' : 'auto' }}
                      className={`${cellColor} rounded shadow-inner border flex flex-col items-center justify-center relative select-none transition-all ${
                        isSource ? 'opacity-30 border-dashed border-2 border-blue-500 scale-95' : ''
                      } ${
                        isTarget ? 'ring-4 ring-blue-500 border-blue-600 bg-blue-100/90 scale-105 z-20 shadow-xl' : ''
                      } ${
                        isSelectedForMove ? 'ring-4 ring-amber-500 border-amber-600 bg-amber-100/95 scale-105 z-20 shadow-2xl animate-pulse' : ''
                      } ${
                        reorderSourceCell && !isSelectedForMove ? 'hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''
                      } ${
                        selectedCell?.row === rIndex && selectedCell?.col === cIndex ? 'ring-4 ring-blue-500 z-10' : ''
                      } ${
                        reorderMode && cellItems.length > 0 
                          ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02] touch-none' 
                          : 'cursor-pointer hover:opacity-85'
                      }`}
                      onPointerDown={(e) => {
                        if (isVentas || e.button !== 0) return;
                        pointerStartRef.current = {
                          x: e.clientX,
                          y: e.clientY,
                          row: rIndex,
                          col: cIndex,
                          time: Date.now()
                        };

                        if (cellItems.length > 0) {
                          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                          // 350ms duration allows clear distinction between tap and hold
                          holdTimerRef.current = setTimeout(() => {
                            if (pointerStartRef.current) {
                              startDrag(rIndex, cIndex, pointerStartRef.current.x, pointerStartRef.current.y);
                            }
                          }, 350);
                        }
                      }}
                      onClick={() => {
                        if (isDraggingRef.current) return;

                        // Tap-to-move flow in reorderMode or when reorderSourceCell is set
                        if (reorderMode || reorderSourceCell) {
                          if (!reorderSourceCell) {
                            if (cellItems.length > 0) {
                              setReorderSourceCell({ row: rIndex, col: cIndex, items: cellItems });
                              if (navigator.vibrate) navigator.vibrate([25]);
                            }
                            return;
                          } else {
                            if (reorderSourceCell.row === rIndex && reorderSourceCell.col === cIndex) {
                              // Tapped same cell -> deselect
                              setReorderSourceCell(null);
                              return;
                            }
                            // Destination tapped -> execute move
                            executeMoveAndShift(reorderSourceCell.row, reorderSourceCell.col, rIndex, cIndex);
                            setReorderSourceCell(null);
                            return;
                          }
                        }

                        let existingItems = cell?.items || [];
                        if (existingItems.length === 0 && cell?.articleId) {
                           existingItems = [{ id: Date.now().toString(), articleId: cell.articleId, quantity: cell.quantity || 0 }];
                        }
                        setSelectedCell({
                          row: rIndex,
                          col: cIndex,
                          items: [...existingItems]
                        });
                        setEditingItem(null);
                      }}
                    >
                      {/* Drag handle icon in reorder mode */}
                      {reorderMode && cellItems.length > 0 && (
                        <span className="absolute top-1 left-1 text-slate-400 pointer-events-none">
                          <GripVertical size={13} />
                        </span>
                      )}

                      {/* Selected for move overlay */}
                      {isSelectedForMove && (
                        <div className="absolute inset-0 bg-amber-500/90 text-slate-950 font-bold flex flex-col items-center justify-center p-1 rounded z-20 pointer-events-none">
                          <ArrowDownUp size={18} className="animate-bounce mb-0.5 text-slate-950" />
                          <span className="text-[10px] leading-tight text-center font-extrabold">Seleccionada</span>
                          <span className="text-[9px] opacity-90">Toca destino</span>
                        </div>
                      )}

                      {/* Drop target visual overlay */}
                      {isTarget && (
                        <div className="absolute inset-0 bg-blue-600/95 text-white flex flex-col items-center justify-center p-1 rounded z-20 animate-pulse text-center pointer-events-none">
                          <ArrowDown size={18} className="animate-bounce mb-0.5" />
                          <span className="text-[10px] font-bold leading-tight">
                            {cellItems.length > 0 ? 'Desplazar abajo' : 'Colocar aquí'}
                          </span>
                        </div>
                      )}

                      <span className="text-black/40 text-[10px] font-mono absolute bottom-1 right-1 pointer-events-none">
                        F{rIndex+1}-C{cIndex+1}
                      </span>
                      {/* Cell Note Indicator */}
                      {cellItems.some((i: any) => i.notes) && (
                        <span 
                          className="absolute top-1 right-1 text-amber-800 bg-amber-200/95 rounded-full p-0.5 shadow-sm border border-amber-400 pointer-events-none z-10" 
                          title="Tiene notas / observaciones registradas"
                        >
                          <StickyNote size={10} />
                        </span>
                      )}
                      <div className="text-xs font-bold text-slate-700 text-center px-1 truncate w-full pointer-events-none">
                        {text}
                      </div>
                      {cellItems.length > 1 && viewMode === 'UNKNOWN' && unknownCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-cyan-900 bg-cyan-300/90 px-1 py-0.2 rounded border border-cyan-500/40 pointer-events-none mt-0.5">
                          ⚠️ {unknownCount} sin desc.
                        </span>
                      )}
                      {cellItems.length > 0 && (
                        <div className="text-[10px] text-slate-600 mt-0.5 pointer-events-none flex items-center gap-1 justify-center flex-wrap">
                          <span>Total: {cellItems.reduce((acc: number, item: any) => acc + item.quantity, 0)}</span>
                          {cellItems.length > 1 && (
                            <span className="flex items-center gap-0.5 ml-0.5">
                              {cellItems.slice(0, 5).map((ci: any, idx: number) => {
                                const ca = articleMap.get(ci.articleId?.trim().toUpperCase());
                                const cu = isArticleUnknown(ci.articleId, ca);
                                let dotColor = 'bg-emerald-500';
                                if (cu) dotColor = 'bg-cyan-500 ring-1 ring-cyan-700';
                                else if (ca?.status === 'SCRAP' || ca?.status === 'DAMAGED') dotColor = 'bg-red-500';
                                else if (ca?.status === 'SLOW' || ca?.status === 'OFFLINE') dotColor = 'bg-amber-500';
                                return (
                                  <span key={idx} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                );
                              })}
                              {cellItems.length > 5 && (
                                <span className="text-[8px] text-slate-500 font-bold leading-none">+{cellItems.length - 5}</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>

            {/* Bottom Toolbar / Corner Controls */}
            {!isVentas && (
              <div className="w-full flex items-center justify-between gap-2 p-2 mt-2 bg-white/95 backdrop-blur rounded-xl shadow-sm border border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddRowBottom}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                    title="Agregar un nuevo renglón al fondo del rack"
                  >
                    <Plus size={14} /> <ArrowDown size={14} />
                    <span>Renglón Abajo (F{rack.rows + 1})</span>
                  </button>
                  {rack.rows > 1 && !hasItemsInRow(rack.rows - 1) && (
                    <button
                      type="button"
                      onClick={handleDeleteRowBottom}
                      className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs px-2 py-1.5 rounded-lg border border-slate-200 transition-colors"
                      title={`Quitar Fila ${rack.rows} (vacía)`}
                    >
                      <Minus size={13} />
                    </button>
                  )}
                </div>

                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  {reorderMode ? 'Arrastra divisiones para mover' : 'Mantén presionado para arrastrar'}
                </span>
              </div>
            )}
          </div>
        </div>

          {/* Side Panel for Subdivisions */}
          {selectedCell && (
            <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedCell(null)}
                    className="md:hidden flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 active:scale-95 transition-all"
                  >
                    <ArrowLeft size={15} /> Volver al Rack
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">
                        Fila {selectedCell.row + 1} • Columna {selectedCell.col + 1}
                      </h3>
                      {!isVentas && selectedCell.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMoveTargetRow(selectedCell.row);
                            setMoveTargetCol(selectedCell.col);
                            setShowMoveModal(true);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 active:scale-95 px-2 py-0.5 rounded-lg border border-amber-300 transition-all shadow-sm"
                          title="Mover o reubicar esta celda"
                        >
                          <ArrowDownUp size={13} />
                          <span>Mover Celda</span>
                        </button>
                      )}
                      {viewMode === 'UNKNOWN' && (
                        (() => {
                          const unkInCell = selectedCell.items.filter(i => {
                            const a = articleMap.get(i.articleId?.trim().toUpperCase());
                            return isArticleUnknown(i.articleId, a);
                          }).length;
                          return unkInCell > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                              <AlertTriangle size={11} className="text-cyan-700" /> {unkInCell} Sin Descripción
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check size={11} className="text-emerald-700" /> Todos con Descripción
                            </span>
                          );
                        })()
                      )}
                      {viewMode === 'HEATMAP' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                          Filtro: Salidas
                        </span>
                      )}
                      {viewMode === 'DEFAULT' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          Filtro: Estado
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {selectedCell.items.reduce((acc, i) => acc + i.quantity, 0)} piezas en total ({selectedCell.items.length} artículo{selectedCell.items.length === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCell(null)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                  title="Cerrar detalle"
                >
                  <X size={18}/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Action Bar (Camera & Catalog) */}
                {!isVentas && (
                  <div className="flex gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setShowCamera(true)} 
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-bold py-2.5 px-3 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm transition-all"
                    >
                      <Camera size={18} />
                      <span>Escanear con Cámara</span>
                    </button>
                    {articles.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => { setCatalogSearchText(''); setShowCatalogModal(true); }}
                        className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold py-2.5 px-3 rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 text-sm transition-all shrink-0"
                      >
                        <Search size={16} className="text-slate-500" />
                        <span>Catálogo</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Unified Capture Card */}
                {!isVentas && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <ScanBarcode size={15} className="text-blue-600" />
                        {editingItem?.id && selectedCell.items.some(i => i.id === editingItem.id) ? 'Editar Artículo' : 'Ingresar Código'}
                      </span>
                      {editingItem && (
                        <button 
                          type="button"
                          onClick={() => setEditingItem(null)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <input 
                          type="text"
                          placeholder="Escribe o escanea el código..."
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner"
                          value={editingItem?.articleId || ''}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          onChange={(e) => setEditingItem({
                            ...editingItem,
                            id: editingItem?.id || Date.now().toString(),
                            articleId: e.target.value.toUpperCase(),
                            quantity: editingItem?.quantity ?? 1
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSubdivision();
                            }
                          }}
                        />

                        {editingItem?.articleId?.trim() ? (
                          (() => {
                            const cleanCode = editingItem.articleId.trim().toUpperCase();
                            const matched = articleMap.get(cleanCode);
                            if (matched) {
                              return (
                                <div className="mt-1.5 text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-start gap-1.5">
                                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="font-bold">En catálogo:</span> {matched.description}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="mt-1.5 text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                <Info size={14} className="shrink-0 text-amber-600" />
                                <span>Código manual (se guardará sin coincidencia de catálogo)</span>
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                            Escribe con el teclado o apunta con una pistola escáner láser / Bluetooth.
                          </p>
                        )}
                      </div>

                      {/* Notes / Tags for Article */}
                      <div className="pt-1.5 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <StickyNote size={12} className="text-amber-600" />
                            Nota u Observación (ej. Sin etiqueta, ubicación auxiliar):
                          </label>
                          {editingItem?.notes && (
                            <button
                              type="button"
                              onClick={() => setEditingItem({ ...editingItem, notes: '' })}
                              className="text-[10px] text-slate-400 hover:text-red-600"
                            >
                              Borrar nota
                            </button>
                          )}
                        </div>

                        {/* Quick Presets Chips */}
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {ARTICLE_NOTE_PRESETS.map((preset) => {
                            const isSelected = editingItem?.notes?.includes(preset);
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  const current = editingItem?.notes || '';
                                  const updated = current ? `${current} • ${preset}` : preset;
                                  setEditingItem({
                                    ...editingItem,
                                    id: editingItem?.id || Date.now().toString(),
                                    articleId: editingItem?.articleId || '',
                                    notes: updated
                                  });
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                  isSelected 
                                    ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold' 
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 active:scale-95'
                                }`}
                              >
                                {preset}
                              </button>
                            );
                          })}
                        </div>

                        <input 
                          type="text"
                          placeholder="Escribe una nota personalizada o toca una etiqueta arriba..."
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          value={editingItem?.notes || ''}
                          onChange={(e) => setEditingItem({
                            ...editingItem,
                            id: editingItem?.id || Date.now().toString(),
                            articleId: editingItem?.articleId || '',
                            notes: e.target.value
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSubdivision();
                            }
                          }}
                        />
                      </div>

                      {/* Quantity Stepper & Save Button */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-sm shrink-0">
                          <button 
                            type="button"
                            onClick={() => {
                              const current = Number(editingItem?.quantity) || 1;
                              const next = Math.max(1, current - 1);
                              setEditingItem({
                                ...editingItem,
                                id: editingItem?.id || Date.now().toString(),
                                articleId: editingItem?.articleId || '',
                                quantity: next
                              });
                            }}
                            className="p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                            title="Restar 1"
                          >
                            <Minus size={15} />
                          </button>
                          <input 
                            type="number"
                            min="1"
                            className="w-14 p-1.5 text-center text-sm font-bold text-slate-800 focus:outline-none"
                            value={editingItem?.quantity !== undefined ? editingItem.quantity : 1}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(1, Number(e.target.value));
                              setEditingItem({
                                ...editingItem,
                                id: editingItem?.id || Date.now().toString(),
                                articleId: editingItem?.articleId || '',
                                quantity: val as any
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveSubdivision();
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const current = Number(editingItem?.quantity) || 1;
                              setEditingItem({
                                ...editingItem,
                                id: editingItem?.id || Date.now().toString(),
                                articleId: editingItem?.articleId || '',
                                quantity: current + 1
                              });
                            }}
                            className="p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                            title="Sumar 1"
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={handleSaveSubdivision}
                          disabled={!editingItem?.articleId || !editingItem.articleId.trim()}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg text-sm shadow flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Save size={15} />
                          <span>{editingItem?.id && selectedCell.items.some(i => i.id === editingItem.id) ? 'Actualizar' : 'Agregar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Articles list */}
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                    Artículos en esta división ({selectedCell.items.length})
                  </h4>

                  {selectedCell.items.length === 0 ? (
                    <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Package size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-500">División Vacía</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Escanea con la cámara o ingresa un código arriba para asignar artículos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCell.items.map((item) => {
                        const cleanId = item.articleId?.trim().toUpperCase() || '';
                        const art = articleMap.get(cleanId);
                        const isUnk = isArticleUnknown(item.articleId, art);

                        // Heatmap exits
                        const record = inventoryRecords.find(r => r.id?.trim().toUpperCase() === cleanId || r.id === item.articleId);
                        const exits = record?.exits || 0;

                        // Search match
                        const isMatch = searchQuery ? (
                          item.articleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (art && art.description && art.description.toLowerCase().includes(searchQuery.toLowerCase()))
                        ) : false;

                        // Card styling and badge based on active filter / viewMode
                        let cardStyle = "p-3 border rounded-xl shadow-sm flex flex-col gap-2 transition-all ";
                        let badgeElement: React.ReactNode = null;

                        if (searchQuery) {
                          if (isMatch) {
                            cardStyle += "bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-md";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                                Coincidencia de búsqueda
                              </span>
                            );
                          } else {
                            cardStyle += "bg-slate-50 border-slate-200 opacity-40";
                          }
                        } else if (viewMode === 'UNKNOWN') {
                          if (isUnk) {
                            cardStyle += "bg-cyan-50/95 border-cyan-400 ring-2 ring-cyan-400 shadow-md shadow-cyan-100";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-900 border border-cyan-400">
                                <AlertTriangle size={11} className="text-cyan-700" /> Sin Descripción
                              </span>
                            );
                          } else {
                            cardStyle += "bg-white border-slate-200 opacity-60 hover:opacity-100";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                <Check size={11} className="text-emerald-600" /> Con Descripción
                              </span>
                            );
                          }
                        } else if (viewMode === 'HEATMAP') {
                          const ratio = maxExits > 0 ? Math.min(1, exits / maxExits) : 0;
                          if (ratio >= 0.8) {
                            cardStyle += "bg-red-50/90 border-red-400 ring-2 ring-red-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white border border-red-600">
                                🔥 Alta rotación ({exits} salidas)
                              </span>
                            );
                          } else if (ratio >= 0.5) {
                            cardStyle += "bg-orange-50/90 border-orange-300 ring-1 ring-orange-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-400 text-white border border-orange-500">
                                🔥 Media rotación ({exits} salidas)
                              </span>
                            );
                          } else if (ratio >= 0.2) {
                            cardStyle += "bg-yellow-50/90 border-yellow-300 ring-1 ring-yellow-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900 border border-yellow-400">
                                Salidas: {exits}
                              </span>
                            );
                          } else if (exits > 0) {
                            cardStyle += "bg-green-50/80 border-green-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                Salidas: {exits}
                              </span>
                            );
                          } else {
                            cardStyle += "bg-blue-50/60 border-blue-200";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                Sin salidas (0)
                              </span>
                            );
                          }
                        } else if (viewMode === 'DISABLED') {
                          cardStyle += "bg-slate-100 border-slate-300";
                          badgeElement = (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              Deshabilitado
                            </span>
                          );
                        } else {
                          // DEFAULT MODE: Status colors
                          if (isUnk) {
                            cardStyle += "bg-cyan-50/90 border-cyan-400 ring-1 ring-cyan-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                                <AlertTriangle size={11} className="text-cyan-700" /> Desconocido
                              </span>
                            );
                          } else if (art?.status === 'SCRAP' || art?.status === 'DAMAGED') {
                            cardStyle += "bg-red-50/80 border-red-300 ring-1 ring-red-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                                Dañado / Scrap
                              </span>
                            );
                          } else if (art?.status === 'SLOW' || art?.status === 'OFFLINE') {
                            cardStyle += "bg-amber-50/80 border-amber-300 ring-1 ring-amber-300";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                Lenta rotación
                              </span>
                            );
                          } else {
                            cardStyle += "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200";
                            badgeElement = (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Check size={11} className="text-emerald-700" /> Activo
                              </span>
                            );
                          }
                        }

                        return (
                          <div key={item.id} className={cardStyle}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-mono font-bold text-sm text-slate-800 tracking-wide block truncate">
                                    {item.articleId}
                                  </span>
                                  {badgeElement}
                                </div>
                                <span className={`text-xs line-clamp-2 leading-snug ${isUnk ? 'text-cyan-900 font-medium italic' : 'text-slate-500'}`}>
                                  {art?.description || 'Artículo sin descripción en catálogo'}
                                </span>
                                {item.notes ? (
                                  <div 
                                    className="mt-1.5 flex items-start justify-between gap-1.5 bg-amber-50/95 border border-amber-300 text-amber-950 text-xs px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-amber-100/80 transition-colors"
                                    onClick={() => {
                                      if (!isVentas) {
                                        setEditingModalItem({
                                          id: item.id,
                                          articleId: item.articleId,
                                          quantity: item.quantity,
                                          notes: item.notes || ''
                                        });
                                      }
                                    }}
                                    title="Toca para editar en ventana emergente"
                                  >
                                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                      <StickyNote size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                      <span className="font-semibold leading-tight break-words flex-1">{item.notes}</span>
                                    </div>
                                    {!isVentas && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveItemNote(item.id);
                                        }}
                                        className="p-1 -mr-1 -mt-0.5 text-amber-600 hover:text-red-600 hover:bg-amber-100/80 rounded transition-colors shrink-0"
                                        title="Eliminar esta nota"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  !isVentas && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingModalItem({
                                        id: item.id,
                                        articleId: item.articleId,
                                        quantity: item.quantity,
                                        notes: ''
                                      })}
                                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50/80 hover:bg-amber-100/90 border border-dashed border-amber-300 px-2 py-0.5 rounded-md active:scale-95 transition-all w-fit"
                                      title="Agregar nota a este artículo"
                                    >
                                      <StickyNote size={12} className="text-amber-600" />
                                      <span>+ Nota</span>
                                    </button>
                                  )
                                )}
                              </div>
                              {!isVentas && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button 
                                    type="button"
                                    onClick={() => setEditingModalItem({
                                      id: item.id,
                                      articleId: item.articleId,
                                      quantity: item.quantity,
                                      notes: item.notes || ''
                                    })}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-slate-200 active:scale-95 transition-all"
                                    title="Editar artículo en ventana emergente"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteSubdivision(item.id)}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-slate-200 active:scale-95 transition-all"
                                    title="Eliminar de la división"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Quick Quantity Counter on Card */}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100/80">
                              <span className="text-xs font-semibold text-slate-500">Cantidad:</span>
                              <div className="flex items-center gap-1.5">
                                {!isVentas && (
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, -1)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 font-bold"
                                    title="Restar 1"
                                  >
                                    <Minus size={13} />
                                  </button>
                                )}
                                <span className="font-mono font-bold text-sm text-blue-700 min-w-8 text-center bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {item.quantity}
                                </span>
                                {!isVentas && (
                                  <button 
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, 1)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 font-bold"
                                    title="Sumar 1"
                                  >
                                    <Plus size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Empty cell action - only if items exist */}
                {!isVentas && selectedCell.items.length > 0 && (
                  <div className="pt-2">
                    <button 
                      type="button"
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => {
                        if (confirm('¿Vaciar toda la división? Se eliminarán todos los artículos asignados a esta celda.')) {
                          updateCellItems(rack.id, selectedCell.row, selectedCell.col, []);
                          setSelectedCell({...selectedCell, items: []});
                        }
                      }}
                    >
                      <Trash2 size={13} /> Vaciar toda la división
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showCamera && (
        <CameraScanner 
          title={`Escanear en ${rack.name} (F${(selectedCell?.row ?? 0) + 1}-C${(selectedCell?.col ?? 0) + 1})`}
          onScan={processScannedCode} 
          onRemoveCode={handleRemoveScannedCode}
          onClose={() => setShowCamera(false)} 
        />
      )}

      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/60 z-[135] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-blue-600" />
                <h3 className="font-bold text-sm text-slate-800">Catálogo de Artículos</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 border-b border-slate-200 bg-white">
              <input 
                type="text"
                autoFocus
                placeholder="Buscar clave o descripción..."
                className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={catalogSearchText}
                onChange={(e) => setCatalogSearchText(e.target.value)}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Toca un artículo para seleccionarlo.</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {(() => {
                const query = catalogSearchText.trim().toLowerCase();
                const filtered = articles.filter(a => 
                  !query || 
                  a.id.toLowerCase().includes(query) || 
                  (a.description && a.description.toLowerCase().includes(query))
                ).slice(0, 60);

                if (filtered.length === 0) {
                  return <div className="p-6 text-center text-xs text-slate-400 italic">No se encontraron artículos que coincidan.</div>;
                }

                return filtered.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (editingModalItem) {
                        setEditingModalItem({
                          ...editingModalItem,
                          articleId: a.id
                        });
                      } else {
                        setEditingItem({
                          id: editingItem?.id || Date.now().toString(),
                          articleId: a.id,
                          quantity: editingItem?.quantity !== undefined ? editingItem.quantity : 1
                        });
                      }
                      setShowCatalogModal(false);
                    }}
                    className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex flex-col gap-0.5 rounded active:bg-blue-100"
                  >
                    <span className="font-mono font-bold text-xs text-blue-700">{a.id}</span>
                    <span className="text-xs text-slate-600 line-clamp-2">{a.description}</span>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}


{/* Move Cell Modal */}
      {showMoveModal && selectedCell && (
        <div className="fixed inset-0 bg-black/60 z-[125] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <ArrowDownUp size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 leading-tight">Mover Celda de Lugar</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Origen: Fila {selectedCell.row + 1} • Columna {selectedCell.col + 1} ({selectedCell.items.reduce((a, b) => a + b.quantity, 0)} piezas)
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-full transition-colors"
                title="Cerrar ventana"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Row selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Selecciona la Fila Destino:
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {Array.from({ length: rack.rows }).map((_, rIdx) => {
                    const isSelected = moveTargetRow === rIdx;
                    const isCurrent = selectedCell.row === rIdx && selectedCell.col === moveTargetCol;
                    return (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => setMoveTargetRow(rIdx)}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm scale-[1.02]'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95'
                        }`}
                      >
                        Fila {rIdx + 1}
                        {isCurrent && <span className="block text-[8px] opacity-75 font-normal">(Actual)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Selecciona la Columna Destino:
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {Array.from({ length: rack.cols }).map((_, cIdx) => {
                    const isSelected = moveTargetCol === cIdx;
                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => setMoveTargetCol(cIdx)}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm scale-[1.02]'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95'
                        }`}
                      >
                        Columna {cIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Destination status preview */}
              {(() => {
                const isSame = moveTargetRow === selectedCell.row && moveTargetCol === selectedCell.col;
                const targetCell = rack.cells?.find((c: any) => c.row === moveTargetRow && c.col === moveTargetCol);
                const targetItems = targetCell?.items && targetCell.items.length > 0 ? targetCell.items : (targetCell?.articleId ? [targetCell] : []);

                if (isSame) {
                  return (
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                      <Info size={16} className="text-slate-400 shrink-0" />
                      <span>La casilla seleccionada es la actual. Elige una fila o columna diferente.</span>
                    </div>
                  );
                }

                if (targetItems.length === 0) {
                  return (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold block">Destino F{moveTargetRow + 1} - C{moveTargetCol + 1} está vacío.</span>
                        <span className="text-[11px] text-emerald-700">Se colocará directamente en esta casilla limpia.</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                    <ArrowDown size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Destino F{moveTargetRow + 1} - C{moveTargetCol + 1} ocupado ({targetItems.length} artículos).</span>
                      <span className="text-[11px] text-amber-800">
                        Se colocará aquí y los artículos inferiores de esta columna se desplazarán hacia abajo.
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Alternative: Tap in rack */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setReorderSourceCell(selectedCell);
                    setReorderMode(true);
                    setShowMoveModal(false);
                    setSelectedCell(null);
                  }}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <GripVertical size={14} className="text-slate-500" />
                  <span>O tocar directamente la casilla en el mapa del Rack</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={moveTargetRow === selectedCell.row && moveTargetCol === selectedCell.col}
                onClick={() => {
                  const fromR = selectedCell.row;
                  const fromC = selectedCell.col;
                  const toR = moveTargetRow;
                  const toC = moveTargetCol;
                  executeMoveAndShift(fromR, fromC, toR, toC);
                  setShowMoveModal(false);
                  setSelectedCell({
                    row: toR,
                    col: toC,
                    items: selectedCell.items
                  });
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <ArrowDownUp size={15} />
                <span>Confirmar y Mover</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Edit Popup Modal */}
      {editingModalItem && (
        <div className="fixed inset-0 bg-black/60 z-[125] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 bg-gradient-to-r from-slate-100 to-blue-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 leading-tight">Editar Artículo</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Fila {(selectedCell?.row ?? 0) + 1} • Columna {(selectedCell?.col ?? 0) + 1}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-full transition-colors"
                title="Cerrar ventana"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ScanBarcode size={14} className="text-blue-600" />
                    Código / Clave del Artículo:
                  </label>
                  {articles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setCatalogSearchText(''); setShowCatalogModal(true); }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <Search size={12} /> Buscar en Catálogo
                    </button>
                  )}
                </div>
                <input 
                  type="text"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                  value={editingModalItem.articleId}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => setEditingModalItem({
                    ...editingModalItem,
                    articleId: e.target.value.toUpperCase()
                  })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveModalItem();
                    }
                  }}
                />
                {editingModalItem.articleId.trim() ? (
                  (() => {
                    const clean = editingModalItem.articleId.trim().toUpperCase();
                    const matched = articleMap.get(clean);
                    if (matched) {
                      return (
                        <div className="mt-1.5 text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-start gap-1.5">
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-600 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-bold">En catálogo:</span> {matched.description}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-1.5 text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                        <Info size={14} className="shrink-0 text-amber-600" />
                        <span>Código sin descripción en catálogo (se guardará como manual)</span>
                      </div>
                    );
                  })()
                ) : null}
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cantidad de piezas:
                </label>
                <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 overflow-hidden shadow-sm max-w-[220px]">
                  <button 
                    type="button"
                    onClick={() => {
                      const current = Number(editingModalItem.quantity) || 1;
                      setEditingModalItem({
                        ...editingModalItem,
                        quantity: Math.max(1, current - 1)
                      });
                    }}
                    className="w-12 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 font-bold transition-colors"
                    title="Restar 1"
                  >
                    <Minus size={18} />
                  </button>
                  <input 
                    type="number"
                    min="1"
                    className="flex-1 h-11 text-center text-base font-bold text-slate-800 bg-white border-x border-slate-200 focus:outline-none"
                    value={editingModalItem.quantity !== undefined ? editingModalItem.quantity : 1}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, Number(e.target.value));
                      setEditingModalItem({
                        ...editingModalItem,
                        quantity: val as any
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveModalItem();
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      const current = Number(editingModalItem.quantity) || 1;
                      setEditingModalItem({
                        ...editingModalItem,
                        quantity: current + 1
                      });
                    }}
                    className="w-12 h-11 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 font-bold transition-colors"
                    title="Sumar 1"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <StickyNote size={14} className="text-amber-600" />
                    Nota u Observación:
                  </label>
                  {editingModalItem.notes && (
                    <button
                      type="button"
                      onClick={() => setEditingModalItem({ ...editingModalItem, notes: '' })}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Borrar nota
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ARTICLE_NOTE_PRESETS.map((preset) => {
                    const isSelected = editingModalItem.notes?.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const current = editingModalItem.notes || '';
                          const updated = current ? `${current} • ${preset}` : preset;
                          setEditingModalItem({
                            ...editingModalItem,
                            notes: updated
                          });
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={2}
                  placeholder="Escribe una observación personalizada o toca una etiqueta arriba..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  value={editingModalItem.notes || ''}
                  onChange={(e) => setEditingModalItem({
                    ...editingModalItem,
                    notes: e.target.value
                  })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSaveModalItem();
                    }
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button 
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar ${editingModalItem.articleId} de esta división?`)) {
                    handleDeleteSubdivision(editingModalItem.id);
                    setEditingModalItem(null);
                  }
                }}
                className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={15} />
                <span>Eliminar</span>
              </button>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setEditingModalItem(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSaveModalItem}
                  disabled={!editingModalItem.articleId.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Save size={15} />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rack Notes Modal */}
      {showRackNotesModal && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-amber-900">
                <StickyNote size={18} className="text-amber-700" />
                <h3 className="font-bold text-sm">Notas del Rack: {rack.name}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowRackNotesModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  Etiquetas rápidas para este rack:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RACK_NOTE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const updated = rackNotesDraft ? `${rackNotesDraft} • ${preset}` : preset;
                        setRackNotesDraft(updated);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 active:scale-95 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Escribe observaciones generales del rack:
                </label>
                <textarea
                  rows={4}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Ej. Mercancía pesada en niveles 1 y 2, tarima auxiliar frente al rack..."
                  value={rackNotesDraft}
                  onChange={(e) => setRackNotesDraft(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    updateRackProperties(rack.id, { notes: undefined });
                    setRackNotesDraft('');
                    setShowRackNotesModal(false);
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                >
                  Borrar nota
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRackNotesModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateRackProperties(rack.id, { notes: rackNotesDraft.trim() || undefined });
                      setShowRackNotesModal(false);
                      useStore.getState().saveToCloud();
                    }}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                  >
                    <Save size={14} /> Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Drag Ghost */}
      {draggedCell && dragPosition && (
        <div 
          className="fixed pointer-events-none z-[140] -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur border-2 border-blue-600 rounded-xl p-2.5 shadow-2xl flex flex-col items-center gap-0.5 scale-105 rotate-2"
          style={{ left: dragPosition.x, top: dragPosition.y, width: 140 }}
        >
          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            F{draggedCell.row + 1} - C{draggedCell.col + 1}
          </span>
          <span className="font-bold text-xs text-slate-800 text-center truncate w-full">
            {draggedCell.items.length > 1 ? `Múltiples (${draggedCell.items.length})` : draggedCell.items[0]?.articleId}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">
            Total: {draggedCell.items.reduce((acc: number, i: any) => acc + i.quantity, 0)} piezas
          </span>
        </div>
      )}

      {/* Floating Toast Notification with Undo */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/95 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[90vw]">
          <span className="font-medium truncate">{toastMessage}</span>
          {undoState && (
            <button
              type="button"
              onClick={handleUndo}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shrink-0"
            >
              <RotateCcw size={13} /> Deshacer
            </button>
          )}
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-0.5 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

