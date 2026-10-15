import React, { useState, useMemo } from 'react';
import { DataUploader } from './DataUploader';
import { AnalyzerTable } from './AnalyzerTable';
import { SuggestedOrdersPanel } from './SuggestedOrdersPanel';
import { 
  Activity, DollarSign, CloudUpload, CloudDownload, 
  ChevronUp, ChevronDown, Calendar 
} from 'lucide-react';
import { useAnalyzerStore } from '../store/useAnalyzerStore';

export const InventoryAnalyzer: React.FC = () => {
  const records = useAnalyzerStore(state => state.inventoryRecords);
  const saveAnalyzerToCloud = useAnalyzerStore(state => state.saveAnalyzerToCloud);
  const loadAnalyzerFromCloud = useAnalyzerStore(state => state.loadAnalyzerFromCloud);
  const syncStatus = useAnalyzerStore(state => state.syncStatus);
  const periodDays = useAnalyzerStore(state => state.periodDays);
  const setPeriodDays = useAnalyzerStore(state => state.setPeriodDays);

  const [showUploader, setShowUploader] = useState(records.length === 0);
  const [customPeriod, setCustomPeriod] = useState<string>(String(periodDays || 30));

  const totalOverstockValue = useMemo(() => {
    return records.reduce((sum, r) => {
      const overstockQty = Math.max(0, r.theoreticalStock - r.maxStock);
      return sum + (overstockQty * r.unitCost);
    }, 0);
  }, [records]);

  const handlePeriodChange = (days: number) => {
    setPeriodDays(days);
    setCustomPeriod(String(days));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 p-3 sm:p-4 md:p-6 overflow-y-auto pb-28">
      {/* Top Header */}
      <div className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600 shrink-0" size={26} />
            Analizador de Inventarios y Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Métricas de inventario, clasificación ABC, análisis de Kardex multianual y pedidos sugeridos.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Uploader Button */}
          {records.length > 0 && (
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="px-3 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {showUploader ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{showUploader ? 'Ocultar Carga de Datos' : 'Cargar más archivos / Kardex'}</span>
            </button>
          )}

          <button 
            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              syncStatus === 'saving' ? 'bg-slate-200 text-slate-500' : 
              syncStatus === 'saved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 
              'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs'
            }`}
            onClick={() => saveAnalyzerToCloud().then(() => {
               if (useAnalyzerStore.getState().syncStatus === 'saved') alert('Guardado en la nube exitoso');
            })}
          >
            <CloudUpload size={16} /> Guardar
          </button>
          <button 
            className="px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
            onClick={() => loadAnalyzerFromCloud().then(() => alert('Datos cargados de la nube'))}
          >
            <CloudDownload size={16} /> Cargar
          </button>
        </div>
      </div>

      {/* Overstock Banner */}
      {records.length > 0 && totalOverstockValue > 0 && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2.5 rounded-full shrink-0">
              <DollarSign className="text-amber-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-amber-900 font-bold">Valor Total de Sobre-inventario</p>
              <p className="text-xs text-amber-700">Capital retenido en mercancía que excede el stock máximo calculado para el ciclo.</p>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
            ${totalOverstockValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>
      )}

      {/* Analysis Period Bar (Crucial for Kardex and Annual analysis!) */}
      {records.length > 0 && (
        <div className="mb-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600 shrink-0" size={18} />
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-800">Período de Consumo para Análisis:</span>
              <p className="text-[11px] text-slate-500">
                Determina cómo se calcula la venta/consumo promedio diario a partir de las salidas del período.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
            <span className="text-xs font-semibold text-slate-500">Presets:</span>
            {[
              { label: '30 Días (1 Mes)', days: 30 },
              { label: '90 Días (3 Meses)', days: 90 },
              { label: '180 Días (Semestre)', days: 180 },
              { label: '365 Días (1 Año)', days: 365 },
              { label: '3 Años', days: 1095 },
            ].map(p => (
              <button
                key={p.days}
                onClick={() => handlePeriodChange(p.days)}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors cursor-pointer ${
                  periodDays === p.days 
                    ? 'bg-blue-600 text-white shadow-2xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs text-slate-500 font-semibold">Días:</span>
              <input
                type="number"
                min="1"
                className="w-20 px-2 py-1 text-xs font-mono font-bold text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50"
                value={customPeriod}
                onChange={(e) => setCustomPeriod(e.target.value)}
                onBlur={() => {
                  const val = parseInt(customPeriod);
                  if (!isNaN(val) && val > 0) {
                    setPeriodDays(val);
                  } else {
                    setCustomPeriod(String(periodDays));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(customPeriod);
                    if (!isNaN(val) && val > 0) setPeriodDays(val);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Data Uploader */}
      {showUploader && (
        <div className="flex-shrink-0 mb-4 transition-all">
          <DataUploader />
        </div>
      )}

      {/* Suggested Orders Panel */}
      <div className="flex-shrink-0 mb-4">
        <SuggestedOrdersPanel />
      </div>

      {/* Analyzer Table with internal & page scroll */}
      <div className="w-full">
        <AnalyzerTable />
      </div>
    </div>
  );
};
