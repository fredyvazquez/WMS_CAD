import React, { useMemo } from 'react';
import { DataUploader } from './DataUploader';
import { AnalyzerTable } from './AnalyzerTable';
import { SuggestedOrdersPanel } from './SuggestedOrdersPanel';
import { Activity, DollarSign, CloudUpload, CloudDownload } from 'lucide-react';
import { useAnalyzerStore } from '../store/useAnalyzerStore';

export const InventoryAnalyzer: React.FC = () => {
  const records = useAnalyzerStore(state => state.inventoryRecords);
  const saveAnalyzerToCloud = useAnalyzerStore(state => state.saveAnalyzerToCloud);
  const loadAnalyzerFromCloud = useAnalyzerStore(state => state.loadAnalyzerFromCloud);
  const syncStatus = useAnalyzerStore(state => state.syncStatus);

  const totalOverstockValue = useMemo(() => {
    return records.reduce((sum, r) => {
      const overstockQty = Math.max(0, r.theoreticalStock - r.maxStock);
      return sum + (overstockQty * r.unitCost);
    }, 0);
  }, [records]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 p-4 md:p-6 overflow-hidden">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600" size={28} />
            Analizador de Inventarios y Pedidos
          </h1>
          <p className="text-slate-600 mt-1">
            Calcula métricas de inventario, analiza categorías ABC y genera pedidos sugeridos al proveedor.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${syncStatus === 'saving' ? 'bg-slate-200 text-slate-500' : syncStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'}`}
            onClick={() => saveAnalyzerToCloud().then(() => {
               if (useAnalyzerStore.getState().syncStatus === 'saved') alert('Guardado en la nube exitoso');
            })}
          >
            <CloudUpload size={18} /> Guardar
          </button>
          <button 
            className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700"
            onClick={() => loadAnalyzerFromCloud().then(() => alert('Datos cargados de la nube'))}
          >
            <CloudDownload size={18} /> Cargar
          </button>
        </div>
      </div>

      {records.length > 0 && totalOverstockValue > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <DollarSign className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-amber-800 font-bold">Valor Total de Sobre-inventario</p>
              <p className="text-xs text-amber-700">Capital atrapado en mercancía que excede el stock máximo ideal.</p>
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            ${totalOverstockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>
      )}

      <div className="flex-shrink-0 mb-6">
        <DataUploader />
      </div>

      <div className="flex-shrink-0">
        <SuggestedOrdersPanel />
      </div>

      <div className="flex-1 min-h-0">
        <AnalyzerTable />
      </div>
    </div>
  );
};
