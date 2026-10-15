import React, { useState, useMemo, useEffect } from 'react';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import { 
  Search, AlertTriangle, ArrowDownUp, Info, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Layers
} from 'lucide-react';

type SortField = 
  | 'id' 
  | 'description' 
  | 'provider' 
  | 'initialStock' 
  | 'entries' 
  | 'exits' 
  | 'theoreticalStock' 
  | 'physicalStock' 
  | 'leadTimeDays' 
  | 'safetyStock' 
  | 'reorderPoint' 
  | 'minStock' 
  | 'maxStock' 
  | 'overstockValue' 
  | 'rotation';

type SortOrder = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'LOW_STOCK' | 'OVERSTOCK' | 'NORMAL';
type AbcFilter = 'ALL' | 'A' | 'B' | 'C';

export const AnalyzerTable: React.FC = () => {
  const records = useAnalyzerStore(state => state.inventoryRecords);
  const updatePhysicalStock = useAnalyzerStore(state => state.updatePhysicalStock);
  const updateLeadTime = useAnalyzerStore(state => state.updateLeadTime);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [abcFilter, setAbcFilter] = useState<AbcFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Reset to first page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, providerFilter, abcFilter, statusFilter, pageSize]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter(r => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || (
        r.id.toLowerCase().includes(q) || 
        r.description.toLowerCase().includes(q)
      );
      if (!matchSearch) return false;

      if (providerFilter && !r.provider.toLowerCase().includes(providerFilter.toLowerCase())) {
        return false;
      }

      if (abcFilter !== 'ALL' && r.abcCategory !== abcFilter) {
        return false;
      }

      if (statusFilter === 'LOW_STOCK') {
        const isLowStock = r.theoreticalStock <= r.reorderPoint && r.reorderPoint > 0;
        if (!isLowStock) return false;
      } else if (statusFilter === 'OVERSTOCK') {
        const isOverstock = r.theoreticalStock > r.maxStock && r.maxStock > 0;
        if (!isOverstock) return false;
      } else if (statusFilter === 'NORMAL') {
        const isLowStock = r.theoreticalStock <= r.reorderPoint && r.reorderPoint > 0;
        const isOverstock = r.theoreticalStock > r.maxStock && r.maxStock > 0;
        if (isLowStock || isOverstock) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'overstockValue') {
        const overQtyA = Math.max(0, a.theoreticalStock - a.maxStock);
        valA = overQtyA * a.unitCost;
        const overQtyB = Math.max(0, b.theoreticalStock - b.maxStock);
        valB = overQtyB * b.unitCost;
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      // Fallbacks for nulls
      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, search, providerFilter, abcFilter, statusFilter, sortField, sortOrder]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredAndSortedRecords.length / pageSize));

  const paginatedRecords = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedRecords;
    const start = (page - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, page, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const providers = useMemo(() => Array.from(new Set(records.map(r => r.provider))).filter(Boolean).sort(), [records]);

  // Counts for quick filter badges
  const lowStockCount = useMemo(() => records.filter(r => r.theoreticalStock <= r.reorderPoint && r.reorderPoint > 0).length, [records]);
  const overstockCount = useMemo(() => records.filter(r => r.theoreticalStock > r.maxStock && r.maxStock > 0).length, [records]);

  if (records.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <Info className="text-blue-400 mx-auto mb-2" size={48} />
        <h3 className="text-lg font-bold text-slate-700">Sin Datos para Analizar</h3>
        <p className="text-slate-500 text-sm mt-1">
          Sube tus archivos de Inventario, Entradas/Salidas o Kardex anual en la sección superior para procesar las métricas.
        </p>
      </div>
    );
  }

  const startRecord = filteredAndSortedRecords.length === 0 ? 0 : (page - 1) * (pageSize === -1 ? filteredAndSortedRecords.length : pageSize) + 1;
  const endRecord = pageSize === -1 ? filteredAndSortedRecords.length : Math.min(filteredAndSortedRecords.length, page * pageSize);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[500px]">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col gap-3 bg-slate-50/80">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input 
              type="text" 
              placeholder="Buscar por Clave o Descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Provider Filter */}
            <div className="w-full sm:w-auto">
              <select 
                value={providerFilter} 
                onChange={(e) => setProviderFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                <option value="">Todos los Proveedores ({providers.length})</option>
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* ABC Filter */}
            <div className="w-full sm:w-auto flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 text-xs">
              <span className="text-slate-400 px-1 font-semibold flex items-center gap-1">
                <Layers size={13} /> ABC:
              </span>
              {(['ALL', 'A', 'B', 'C'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setAbcFilter(cat)}
                  className={`px-2 py-1 rounded font-bold transition-colors cursor-pointer ${
                    abcFilter === cat 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'ALL' ? 'Todos' : cat}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-auto">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full sm:w-auto px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                <option value="ALL">Todos los Estados ({records.length})</option>
                <option value="LOW_STOCK">⚠️ Stock Bajo / Reorden ({lowStockCount})</option>
                <option value="OVERSTOCK">📦 Sobre-inventario ({overstockCount})</option>
                <option value="NORMAL">✓ Balanceado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter & Active filters label */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 pt-1">
          <span>
            Mostrando <strong className="text-slate-700">{startRecord}-{endRecord}</strong> de <strong className="text-slate-700">{filteredAndSortedRecords.length.toLocaleString()}</strong> artículos
            {filteredAndSortedRecords.length !== records.length && ` (filtrados de ${records.length.toLocaleString()} totales)`}
          </span>
          <div className="flex items-center gap-3 mt-1 sm:mt-0">
            <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              Stock Bajo: {lowStockCount}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Sobre-inventario: {overstockCount}
            </span>
          </div>
        </div>
      </div>

      {/* Table Container with Horizontal & Vertical Scroll */}
      <div className="overflow-x-auto w-full max-h-[65vh]">
        <table className="w-full text-xs md:text-sm text-left border-collapse min-w-[1100px]">
          <thead className="text-[11px] uppercase tracking-wider text-slate-700 bg-slate-100 sticky top-0 z-10 shadow-xs border-b border-slate-200">
            <tr>
              <th className="px-3.5 py-3 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-1 font-bold">Clave <ArrowDownUp size={12} className={sortField === 'id' ? 'text-blue-600' : 'text-slate-400'} /></div>
              </th>
              <th className="px-2 py-3 text-center" title="Clasificación ABC por valor de consumo">ABC</th>
              <th className="px-3.5 py-3 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('description')}>
                <div className="flex items-center gap-1 font-bold">Descripción <ArrowDownUp size={12} className={sortField === 'description' ? 'text-blue-600' : 'text-slate-400'} /></div>
              </th>
              <th className="px-3 py-3 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('provider')}>
                <div className="flex items-center gap-1 font-bold">Prov. <ArrowDownUp size={12} className={sortField === 'provider' ? 'text-blue-600' : 'text-slate-400'} /></div>
              </th>
              <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-200" onClick={() => handleSort('initialStock')}>
                <div className="flex items-center justify-center gap-1">Inicial <ArrowDownUp size={11} className="text-slate-400" /></div>
              </th>
              <th className="px-3 py-3 text-center text-emerald-700 font-bold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('entries')}>
                <div className="flex items-center justify-center gap-1">Entradas <ArrowDownUp size={11} className="text-slate-400" /></div>
              </th>
              <th className="px-3 py-3 text-center text-rose-700 font-bold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('exits')}>
                <div className="flex items-center justify-center gap-1">Salidas <ArrowDownUp size={11} className="text-slate-400" /></div>
              </th>
              <th className="px-3.5 py-3 text-center bg-blue-100/60 font-black text-blue-900 cursor-pointer hover:bg-blue-100" onClick={() => handleSort('theoreticalStock')}>
                <div className="flex items-center justify-center gap-1">Stock Teórico <ArrowDownUp size={12} className={sortField === 'theoreticalStock' ? 'text-blue-700' : 'text-slate-400'} /></div>
              </th>
              <th className="px-3 py-3 text-center bg-purple-50 font-bold text-purple-900">Físico</th>
              <th className="px-3 py-3 text-center" title="Tiempo de entrega en días">Lead Time</th>
              <th className="px-3 py-3 text-center font-semibold text-slate-600" title="Stock de Seguridad">S.S.</th>
              <th className="px-3 py-3 text-center font-bold text-slate-800" title="Punto de Reorden">P.R.</th>
              <th className="px-3 py-3 text-center text-slate-600">Min</th>
              <th className="px-3 py-3 text-center text-slate-600">Max</th>
              <th className="px-3.5 py-3 text-right font-bold text-amber-700 cursor-pointer hover:bg-slate-200" title="Valor monetario de la mercancía que excede el Máximo" onClick={() => handleSort('overstockValue')}>
                <div className="flex items-center justify-end gap-1">Exc. $ <ArrowDownUp size={11} className="text-slate-400" /></div>
              </th>
              <th className="px-3 py-3 text-center cursor-pointer hover:bg-slate-200" onClick={() => handleSort('rotation')}>
                <div className="flex items-center justify-center gap-1">Rotación <ArrowDownUp size={12} className={sortField === 'rotation' ? 'text-blue-600' : 'text-slate-400'} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={16} className="p-8 text-center text-slate-500">
                  No se encontraron artículos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedRecords.map(record => {
                // Visual indicators
                const isOverstock = record.theoreticalStock > record.maxStock && record.maxStock > 0;
                const isLowStock = record.theoreticalStock <= record.reorderPoint && record.reorderPoint > 0;
                
                const overstockQty = Math.max(0, record.theoreticalStock - record.maxStock);
                const overstockValue = overstockQty * record.unitCost;

                let rowClass = "hover:bg-slate-50 transition-colors ";
                if (isLowStock) rowClass += "bg-rose-50/50 ";
                else if (isOverstock) rowClass += "bg-amber-50/50 ";

                let abcColor = "bg-slate-100 text-slate-600";
                if (record.abcCategory === 'A') abcColor = "bg-emerald-100 text-emerald-800 font-black";
                else if (record.abcCategory === 'B') abcColor = "bg-blue-100 text-blue-800 font-bold";
                else if (record.abcCategory === 'C') abcColor = "bg-amber-100 text-amber-800";

                return (
                  <tr key={record.id} className={rowClass}>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isLowStock && <span title="Stock Bajo: requiere reorden urgente"><AlertTriangle size={14} className="text-rose-500 shrink-0" /></span>}
                        {isOverstock && <span title="Sobre-inventario: excede el Stock Máximo"><AlertTriangle size={14} className="text-amber-500 shrink-0" /></span>}
                        <span>{record.id}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {record.abcCategory ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${abcColor}`}>
                          {record.abcCategory}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 max-w-xs truncate text-slate-800" title={record.description}>
                      {record.description}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-700">
                        {record.provider || 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 font-mono">{record.initialStock.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-emerald-700 font-medium font-mono">+{record.entries.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-rose-700 font-medium font-mono">-{record.exits.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-center font-black font-mono bg-blue-50/50 text-blue-900">
                      {record.theoreticalStock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-center bg-purple-50/30">
                      <input 
                        type="number" 
                        className="w-16 px-1.5 py-0.5 text-center border border-slate-300 rounded text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                        value={record.physicalStock === null ? '' : record.physicalStock}
                        onChange={(e) => updatePhysicalStock(record.id, e.target.value ? Number(e.target.value) : 0)}
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input 
                        type="number" 
                        className="w-14 px-1.5 py-0.5 text-center border border-slate-300 rounded text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        value={record.leadTimeDays}
                        onChange={(e) => updateLeadTime(record.id, Number(e.target.value))}
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 font-mono">{record.safetyStock.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-slate-800 font-bold font-mono">{record.reorderPoint.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500 font-mono">{record.minStock.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500 font-mono">{record.maxStock.toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-amber-700 font-mono">
                      {overstockValue > 0 ? `$${overstockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-700">
                      {record.rotation.toFixed(2)}x
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Footer */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span>Filas por página:</span>
          <select 
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={-1}>Ver Todos</option>
          </select>
        </div>

        {pageSize !== -1 && (
          <div className="flex items-center gap-2">
            <span className="text-slate-600">
              Página <strong className="text-slate-800">{page}</strong> de <strong className="text-slate-800">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer shadow-2xs"
                title="Primera página"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer shadow-2xs"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer shadow-2xs"
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer shadow-2xs"
                title="Última página"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

