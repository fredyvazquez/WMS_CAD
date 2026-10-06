import React, { useState, useMemo } from 'react';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import { Search, AlertTriangle, ArrowDownUp, Info } from 'lucide-react';

type SortField = 'id' | 'provider' | 'theoreticalStock' | 'rotation' | 'physicalStock' | 'exits';
type SortOrder = 'asc' | 'desc';

export const AnalyzerTable: React.FC = () => {
  const records = useAnalyzerStore(state => state.inventoryRecords);
  const updatePhysicalStock = useAnalyzerStore(state => state.updatePhysicalStock);
  const updateLeadTime = useAnalyzerStore(state => state.updateLeadTime);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter(r => 
      r.id.toLowerCase().includes(search.toLowerCase()) || 
      r.description.toLowerCase().includes(search.toLowerCase())
    );

    if (providerFilter) {
      result = result.filter(r => r.provider.toLowerCase().includes(providerFilter.toLowerCase()));
    }

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      // Fallbacks for nulls
      if (valA === null) valA = -999999;
      if (valB === null) valB = -999999;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [records, search, providerFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const providers = useMemo(() => Array.from(new Set(records.map(r => r.provider))), [records]);

  if (records.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <Info className="text-blue-400 mx-auto mb-2" size={48} />
        <h3 className="text-lg font-bold text-slate-700">Sin Datos</h3>
        <p className="text-slate-500">Sube y procesa los archivos Excel para ver el análisis de inventario.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Clave o Descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-full md:w-64">
          <select 
            value={providerFilter} 
            onChange={(e) => setProviderFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Proveedores</option>
            {providers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-1">Clave <ArrowDownUp size={12} /></div>
              </th>
              <th className="px-2 py-3 text-center" title="Clasificación ABC">ABC</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('provider')}>
                <div className="flex items-center gap-1">Prov. <ArrowDownUp size={12} /></div>
              </th>
              <th className="px-4 py-3 text-center">Inicial</th>
              <th className="px-4 py-3 text-center text-emerald-600">Entradas</th>
              <th className="px-4 py-3 text-center text-rose-600 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('exits')}>
                <div className="flex items-center justify-center gap-1">Salidas <ArrowDownUp size={12} /></div>
              </th>
              <th className="px-4 py-3 text-center bg-blue-50 cursor-pointer hover:bg-blue-100" onClick={() => handleSort('theoreticalStock')}>
                <div className="flex items-center justify-center gap-1">Stock Teórico <ArrowDownUp size={12} /></div>
              </th>
              <th className="px-4 py-3 text-center bg-purple-50">Físico</th>
              <th className="px-4 py-3 text-center">Lead Time (Días)</th>
              <th className="px-4 py-3 text-center" title="Stock de Seguridad">S.S.</th>
              <th className="px-4 py-3 text-center" title="Punto de Reorden">P.R.</th>
              <th className="px-4 py-3 text-center">Min</th>
              <th className="px-4 py-3 text-center">Max</th>
              <th className="px-4 py-3 text-right" title="Valor $ del Excedente">Exc. $</th>
              <th className="px-4 py-3 text-center cursor-pointer hover:bg-slate-200" onClick={() => handleSort('rotation')}>
                <div className="flex items-center justify-center gap-1">Rotación <ArrowDownUp size={12} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAndSortedRecords.map(record => {
              // Visual indicators
              const isOverstock = record.theoreticalStock > record.maxStock && record.maxStock > 0;
              const isLowStock = record.theoreticalStock <= record.reorderPoint && record.reorderPoint > 0;
              
              const overstockQty = Math.max(0, record.theoreticalStock - record.maxStock);
              const overstockValue = overstockQty * record.unitCost;

              let rowClass = "hover:bg-slate-50 transition-colors ";
              if (isLowStock) rowClass += "bg-rose-50/50 ";
              else if (isOverstock) rowClass += "bg-amber-50/50 ";

              let abcColor = "bg-slate-100 text-slate-600";
              if (record.abcCategory === 'A') abcColor = "bg-emerald-100 text-emerald-700";
              else if (record.abcCategory === 'B') abcColor = "bg-blue-100 text-blue-700";
              else if (record.abcCategory === 'C') abcColor = "bg-amber-100 text-amber-700";

              return (
                <tr key={record.id} className={rowClass}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {isLowStock && <span title="A punto de agotarse"><AlertTriangle size={14} className="text-rose-500" /></span>}
                      {isOverstock && <span title="Sobre Inventario"><AlertTriangle size={14} className="text-amber-500" /></span>}
                      {record.id}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {record.abcCategory && <span className={`px-2 py-0.5 rounded text-xs font-bold ${abcColor}`}>{record.abcCategory}</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={record.description}>{record.description}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold">{record.provider}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{record.initialStock}</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-medium">+{record.entries}</td>
                  <td className="px-4 py-3 text-center text-rose-600 font-medium">-{record.exits}</td>
                  <td className="px-4 py-3 text-center font-bold bg-blue-50/30">{record.theoreticalStock}</td>
                  <td className="px-4 py-3 text-center bg-purple-50/30">
                    <input 
                      type="number" 
                      className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      value={record.physicalStock === null ? '' : record.physicalStock}
                      onChange={(e) => updatePhysicalStock(record.id, e.target.value ? Number(e.target.value) : 0)}
                      placeholder="-"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input 
                      type="number" 
                      className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={record.leadTimeDays}
                      onChange={(e) => updateLeadTime(record.id, Number(e.target.value))}
                      min="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{record.safetyStock}</td>
                  <td className="px-4 py-3 text-center text-slate-500 font-medium">{record.reorderPoint}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{record.minStock}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{record.maxStock}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {overstockValue > 0 ? `$${overstockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {record.rotation.toFixed(2)}x
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

