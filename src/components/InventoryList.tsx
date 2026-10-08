import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Plus, Minus, PackageOpen } from 'lucide-react';

export const InventoryList: React.FC = () => {
  const { branches, articles, userBranchScope, updateCellItemQuantity } = useStore();
  const [searchFilter, setSearchFilter] = useState('');

  // Extract all inventory locations
  const inventoryItems = useMemo(() => {
    const items: Array<{
      branchId: string;
      branchName: string;
      roomId: string;
      roomName: string;
      rackId: string;
      rackName: string;
      locationLabel: string;
      articleId: string;
      description: string;
      quantity: number;
      cellRow: number;
      cellCol: number;
    }> = [];

    // Filter branches if user has a scope
    const visibleBranches = userBranchScope 
      ? branches.filter(b => b.id === userBranchScope)
      : branches;

    visibleBranches.forEach(branch => {
      branch.rooms.forEach(room => {
        // Collect racks from areas
        room.areas.forEach(area => {
          area.racks.forEach(rack => {
            if (!rack.cells) return;
            rack.cells.forEach(cell => {
              const cellItems = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{ articleId: cell.articleId, quantity: 1 }] : []);
              cellItems.forEach((item: any) => {
                if (!item.articleId) return;
                const articleData = articles.find(a => a.id === item.articleId);
                items.push({
                  branchId: branch.id,
                  branchName: branch.name,
                  roomId: room.id,
                  roomName: room.name,
                  rackId: rack.id,
                  rackName: rack.name,
                  locationLabel: `${rack.name} - F${cell.row} C${cell.col}`,
                  articleId: item.articleId,
                  description: articleData?.description || 'Desconocido',
                  quantity: item.quantity || 1,
                  cellRow: cell.row,
                  cellCol: cell.col
                });
              });
            });
          });
        });

        // Collect racks from room
        room.racks.forEach(rack => {
          if (!rack.cells) return;
          rack.cells.forEach(cell => {
            const cellItems = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{ articleId: cell.articleId, quantity: 1 }] : []);
            cellItems.forEach((item: any) => {
              if (!item.articleId) return;
              const articleData = articles.find(a => a.id === item.articleId);
              items.push({
                branchId: branch.id,
                branchName: branch.name,
                roomId: room.id,
                roomName: room.name,
                rackId: rack.id,
                rackName: rack.name,
                locationLabel: `${rack.name} - F${cell.row} C${cell.col}`,
                articleId: item.articleId,
                description: articleData?.description || 'Desconocido',
                quantity: item.quantity || 1,
                cellRow: cell.row,
                cellCol: cell.col
              });
            });
          });
        });
      });
    });

    return items;
  }, [branches, articles, userBranchScope]);

  const filteredItems = useMemo(() => {
    if (!searchFilter.trim()) return inventoryItems;
    const lowerFilter = searchFilter.toLowerCase();
    return inventoryItems.filter(i => 
      i.articleId.toLowerCase().includes(lowerFilter) ||
      i.description.toLowerCase().includes(lowerFilter) ||
      i.rackName.toLowerCase().includes(lowerFilter) ||
      i.branchName.toLowerCase().includes(lowerFilter) ||
      i.roomName.toLowerCase().includes(lowerFilter)
    );
  }, [inventoryItems, searchFilter]);

  return (
    <div className="w-full h-full p-4 md:p-8 bg-slate-100 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2">
              <PackageOpen size={32} className="text-blue-600" />
              Inventario en Ubicaciones
            </h1>
            <p className="text-slate-500">Lista detallada de existencias físicas por celda y rack.</p>
          </div>

          <div className="bg-white shadow rounded-lg p-2 flex items-center w-full md:w-80">
            <Search className="text-slate-400 mx-2" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por código, descripción o rack..." 
              className="bg-transparent border-none outline-none w-full text-sm font-medium"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 font-bold text-sm rounded-tl-xl">Sucursal / Hab.</th>
                  <th className="p-4 font-bold text-sm">Ubicación</th>
                  <th className="p-4 font-bold text-sm">Código</th>
                  <th className="p-4 font-bold text-sm">Descripción</th>
                  <th className="p-4 font-bold text-sm text-center">Existencia</th>
                  <th className="p-4 font-bold text-sm text-center rounded-tr-xl">Ajustar</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No se encontraron artículos asignados en las ubicaciones o el filtro no coincide.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={`${item.rackId}-${item.cellRow}-${item.cellCol}-${item.articleId}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm">
                        <span className="block font-bold text-slate-700">{item.branchName}</span>
                        <span className="text-xs text-slate-500">{item.roomName}</span>
                      </td>
                      <td className="p-4 text-sm font-mono text-blue-600 bg-blue-50/50">
                        {item.locationLabel}
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-700">
                        {item.articleId}
                      </td>
                      <td className="p-4 text-sm truncate max-w-xs text-slate-600">
                        {item.description}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-block bg-slate-800 text-white px-3 py-1 rounded-full font-bold text-sm">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => updateCellItemQuantity(item.rackId, item.cellRow, item.cellCol, item.articleId, -1)}
                            className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-200 rounded-full transition-colors"
                            title="Descontar 1"
                          >
                            <Minus size={16} />
                          </button>
                          <button 
                            onClick={() => updateCellItemQuantity(item.rackId, item.cellRow, item.cellCol, item.articleId, 1)}
                            className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 hover:bg-green-200 rounded-full transition-colors"
                            title="Agregar 1"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
