import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Search, Plus, Minus, PackageOpen, ArrowUpDown, Map as MapIcon, 
  Trash2, AlertTriangle, CheckCircle2, Layers, Check, ShieldAlert,
  Camera, LayoutGrid, Table as TableIcon, ChevronDown, ChevronUp, X,
  ChevronsUpDown, ChevronsDownUp
} from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface InventoryListProps {
  onNavigateToMap: () => void;
}

type SortKey = 'branchName' | 'articleId' | 'description' | 'totalQuantity' | 'locationsCount';

export const InventoryList: React.FC<InventoryListProps> = ({ onNavigateToMap }) => {
  const { 
    branches, 
    articles, 
    userBranchScope, 
    updateCellItemQuantity, 
    removeCellItem,
    setActiveBranch, 
    setActiveRoom, 
    setSelectedShapeId, 
    setActiveRack 
  } = useStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'DUPLICATES'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>({ key: 'locationsCount', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  
  // Mobile enhancements state
  const [showScanner, setShowScanner] = useState(false);
  const [showKpis, setShowKpis] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // Collapsed items state (set of item keys "branchId-articleId")
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  // Determine default layout: cards on mobile (< 768px), table on desktop
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setViewLayout('table');
      } else {
        setViewLayout('cards');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  type Location = {
    roomId: string;
    roomName: string;
    roomLevel: number;
    rackId: string;
    rackName: string;
    locationLabel: string;
    quantity: number;
    cellRow: number;
    cellCol: number;
  };

  type GroupedItem = {
    branchId: string;
    branchName: string;
    articleId: string;
    description: string;
    totalQuantity: number;
    locations: Location[];
  };

  // Extract all inventory locations and group them by articleId and branchId
  const inventoryItems: GroupedItem[] = useMemo(() => {
    const articleMap = new Map<string, any>();
    if (articles) {
      for (let i = 0; i < articles.length; i++) {
        articleMap.set(articles[i].id.trim().toUpperCase(), articles[i]);
      }
    }

    const map = new Map<string, GroupedItem>();

    const visibleBranches = userBranchScope 
      ? branches.filter(b => b.id === userBranchScope)
      : branches;

    visibleBranches.forEach(branch => {
      branch.rooms.forEach(room => {
        const processRack = (rack: any) => {
          if (!rack.cells) return;
          rack.cells.forEach((cell: any) => {
            const cellItems = cell.items && cell.items.length > 0 ? cell.items : (cell.articleId ? [{ articleId: cell.articleId, quantity: 1 }] : []);
            cellItems.forEach((item: any) => {
              if (!item.articleId) return;
              const articleData = articleMap.get(item.articleId.trim().toUpperCase());
              const key = `${branch.id}-${item.articleId}`;
              
              if (!map.has(key)) {
                map.set(key, {
                  branchId: branch.id,
                  branchName: branch.name,
                  articleId: item.articleId,
                  description: articleData?.description || 'Desconocido',
                  totalQuantity: 0,
                  locations: []
                });
              }
              
              const group = map.get(key)!;
              group.totalQuantity += (item.quantity || 1);
              group.locations.push({
                roomId: room.id,
                roomName: room.name,
                roomLevel: room.level || 0,
                rackId: rack.id,
                rackName: rack.name,
                locationLabel: `${rack.name} - F${cell.row + 1} C${cell.col + 1}`,
                quantity: item.quantity || 1,
                cellRow: cell.row,
                cellCol: cell.col
              });
            });
          });
        };

        room.areas.forEach(area => area.racks.forEach(processRack));
        room.racks.forEach(processRack);
      });
    });

    return Array.from(map.values());
  }, [branches, articles, userBranchScope]);

  // Statistics
  const duplicateCount = useMemo(() => {
    return inventoryItems.filter(i => i.locations.length > 1).length;
  }, [inventoryItems]);

  const singleCount = useMemo(() => {
    return inventoryItems.filter(i => i.locations.length === 1).length;
  }, [inventoryItems]);

  const totalPieces = useMemo(() => {
    return inventoryItems.reduce((acc, i) => acc + i.totalQuantity, 0);
  }, [inventoryItems]);

  // Filter and sort
  const sortedAndFilteredItems = useMemo(() => {
    let result: GroupedItem[] = inventoryItems;

    // Filter by duplicates tab
    if (filterMode === 'DUPLICATES') {
      result = result.filter(i => i.locations.length > 1);
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(i => String(i[key as keyof GroupedItem]) === value);
      }
    });

    // Text search
    if (searchFilter.trim()) {
      const lowerFilter = searchFilter.toLowerCase().trim();
      const isDuplicateKeyword = ['repetido', 'repetidos', 'duplicado', 'duplicados', 'multiple', 'multiples'].includes(lowerFilter);
      
      result = result.filter(i => {
        if (isDuplicateKeyword && i.locations.length > 1) return true;
        return (
          i.articleId.toLowerCase().includes(lowerFilter) ||
          i.description.toLowerCase().includes(lowerFilter) ||
          i.branchName.toLowerCase().includes(lowerFilter) ||
          i.locations.some(loc => 
            loc.rackName.toLowerCase().includes(lowerFilter) || 
            loc.roomName.toLowerCase().includes(lowerFilter) ||
            loc.locationLabel.toLowerCase().includes(lowerFilter)
          )
        );
      });
    }

    // Sorting
    if (sortConfig !== null) {
      result = [...result].sort((a: GroupedItem, b: GroupedItem) => {
        if (sortConfig.key === 'locationsCount') {
          const valA = a.locations.length;
          const valB = b.locations.length;
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

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
  }, [inventoryItems, filterMode, searchFilter, sortConfig, columnFilters]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleRemoveLocation = (item: GroupedItem, loc: Location) => {
    const confirmMsg = `¿Eliminar "${item.articleId}" de la ubicación ${loc.locationLabel} (${loc.roomName})?\n\nEsta celda dejará de tener este artículo registrado.`;
    if (window.confirm(confirmMsg)) {
      removeCellItem(loc.rackId, loc.cellRow, loc.cellCol, item.articleId);
    }
  };

  const uniqueBranches = useMemo(() => {
    const set = new Set<string>();
    inventoryItems.forEach(i => set.add(i.branchName));
    return Array.from(set).sort();
  }, [inventoryItems]);

  const uniqueArticles = useMemo(() => {
    const set = new Set<string>();
    inventoryItems.forEach(i => set.add(i.articleId));
    return Array.from(set).sort();
  }, [inventoryItems]);

  const uniqueDescriptions = useMemo(() => {
    const set = new Set<string>();
    inventoryItems.forEach(i => set.add(i.description));
    return Array.from(set).sort();
  }, [inventoryItems]);

  // Collapse / Expand helpers
  const toggleItemCollapse = (itemKey: string) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const duplicateItemKeys = useMemo(() => {
    return sortedAndFilteredItems
      .filter(i => i.locations.length > 1)
      .map(i => `${i.branchId}-${i.articleId}`);
  }, [sortedAndFilteredItems]);

  const allDuplicatesCollapsed = useMemo(() => {
    if (duplicateItemKeys.length === 0) return false;
    return duplicateItemKeys.every(k => collapsedItems.has(k));
  }, [duplicateItemKeys, collapsedItems]);

  const toggleCollapseAll = () => {
    if (allDuplicatesCollapsed || collapsedItems.size > 0) {
      setCollapsedItems(new Set());
    } else {
      const keysToCollapse = duplicateItemKeys.length > 0 
        ? duplicateItemKeys 
        : sortedAndFilteredItems.map(i => `${i.branchId}-${i.articleId}`);
      setCollapsedItems(new Set(keysToCollapse));
    }
  };

  return (
    <div className="w-full h-full p-2.5 sm:p-4 md:p-8 bg-slate-100 overflow-y-auto pb-36">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-6">
        
        {/* Header and Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 sm:gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2">
                <PackageOpen size={26} className="text-blue-600 shrink-0" />
                <span>Inventario en Ubicaciones</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Auditoría y control de existencias físicas por celda.
              </p>
            </div>

            {/* Mobile Toggle for KPIs */}
            <button
              onClick={() => setShowKpis(!showKpis)}
              className="md:hidden flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
            >
              <span>{showKpis ? 'Ocultar' : 'Resumen'}</span>
              {showKpis ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Search Box with Camera Scanner */}
          <div className="bg-white shadow-xs border border-slate-200 rounded-xl p-1.5 sm:p-2 flex items-center w-full md:w-96 gap-1">
            <Search className="text-slate-400 ml-1 shrink-0" size={17} />
            <input 
              type="text" 
              placeholder="Buscar código, rack, 'repetido'..." 
              className="bg-transparent border-none outline-none w-full text-xs sm:text-sm font-medium text-slate-700 placeholder:text-slate-400 px-1"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button 
                onClick={() => setSearchFilter('')}
                className="text-xs text-slate-400 hover:text-slate-600 p-1"
                title="Limpiar"
              >
                <X size={14} />
              </button>
            )}
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg font-bold text-xs transition-colors shrink-0"
              title="Escanear código de barras con la cámara"
            >
              <Camera size={14} />
              <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>
        </div>

        {/* Audit KPI Cards (Collapsible on mobile) */}
        {showKpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {/* Total Unique Articles */}
            <div 
              onClick={() => setFilterMode('ALL')}
              className={`cursor-pointer p-2.5 sm:p-3.5 rounded-xl border transition-all ${
                filterMode === 'ALL' 
                  ? 'bg-blue-50/90 border-blue-400 shadow-xs ring-2 ring-blue-400/30' 
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Artículos
                </span>
                <Layers size={15} className="text-blue-600" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-800">
                {inventoryItems.length}
              </div>
              <div className="hidden sm:block text-[11px] text-slate-500 mt-0.5">
                Códigos con stock en rack
              </div>
            </div>

            {/* Total Physical Pieces */}
            <div className="p-2.5 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Piezas Físicas
                </span>
                <PackageOpen size={15} className="text-indigo-600" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-800">
                {totalPieces}
              </div>
              <div className="hidden sm:block text-[11px] text-slate-500 mt-0.5">
                Existencia total contada
              </div>
            </div>

            {/* Single Location (OK) */}
            <div className="p-2.5 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Ubicación Única
                </span>
                <CheckCircle2 size={15} className="text-emerald-600" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-700">
                {singleCount}
              </div>
              <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5">
                ✓ Sin duplicados
              </div>
            </div>

            {/* Repeated Codes (Auditing Required!) */}
            <div 
              onClick={() => setFilterMode('DUPLICATES')}
              className={`cursor-pointer p-2.5 sm:p-3.5 rounded-xl border transition-all ${
                duplicateCount > 0 
                  ? filterMode === 'DUPLICATES'
                    ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 shadow-sm'
                    : 'bg-amber-50/90 border-amber-300 hover:border-amber-400 shadow-2xs'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] sm:text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-600" />
                  Repetidos
                </span>
                {duplicateCount > 0 && (
                  <span className="animate-pulse flex h-2 w-2 rounded-full bg-amber-500" />
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg sm:text-2xl font-black ${duplicateCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  {duplicateCount}
                </span>
                {duplicateCount > 0 && (
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-200 text-amber-900">
                    Por Auditar
                  </span>
                )}
              </div>
              <div className={`text-[10px] sm:text-[11px] mt-0.5 font-bold ${duplicateCount > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                {duplicateCount > 0 ? '👉 Clic para filtrar' : 'Todo en orden'}
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs Bar & Layout Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                filterMode === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>Todos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs ${filterMode === 'ALL' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                {inventoryItems.length}
              </span>
            </button>

            <button
              onClick={() => setFilterMode('DUPLICATES')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                filterMode === 'DUPLICATES'
                  ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/50'
                  : duplicateCount > 0
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                    : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              <AlertTriangle size={13} className={filterMode === 'DUPLICATES' ? 'text-white' : 'text-amber-600'} />
              <span>Repetidos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-xs font-black ${
                filterMode === 'DUPLICATES' 
                  ? 'bg-amber-700 text-white' 
                  : duplicateCount > 0 
                    ? 'bg-amber-200 text-amber-900' 
                    : 'bg-slate-100 text-slate-500'
              }`}>
                {duplicateCount}
              </span>
            </button>
          </div>

          {/* Quick Collapse / Expand & View Mode Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(duplicateCount > 0 || collapsedItems.size > 0) && (
              <button
                type="button"
                onClick={toggleCollapseAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-white text-slate-700 hover:bg-slate-50 border-slate-200 cursor-pointer"
                title={allDuplicatesCollapsed || collapsedItems.size > 0 ? "Expandir todas las ubicaciones" : "Colapsar artículos con múltiples ubicaciones"}
              >
                {allDuplicatesCollapsed || collapsedItems.size > 0 ? (
                  <>
                    <ChevronsUpDown size={13} className="text-blue-600" />
                    <span>Expandir ({collapsedItems.size})</span>
                  </>
                ) : (
                  <>
                    <ChevronsDownUp size={13} className="text-amber-600" />
                    <span>Colapsar repetidos</span>
                  </>
                )}
              </button>
            )}

            {/* View Mode Toggle: Cards vs Table */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
              <button
                onClick={() => setViewLayout('cards')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${
                viewLayout === 'cards' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Vista de Tarjetas (Recomendado para celular)"
            >
              <LayoutGrid size={13} />
              <span>Tarjetas</span>
            </button>
            <button
              onClick={() => setViewLayout('table')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${
                viewLayout === 'table' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Vista de Tabla completa"
            >
              <TableIcon size={13} />
              <span>Tabla</span>
            </button>
          </div>
        </div>
      </div>

        {/* Informational Banner for Duplicate Auditing (Dismissible) */}
        {filterMode === 'DUPLICATES' && duplicateCount > 0 && !bannerDismissed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex items-start justify-between gap-2 text-amber-900 text-xs sm:text-sm">
            <div className="flex items-start gap-2 min-w-0">
              <ShieldAlert size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong>Auditoría ({duplicateCount}):</strong> Artículos registrados en 2 o más ubicaciones. Verifica en piso y usa el botón rojo <strong>"Quitar"</strong> para descartar la celda incorrecta.
              </div>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-amber-700 hover:text-amber-950 p-1 shrink-0"
              title="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {filterMode === 'DUPLICATES' && duplicateCount === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>¡Excelente! No hay códigos repetidos en múltiples ubicaciones.</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MOBILE CARDS VIEW (No horizontal scrolling! Perfect for phone screens)   */}
        {/* ========================================================================= */}
        {viewLayout === 'cards' ? (
          <div className="space-y-3">
            {sortedAndFilteredItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                {filterMode === 'DUPLICATES' 
                  ? 'No hay artículos duplicados en múltiples ubicaciones.' 
                  : 'No se encontraron artículos con el filtro actual.'}
              </div>
            ) : (
              sortedAndFilteredItems.map((item, idx) => {
                const isDuplicate = item.locations.length > 1;
                const itemKey = `${item.branchId}-${item.articleId}`;
                const isCollapsed = collapsedItems.has(itemKey);

                return (
                  <div 
                    key={`${item.branchId}-${item.articleId}-${idx}`}
                    className={`rounded-xl border bg-white shadow-xs p-3.5 space-y-2.5 transition-all ${
                      isDuplicate 
                        ? 'border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/15' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Article Code, Badges, Total Pieces & Collapse Toggle */}
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-slate-900 text-base sm:text-lg tracking-tight select-all">
                            {item.articleId}
                          </span>
                          {isDuplicate ? (
                            <button
                              type="button"
                              onClick={() => toggleItemCollapse(itemKey)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-95 cursor-pointer ${
                                isCollapsed 
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                              title={isCollapsed ? "Ver ubicaciones" : "Ocultar ubicaciones"}
                            >
                              <AlertTriangle size={11} className={isCollapsed ? "text-amber-100 shrink-0" : "text-amber-600 shrink-0"} />
                              <span>{item.locations.length} ubicaciones</span>
                              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check size={10} /> 1 ubicación
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                          <span>📍 {item.branchName}</span>
                        </div>
                      </div>

                      {/* Total Pieces Badge & Collapse Button */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-black text-xs sm:text-sm shadow-2xs ${
                          isDuplicate ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'
                        }`}>
                          {item.totalQuantity} {item.totalQuantity === 1 ? 'pza' : 'pzas'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleItemCollapse(itemKey)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                          title={isCollapsed ? "Expandir ubicaciones" : "Colapsar ubicaciones"}
                          aria-label={isCollapsed ? "Expandir ubicaciones" : "Colapsar ubicaciones"}
                        >
                          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Article Description */}
                    <div className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium leading-relaxed break-words">
                      {item.description}
                    </div>

                    {/* Collapsed Bar or Full Locations List */}
                    {isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleItemCollapse(itemKey)}
                        className="w-full text-left p-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 active:bg-amber-200/50 transition-all flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown size={15} className="text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-black text-amber-900 block truncate">
                              {item.locations.length} ubicaciones ocultas
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block truncate">
                              {item.locations.map(l => l.locationLabel).join(' • ')}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-1 rounded-md shadow-2xs">
                          Ver celdas ▾
                        </span>
                      </button>
                    ) : (
                      <div className="space-y-2 pt-0.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Ubicaciones Físicas ({item.locations.length})</span>
                          <div className="flex items-center gap-2">
                            {isDuplicate && (
                              <span className="text-amber-600 font-semibold normal-case text-[10px]">
                                ⚠️ Revisar cuál es la real
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleItemCollapse(itemKey)}
                              className="text-slate-500 hover:text-slate-800 text-[10px] font-bold flex items-center gap-0.5 normal-case cursor-pointer"
                            >
                              <ChevronUp size={12} />
                              <span>Ocultar</span>
                            </button>
                          </div>
                        </div>

                      {item.locations.map((loc, lIdx) => (
                        <div 
                          key={lIdx}
                          className={`p-2.5 rounded-lg border flex flex-col gap-2 ${
                            isDuplicate ? 'bg-white border-amber-200 shadow-2xs' : 'bg-blue-50/40 border-blue-100'
                          }`}
                        >
                          {/* Room name & Rack link */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <span>{loc.roomName}</span>
                                {loc.roomLevel > 0 && (
                                  <span className="bg-slate-200 text-slate-700 px-1 rounded text-[9px]">
                                    Nivel {loc.roomLevel}
                                  </span>
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  useStore.getState().setActiveLevel(loc.roomLevel);
                                  setActiveBranch(item.branchId);
                                  setActiveRoom(loc.roomId);
                                  setSelectedShapeId(loc.rackId);
                                  setActiveRack(loc.rackId);
                                  onNavigateToMap();
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 active:scale-95 transition-transform mt-0.5"
                                title="Ir a este Rack en el plano"
                              >
                                <MapIcon size={14} className="text-blue-500 shrink-0" />
                                <span className="underline decoration-blue-300 font-mono">{loc.locationLabel}</span>
                                <span className="text-[9px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded">
                                  Ver en plano
                                </span>
                              </button>
                            </div>

                            <div className="text-right font-mono text-xs sm:text-sm text-slate-700 font-bold">
                              Cant: <span className="font-black text-slate-900">{loc.quantity}</span>
                            </div>
                          </div>

                          {/* Stepper [-] [+] and Quitar button */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                              <button 
                                onClick={() => updateCellItemQuantity(loc.rackId, loc.cellRow, loc.cellCol, item.articleId, -1)}
                                className="w-8 h-8 flex items-center justify-center bg-white text-slate-700 active:bg-red-50 active:text-red-600 rounded-md shadow-2xs font-bold transition-colors"
                                title="Descontar 1 pieza"
                              >
                                <Minus size={15} />
                              </button>
                              <span className="w-8 text-center font-mono font-black text-xs text-slate-800">
                                {loc.quantity}
                              </span>
                              <button 
                                onClick={() => updateCellItemQuantity(loc.rackId, loc.cellRow, loc.cellCol, item.articleId, 1)}
                                className="w-8 h-8 flex items-center justify-center bg-white text-slate-700 active:bg-green-50 active:text-green-600 rounded-md shadow-2xs font-bold transition-colors"
                                title="Agregar 1 pieza"
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            <button 
                              onClick={() => handleRemoveLocation(item, loc)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 rounded-lg font-bold text-xs transition-colors shadow-2xs"
                              title="Quitar este artículo de esta celda"
                            >
                              <Trash2 size={13} className="text-red-500" />
                              <span>Quitar celda</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>
        ) : (
          /* ========================================================================= */
          /* DESKTOP TABLE VIEW                                                        */
          /* ========================================================================= */
          <div className="bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-800 text-white select-none">
                    {/* Branch */}
                    <th className="p-2.5 md:p-3.5 font-bold text-xs md:text-sm align-top hover:bg-slate-700 transition-colors text-left">
                      <div 
                        className="flex items-center gap-1 md:gap-2 cursor-pointer mb-1.5 select-none"
                        onClick={() => requestSort('branchName')}
                      >
                        <span>Sucursal</span>
                        <ArrowUpDown size={13} className={`${sortConfig?.key === 'branchName' ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                      <select 
                        className="w-full text-slate-800 text-xs font-normal p-1 rounded border border-slate-600 bg-slate-100 mt-1"
                        value={columnFilters['branchName'] || ''}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, branchName: e.target.value }))}
                      >
                        <option value="">(Todos)</option>
                        {uniqueBranches.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </th>

                    {/* Code */}
                    <th className="p-2.5 md:p-3.5 font-bold text-xs md:text-sm align-top hover:bg-slate-700 transition-colors text-left">
                      <div 
                        className="flex items-center gap-1 md:gap-2 cursor-pointer mb-1.5 select-none"
                        onClick={() => requestSort('articleId')}
                      >
                        <span>Código</span>
                        <ArrowUpDown size={13} className={`${sortConfig?.key === 'articleId' ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                      <select 
                        className="w-full text-slate-800 text-xs font-normal p-1 rounded border border-slate-600 bg-slate-100 mt-1"
                        value={columnFilters['articleId'] || ''}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, articleId: e.target.value }))}
                      >
                        <option value="">(Todos)</option>
                        {uniqueArticles.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </th>

                    {/* Description */}
                    <th className="p-2.5 md:p-3.5 font-bold text-xs md:text-sm align-top hover:bg-slate-700 transition-colors text-left">
                      <div 
                        className="flex items-center gap-1 md:gap-2 cursor-pointer mb-1.5 select-none"
                        onClick={() => requestSort('description')}
                      >
                        <span>Descripción</span>
                        <ArrowUpDown size={13} className={`${sortConfig?.key === 'description' ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                      <select 
                        className="w-full text-slate-800 text-xs font-normal p-1 rounded border border-slate-600 bg-slate-100 mt-1"
                        value={columnFilters['description'] || ''}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, description: e.target.value }))}
                      >
                        <option value="">(Todos)</option>
                        {uniqueDescriptions.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    </th>

                    {/* Locations Count */}
                    <th 
                      className="p-2.5 md:p-3.5 font-bold text-xs md:text-sm text-left align-top hover:bg-slate-700 transition-colors cursor-pointer select-none"
                      onClick={() => requestSort('locationsCount')}
                      title="Ordenar por cantidad de ubicaciones"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span>Ubicaciones Físicas</span>
                        <ArrowUpDown size={13} className={sortConfig?.key === 'locationsCount' ? 'text-blue-400' : 'text-slate-500'} />
                      </div>
                      <span className="text-[10px] text-slate-300 font-normal">
                        Rack, Fila y Columna
                      </span>
                    </th>

                    {/* Total Quantity */}
                    <th className="p-2.5 md:p-3.5 font-bold text-xs md:text-sm align-top hover:bg-slate-700 transition-colors text-center">
                      <div 
                        className="flex items-center gap-1 md:gap-2 cursor-pointer mb-1.5 select-none justify-center"
                        onClick={() => requestSort('totalQuantity')}
                      >
                        <span>Total Pzas</span>
                        <ArrowUpDown size={13} className={`${sortConfig?.key === 'totalQuantity' ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                        {filterMode === 'DUPLICATES' 
                          ? 'No hay artículos duplicados en múltiples ubicaciones.' 
                          : 'No se encontraron artículos asignados en las ubicaciones con el filtro actual.'}
                      </td>
                    </tr>
                  ) : (
                    sortedAndFilteredItems.map((item, idx) => {
                      const isDuplicate = item.locations.length > 1;
                      const itemKey = `${item.branchId}-${item.articleId}`;
                      const isCollapsed = collapsedItems.has(itemKey);

                      return (
                        <tr 
                          key={`${item.branchId}-${item.articleId}-${idx}`} 
                          className={`border-b transition-colors ${
                            isDuplicate 
                              ? 'bg-amber-50/40 border-amber-200 border-l-4 border-l-amber-500 hover:bg-amber-100/50' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {/* Branch */}
                          <td className="p-2.5 md:p-4 text-xs md:text-sm font-bold text-slate-700 align-top">
                            {item.branchName}
                          </td>

                          {/* Article Code & Duplicate Badge */}
                          <td className="p-2.5 md:p-4 text-xs md:text-sm align-top whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-slate-900 text-sm md:text-base">
                                  {item.articleId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleItemCollapse(itemKey)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
                                  title={isCollapsed ? "Expandir ubicaciones" : "Colapsar ubicaciones"}
                                >
                                  {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </button>
                              </div>
                              {isDuplicate ? (
                                <button
                                  type="button"
                                  onClick={() => toggleItemCollapse(itemKey)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                                    isCollapsed 
                                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                  }`}
                                  title={isCollapsed ? "Ver ubicaciones" : "Ocultar ubicaciones"}
                                >
                                  <AlertTriangle size={11} className={isCollapsed ? "text-amber-100" : "text-amber-600"} />
                                  <span>{item.locations.length} ubicaciones</span>
                                  {isCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check size={10} /> 1 ubicación
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Description */}
                          <td className="p-2.5 md:p-4 text-xs md:text-sm text-slate-600 align-top max-w-xs">
                            {item.description}
                          </td>

                          {/* Physical Locations List with Actions */}
                          <td className="p-2.5 md:p-4 align-top">
                            {isCollapsed ? (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 border border-dashed border-amber-300 gap-2">
                                <div className="flex items-center gap-2 min-w-0 text-xs">
                                  <ChevronDown size={14} className="text-amber-600 shrink-0" />
                                  <span className="font-bold text-amber-900 shrink-0">
                                    {item.locations.length} ubicaciones ocultas:
                                  </span>
                                  <span className="text-slate-600 font-mono text-[11px] truncate">
                                    {item.locations.map(l => l.locationLabel).join(' • ')}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleItemCollapse(itemKey)}
                                  className="shrink-0 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <span>Expandir</span>
                                  <ChevronDown size={13} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {item.locations.length > 1 && (
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => toggleItemCollapse(itemKey)}
                                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5 cursor-pointer"
                                      title="Colapsar las celdas de este artículo"
                                    >
                                      <ChevronUp size={12} />
                                      <span>Colapsar celdas</span>
                                    </button>
                                  </div>
                                )}
                                {item.locations.map((loc, lIdx) => (
                                  <div 
                                    key={lIdx} 
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg border gap-2 ${
                                      isDuplicate 
                                        ? 'bg-white border-amber-200 shadow-xs' 
                                        : 'bg-blue-50/50 border-blue-100'
                                    }`}
                                  >
                                    {/* Location details & Map navigation */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 mb-0.5">
                                        <span className="font-semibold text-slate-600">{loc.roomName}</span>
                                        {loc.roomLevel > 0 && (
                                          <span className="bg-slate-200 text-slate-700 px-1 rounded text-[9px]">
                                            Nivel {loc.roomLevel}
                                          </span>
                                        )}
                                      </div>
                                      <button 
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-bold whitespace-nowrap text-xs md:text-sm group"
                                        onClick={() => {
                                          useStore.getState().setActiveLevel(loc.roomLevel);
                                          setActiveBranch(item.branchId);
                                          setActiveRoom(loc.roomId);
                                          setSelectedShapeId(loc.rackId);
                                          setActiveRack(loc.rackId);
                                          onNavigateToMap();
                                        }}
                                        title="Ir a este Rack en el plano"
                                      >
                                        <MapIcon size={13} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                        <span>{loc.locationLabel}</span>
                                      </button>
                                    </div>

                                    {/* Controls: Quantity, Stepper, and Remove */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                      <span className="font-mono font-bold text-slate-700 text-xs md:text-sm">
                                        Cant: {loc.quantity}
                                      </span>

                                      {/* Stepper */}
                                      <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded border border-slate-200">
                                        <button 
                                          onClick={() => updateCellItemQuantity(loc.rackId, loc.cellRow, loc.cellCol, item.articleId, -1)}
                                          className="w-6 h-6 flex items-center justify-center bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                          title="Descontar 1 pieza"
                                        >
                                          <Minus size={13} />
                                        </button>
                                        <button 
                                          onClick={() => updateCellItemQuantity(loc.rackId, loc.cellRow, loc.cellCol, item.articleId, 1)}
                                          className="w-6 h-6 flex items-center justify-center bg-white text-slate-600 hover:bg-green-50 hover:text-green-600 rounded transition-colors"
                                          title="Agregar 1 pieza"
                                        >
                                          <Plus size={13} />
                                        </button>
                                      </div>

                                      {/* Quick Delete Location Button */}
                                      <button 
                                        onClick={() => handleRemoveLocation(item, loc)}
                                        className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-bold text-xs transition-colors shadow-2xs"
                                        title="Quitar este artículo de esta celda"
                                      >
                                        <Trash2 size={12} className="text-red-500" />
                                        <span>Quitar</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Total Quantity */}
                          <td className="p-2.5 md:p-4 text-center align-top">
                            <span className={`inline-block px-3 py-1.5 rounded-lg font-mono font-black text-sm shadow-xs ${
                              isDuplicate 
                                ? 'bg-amber-700 text-white' 
                              : 'bg-slate-800 text-white'
                          }`}>
                            {item.totalQuantity}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

      </div>

      {/* Camera Scanner Modal for Barcode Scanning */}
      {showScanner && (
        <CameraScanner
          title="Escanear Código para Buscar en Inventario"
          onScan={(code) => {
            setSearchFilter(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};


