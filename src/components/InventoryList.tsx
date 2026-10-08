import React, { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Plus, Minus, PackageOpen, ArrowUpDown, Map } from 'lucide-react';

interface InventoryListProps {
  onNavigateToMap: () => void;
}

type SortKey = 'branchName' | 'locationLabel' | 'articleId' | 'description' | 'quantity';

export const InventoryList: React.FC<InventoryListProps> = ({ onNavigateToMap }) => {
  const { branches, articles, userBranchScope, updateCellItemQuantity, setActiveBranch, setActiveRoom, setSelectedShapeId, setActiveRack } = useStore();
  const [searchFilter, setSearchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>(null);

  // Extract all inventory locations
  const inventoryItems = useMemo(() => {
    const items: Array<{
      branchId: string;
      branchName: string;
      roomId: string;
      roomName: string;
      roomLevel: number;
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
                  roomLevel: room.level || 0,
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
                roomLevel: room.level || 0,
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

  const sortedAndFilteredItems = useMemo(() => {
    let result = inventoryItems;

    if (searchFilter.trim()) {
      const lowerFilter = searchFilter.toLowerCase();
      result = result.filter(i => 
        i.articleId.toLowerCase().includes(lowerFilter) ||
        i.description.toLowerCase().includes(lowerFilter) ||
        i.rackName.toLowerCase().includes(lowerFilter) ||
        i.branchName.toLowerCase().includes(lowerFilter) ||
        i.roomName.toLowerCase().includes(lowerFilter)
      );
    }

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [inventoryItems, searchFilter, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: SortKey, align?: 'left' | 'center' }) => (
    <th className={`p-4 font-bold text-sm cursor-pointer hover:bg-slate-700 transition-colors ${align === 'center' ? 'text-center' : 'text-left'}`} onClick={() => requestSort(sortKey)}>
      <div className={`flex items-center gap-2 ${align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <ArrowUpDown size={14} className={sortConfig?.key === sortKey ? 'text-blue-400' : 'text-slate-500'} />
      </div>
    </th>
  );

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
                <tr className="bg-slate-800 text-white select-none">
                  <SortHeader label="Sucursal / Hab." sortKey="branchName" />
                  <SortHeader label="Ubicación" sortKey="locationLabel" />
                  <SortHeader label="Código" sortKey="articleId" />
                  <SortHeader label="Descripción" sortKey="description" />
                  <SortHeader label="Existencia" sortKey="quantity" align="center" />
                  <th className="p-4 font-bold text-sm text-center rounded-tr-xl">Ajustar</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No se encontraron artículos asignados en las ubicaciones o el filtro no coincide.
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredItems.map((item, idx) => (
                    <tr key={`${item.rackId}-${item.cellRow}-${item.cellCol}-${item.articleId}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm">
                        <span className="block font-bold text-slate-700">{item.branchName}</span>
                        <span className="text-xs text-slate-500">{item.roomName}</span>
                      </td>
                      <td className="p-4 text-sm font-mono bg-blue-50/50">
                        <button 
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-bold"
                          onClick={() => {
                             useStore.getState().setActiveLevel(item.roomLevel);
                             setActiveBranch(item.branchId);
                             setActiveRoom(item.roomId);
                             setSelectedShapeId(item.rackId);
                             setActiveRack(item.rackId);
                             onNavigateToMap();
                          }}
                          title="Ver en el Mapa"
                        >
                          <Map size={14} />
                          {item.locationLabel}
                        </button>
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
