import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Save } from 'lucide-react';

export const RackFrontalView: React.FC = () => {
  const { branches, activeBranchId, activeRoomId, activeRackId, setActiveRack, articles, assignArticleToCell } = useStore();
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number, articleId: string | null, quantity: number} | null>(null);


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

  // Render a grid based on rack rows and cols
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
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
                let cellColor = "bg-slate-50";
                let text = "Vacío";
                
                if (cell && cell.articleId) {
                   const art = useStore.getState().articles.find((a: any) => a.id === cell.articleId);
                   text = cell.articleId;
                   if (art) {
                      if (art.status === 'SCRAP' || art.status === 'DAMAGED') cellColor = 'bg-red-200 border-red-400';
                      else if (art.status === 'SLOW' || art.status === 'OFFLINE') cellColor = 'bg-yellow-200 border-yellow-400';
                      else cellColor = 'bg-green-200 border-green-400';
                   } else {
                      cellColor = 'bg-blue-200 border-blue-400'; // Unknown status
                   }
                }
                
                const cellId = `${rack?.id}-r${rIndex}-c${cIndex}`;
                return (
                  <div 
                    key={cellId} 
                    className={`${cellColor} rounded shadow-inner border flex items-center justify-center relative hover:opacity-80 cursor-pointer transition-colors ${selectedCell?.row === rIndex && selectedCell?.col === cIndex ? 'ring-4 ring-blue-500 z-10' : ''}`}
                    onClick={() => {
                      setSelectedCell({
                        row: rIndex,
                        col: cIndex,
                        articleId: cell?.articleId || null,
                        quantity: cell?.quantity || 0
                      });
                    }}
                  >
                    <span className="text-black/30 text-[10px] font-mono absolute bottom-1 right-1">
                      F{rIndex+1}-C{cIndex+1}
                    </span>
                    <div className="text-xs font-bold text-slate-700 text-center px-1 truncate w-full">
                      {text}
                    </div>
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Footer/Tools */}
        <div className="p-4 border-t border-slate-200 bg-white rounded-b-xl flex flex-col md:flex-row justify-between items-center min-h-[80px]">
            {selectedCell ? (
              <div className="flex-1 flex flex-wrap gap-4 items-end w-full">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fila {selectedCell.row + 1} - Columna {selectedCell.col + 1}</label>
                  <select 
                    className="p-2 border border-slate-300 rounded text-sm w-64"
                    value={selectedCell.articleId || ''}
                    onChange={(e) => setSelectedCell({...selectedCell, articleId: e.target.value || null})}
                  >
                    <option value="">-- Sin asignar --</option>
                    {articles.map(a => (
                      <option key={a.id} value={a.id}>{a.id} - {a.description.substring(0,20)}...</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Cantidad</label>
                  <input 
                    type="number" 
                    className="p-2 border border-slate-300 rounded text-sm w-24"
                    value={selectedCell.quantity}
                    onChange={(e) => setSelectedCell({...selectedCell, quantity: Number(e.target.value)})}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                    onClick={() => {
                       assignArticleToCell(rack.id, selectedCell.row, selectedCell.col, selectedCell.articleId, selectedCell.quantity);
                       setSelectedCell(null);
                    }}
                  >
                    <Save size={16} /> Guardar
                  </button>
                  <button 
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded shadow hover:bg-slate-300 text-sm font-medium"
                    onClick={() => setSelectedCell(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm text-slate-600">
                  Total posiciones: {rack.rows * rack.cols}
                </div>
                <div className="text-sm text-slate-500 italic">
                  Haz clic en una división para asignar material
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
};
