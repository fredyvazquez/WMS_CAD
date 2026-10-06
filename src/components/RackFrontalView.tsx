import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Save, Plus, Trash2 } from 'lucide-react';

export const RackFrontalView: React.FC = () => {
  const { branches, activeBranchId, activeRoomId, activeRackId, setActiveRack, articles, updateCellItems, searchQuery, currentUserRole } = useStore();
  const isVentas = currentUserRole === 'VENTAS';
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number, items: {id: string, articleId: string, quantity: number}[]} | null>(null);

  // For the active edit form of an item inside the selected cell
  const [editingItem, setEditingItem] = useState<{id: string, articleId: string, quantity: number} | null>(null);

  if (!activeRackId) return null;

  const branch = branches.find(b => b.id === activeBranchId);
  const room = branch?.rooms.find(r => r.id === activeRoomId);
  
  let rack;
  if (room) {
    for (const area of room.areas) {
      rack = area.racks.find(r => r.id === activeRackId);
      if (rack) break;
    }
    if (!rack) {
      rack = room.racks.find(r => r.id === activeRackId);
    }
  }

  if (!rack) return null;

  const handleSaveSubdivision = () => {
    if (!selectedCell || !editingItem || !editingItem.articleId) return;
    
    let newItems = [...selectedCell.items];
    const existingIndex = newItems.findIndex(i => i.id === editingItem.id);
    if (existingIndex >= 0) {
      newItems[existingIndex] = editingItem;
    } else {
      newItems.push(editingItem);
    }
    
    // Save to store immediately
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({...selectedCell, items: newItems});
    setEditingItem(null);
  };

  const handleDeleteSubdivision = (id: string) => {
    if (!selectedCell) return;
    const newItems = selectedCell.items.filter(i => i.id !== id);
    updateCellItems(rack.id, selectedCell.row, selectedCell.col, newItems);
    setSelectedCell({...selectedCell, items: newItems});
  };

  // Render a grid based on rack rows and cols
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Vista Frontal: {rack.name}</h2>
            <p className="text-sm text-slate-500">
              {branch?.name} &gt; {room?.name} &gt; Dimensiones: {rack.width}x{rack.height}x{rack.depth} cm
            </p>
          </div>
          <button 
            onClick={() => setActiveRack(null)}
            className="p-2 hover:bg-slate-200 rounded-full"
          >
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Content (Grid) */}
          <div className="flex-1 p-8 bg-slate-100 overflow-auto flex items-center justify-center">
            <div 
              className="grid gap-2 p-4 bg-orange-600 rounded-lg shadow-lg border-8 border-orange-700"
              style={{ 
                gridTemplateColumns: `repeat(${rack.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rack.rows}, minmax(0, 1fr))`,
                width: '100%',
                minHeight: '60vh'
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

                  let cellColor = "bg-slate-50";
                  let text = "Vacío";
                  let hasMatch = false;
                  
                  if (cellItems.length > 0) {
                     const firstItem = cellItems[0];
                     const art = useStore.getState().articles.find((a: any) => a.id === firstItem.articleId);
                     text = cellItems.length > 1 ? `Múltiples (${cellItems.length})` : firstItem.articleId;
                     
                     if (searchQuery) {
                       hasMatch = cellItems.some((i: any) => {
                         const a = useStore.getState().articles.find((x: any) => x.id === i.articleId);
                         return i.articleId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                               (a && a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()));
                       });
                     }

                     if (hasMatch) {
                        cellColor = 'bg-purple-500 border-purple-700 text-white';
                     } else if (searchQuery) {
                        cellColor = 'bg-slate-200 border-slate-300 opacity-50'; // Dim non-matches
                     } else if (art) {
                        if (art.status === 'SCRAP' || art.status === 'DAMAGED') cellColor = 'bg-red-200 border-red-400';
                        else if (art.status === 'SLOW' || art.status === 'OFFLINE') cellColor = 'bg-yellow-200 border-yellow-400';
                        else cellColor = 'bg-green-200 border-green-400';
                     } else {
                        cellColor = 'bg-blue-200 border-blue-400'; // Unknown status
                     }
                  } else if (searchQuery) {
                     cellColor = 'bg-slate-200 border-slate-300 opacity-50'; // Dim empty if searching
                  }
                  
                  const cellId = `${rack?.id}-r${rIndex}-c${cIndex}`;
                  return (
                    <div 
                      key={cellId} 
                      className={`${cellColor} rounded shadow-inner border flex flex-col items-center justify-center relative hover:opacity-80 cursor-pointer transition-colors ${selectedCell?.row === rIndex && selectedCell?.col === cIndex ? 'ring-4 ring-blue-500 z-10' : ''}`}
                      onClick={() => {
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
                      <span className="text-black/40 text-[10px] font-mono absolute bottom-1 right-1">
                        F{rIndex+1}-C{cIndex+1}
                      </span>
                      <div className="text-xs font-bold text-slate-700 text-center px-1 truncate w-full">
                        {text}
                      </div>
                      {cellItems.length > 0 && (
                        <div className="text-[10px] text-slate-600 mt-1">
                          Total Qty: {cellItems.reduce((acc: number, item: any) => acc + item.quantity, 0)}
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {/* Side Panel for Subdivisions */}
          {selectedCell && (
            <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
              <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                <h3 className="font-bold text-blue-800 text-sm">Fila {selectedCell.row + 1} - Columna {selectedCell.col + 1}</h3>
                <button onClick={() => setSelectedCell(null)} className="text-blue-500 hover:text-blue-700"><X size={16}/></button>
              </div>

              <div className="flex-1 overflow-auto p-3">
                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Subdivisiones / Artículos</h4>
                
                {selectedCell.items.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mb-4">No hay artículos en esta división.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {selectedCell.items.map((item) => {
                      const art = articles.find(a => a.id === item.articleId);
                      return (
                        <div key={item.id} className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex flex-col gap-1 relative group">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-sm truncate pr-12">{item.articleId}</span>
                            {!isVentas && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-50 pl-2">
                                <button 
                                  className="text-blue-500 hover:text-blue-700 bg-white shadow-sm p-1 rounded"
                                  onClick={() => setEditingItem(item)}
                                  title="Editar"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                                <button 
                                  className="text-red-500 hover:text-red-700 bg-white shadow-sm p-1 rounded"
                                  onClick={() => handleDeleteSubdivision(item.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 truncate">{art?.description || 'Desconocido'}</span>
                          <div className="text-xs font-semibold text-blue-600 mt-1">Cantidad: {item.quantity}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Edit Form */}
                {!isVentas && (
                  <div className="border-t border-slate-200 pt-3 mt-2">
                    <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                      <Plus size={14} /> Agregar / Editar Artículo
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <label className="block text-xs text-slate-500 mb-1">Clave de Artículo</label>
                        <input 
                          type="text"
                          placeholder="Buscar clave o descripción..."
                          className="p-2 border border-slate-300 rounded text-sm w-full"
                          value={editingItem?.articleId || ''}
                          onChange={(e) => setEditingItem({...editingItem, id: editingItem?.id || Date.now().toString(), articleId: e.target.value, quantity: editingItem?.quantity || 1})}
                          list="article-search-list"
                        />
                        <datalist id="article-search-list">
                          {articles.map(a => (
                            <option key={a.id} value={a.id}>{a.description.substring(0,50)}</option>
                          ))}
                        </datalist>
                        {editingItem?.articleId && articles.find(a => a.id === editingItem.articleId) && (
                          <div className="mt-1 text-xs text-green-700 bg-green-50 p-1.5 rounded border border-green-200 shadow-sm leading-tight">
                            {articles.find(a => a.id === editingItem.articleId)?.description}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Cantidad</label>
                        <input 
                          type="number" 
                          className="p-2 border border-slate-300 rounded text-sm w-full"
                          value={editingItem?.quantity || ''}
                          onChange={(e) => setEditingItem({...editingItem, id: editingItem?.id || Date.now().toString(), articleId: editingItem?.articleId || '', quantity: Number(e.target.value)})}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        {editingItem?.id && selectedCell.items.some(i => i.id === editingItem.id) && (
                          <button 
                            className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded shadow hover:bg-slate-300 text-sm font-medium flex items-center justify-center"
                            onClick={() => setEditingItem(null)}
                          >
                            Cancelar
                          </button>
                        )}
                        <button 
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                          onClick={handleSaveSubdivision}
                          disabled={!editingItem?.articleId}
                        >
                          <Save size={16} /> Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
              {!isVentas && (
                <div className="p-3 border-t border-slate-200 bg-slate-50">
                  <button 
                    className="w-full bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded text-sm font-medium hover:bg-red-100"
                    onClick={() => {
                      if (confirm('¿Vaciar toda la división?')) {
                        updateCellItems(rack.id, selectedCell.row, selectedCell.col, []);
                        setSelectedCell({...selectedCell, items: []});
                      }
                    }}
                  >
                    Vaciar toda la división
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

