import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import type { RawDataRow } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Trash2, Calendar, FileText } from 'lucide-react';

export const DataUploader: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STANDARD' | 'KARDEX'>('STANDARD');
  
  // Standard upload state
  const [initialData, setInitialData] = useState<RawDataRow[]>([]);
  const [entriesData, setEntriesData] = useState<RawDataRow[]>([]);
  const [exitsData, setExitsData] = useState<RawDataRow[]>([]);

  // Kardex upload state
  const [kardexFilesCount, setKardexFilesCount] = useState(0);
  const [kardexDetectedYears, setKardexDetectedYears] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  
  const processRawData = useAnalyzerStore(state => state.processRawData);
  const setPeriodDays = useAnalyzerStore(state => state.setPeriodDays);

  const parseFileToRows = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          if (!bstr) return resolve([]);
          const wb = XLSX.read(bstr, { type: 'binary', dense: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          if (!ws) return resolve([]);

          const rawArrays = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          const parsedData: any[] = [];

          if (rawArrays.length > 0) {
            let headers: string[] = [];
            let isPipe = false;

            // Find headers
            for (let i = 0; i < Math.min(15, rawArrays.length); i++) {
              const row = rawArrays[i];
              if (!row || row.length === 0) continue;

              const firstCell = String(row[0] || '').trim();
              if (firstCell.includes('|') && (firstCell.toUpperCase().includes('CLAVE') || firstCell.toUpperCase().includes('CODIGO') || firstCell.toUpperCase().includes('SKU'))) {
                isPipe = true;
                headers = firstCell.split('|').map((h: string) => h.trim().toUpperCase());
                break;
              } else if (row.length > 1) {
                const uppers = row.map((h: any) => String(h || '').trim().toUpperCase());
                if (uppers.some(h => ['CLAVE', 'CODIGO', 'ID', 'SKU', 'ARTICULO'].includes(h))) {
                  headers = uppers;
                  break;
                }
              }
            }

            if (headers.length > 0) {
              const startIndex = rawArrays.findIndex(row => 
                (isPipe && row[0] && typeof row[0] === 'string' && row[0].includes('|') && row[0].toUpperCase().includes(headers[0])) ||
                (!isPipe && row.some && row.some((c: any) => String(c || '').trim().toUpperCase() === headers[0]))
              ) + 1;

              for (let i = startIndex; i < rawArrays.length; i++) {
                const row = rawArrays[i];
                if (!row || row.length === 0) continue;

                const obj: any = {};
                if (isPipe && typeof row[0] === 'string') {
                  const parts = row[0].split('|');
                  headers.forEach((h, idx) => {
                    obj[h] = parts[idx]?.trim() || '';
                  });
                } else {
                  headers.forEach((h, idx) => {
                    obj[h] = row[idx] !== undefined && row[idx] !== null ? row[idx] : '';
                  });
                }
                parsedData.push(obj);
              }
            } else {
              // Fallback standard json
              parsedData.push(...XLSX.utils.sheet_to_json<RawDataRow>(ws));
            }
          }
          resolve(parsedData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  };

  const handleMultipleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<RawDataRow[]>>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    
    setIsParsing(true);
    try {
      const allRows: RawDataRow[] = [];
      for (const file of files) {
        const rows = await parseFileToRows(file);
        allRows.push(...rows);
      }
      setter(prev => [...prev, ...allRows]);
    } catch (err: any) {
      alert('Error al leer archivos: ' + (err?.message || err));
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleKardexUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsParsing(true);
    try {
      const entriesRows: RawDataRow[] = [];
      const exitsRows: RawDataRow[] = [];
      const initialRows: RawDataRow[] = [];
      const yearsFound = new Set<number>();

      for (const file of files) {
        const rows = await parseFileToRows(file);
        
        for (const row of rows) {
          // Normalize keys
          const norm: any = {};
          for (const k in row) {
            norm[k.toUpperCase().trim()] = row[k];
          }

          const clave = norm.CLAVE || norm.CODIGO || norm.ID || norm.SKU || norm.ARTICULO || '';
          if (!clave) continue;

          const desc = norm.DESCRIPCIÓN || norm.DESCRIPCION || norm.DESC || norm.NOMBRE || '';
          const costo = Number(norm.COSTO) || Number(norm.PRECIO) || Number(norm.COSTO_UNITARIO) || 0;

          // Detect year if present
          if (norm.AÑO || norm.ANIO || norm.YEAR) {
            const yr = parseInt(norm.AÑO || norm.ANIO || norm.YEAR);
            if (!isNaN(yr) && yr > 1990 && yr < 2100) yearsFound.add(yr);
          } else if (norm.FECHA) {
            const dStr = String(norm.FECHA);
            const match = dStr.match(/(20\d{2}|19\d{2})/);
            if (match) yearsFound.add(parseInt(match[1]));
          }

          // Check if explicit Entradas / Salidas columns exist
          const hasEntradaCol = norm.ENTRADA !== undefined || norm.ENTRADAS !== undefined || norm.CANT_ENT !== undefined || norm.CANTIDAD_ENTRADA !== undefined;
          const hasSalidaCol = norm.SALIDA !== undefined || norm.SALIDAS !== undefined || norm.CANT_SAL !== undefined || norm.CANTIDAD_SALIDA !== undefined;

          if (hasEntradaCol || hasSalidaCol) {
            const entVal = Number(norm.ENTRADA || norm.ENTRADAS || norm.CANT_ENT || norm.CANTIDAD_ENTRADA || 0);
            const salVal = Number(norm.SALIDA || norm.SALIDAS || norm.CANT_SAL || norm.CANTIDAD_SALIDA || 0);

            if (entVal > 0) {
              entriesRows.push({ Clave: clave, Descripción: desc, Cantidad: entVal, Costo: costo });
            }
            if (salVal > 0) {
              exitsRows.push({ Clave: clave, Descripción: desc, Cantidad: salVal, Costo: costo });
            }
          } else {
            // Check Tipo Movimiento column
            const tipo = String(norm.TIPO || norm.TIPO_MOV || norm.CONCEPTO || norm.MOVIMIENTO || '').toUpperCase().trim();
            const cantidad = Number(norm.CANTIDAD || norm.EXISTENCIA || norm.QTY || 0);

            if (tipo.startsWith('E') || tipo.includes('COMPRA') || tipo.includes('ENTRADA') || tipo.includes('RECEPCION')) {
              entriesRows.push({ Clave: clave, Descripción: desc, Cantidad: cantidad, Costo: costo });
            } else if (tipo.startsWith('S') || tipo.includes('VENTA') || tipo.includes('SALIDA') || tipo.includes('DESPACHO')) {
              exitsRows.push({ Clave: clave, Descripción: desc, Cantidad: cantidad, Costo: costo });
            } else if (tipo.includes('INICIAL') || tipo.includes('SALDO')) {
              initialRows.push({ Clave: clave, Descripción: desc, Cantidad: cantidad, Costo: costo });
            } else {
              // Default to entries if positive
              if (cantidad > 0) {
                entriesRows.push({ Clave: clave, Descripción: desc, Cantidad: cantidad, Costo: costo });
              }
            }
          }
        }
      }

      setEntriesData(entriesRows);
      setExitsData(exitsRows);
      if (initialRows.length > 0) setInitialData(initialRows);

      setKardexFilesCount(files.length);
      if (yearsFound.size > 0) {
        const sortedY = Array.from(yearsFound).sort();
        const minYear = sortedY[0];
        const maxYear = sortedY[sortedY.length - 1];
        const span = maxYear - minYear + 1;
        setKardexDetectedYears(`${minYear} - ${maxYear} (${span} año${span > 1 ? 's' : ''})`);
        // If multiple years, suggest annual period
        if (span > 1) {
          setPeriodDays(span * 365);
        } else {
          setPeriodDays(365);
        }
      }
    } catch (err: any) {
      alert('Error al procesar archivos de Kardex: ' + (err?.message || err));
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleProcess = () => {
    if (initialData.length === 0 && entriesData.length === 0 && exitsData.length === 0) {
      alert('Sube al menos un archivo o Kardex para procesar.');
      return;
    }
    processRawData(initialData, entriesData, exitsData);
  };

  const handleClear = () => {
    if (confirm('¿Deseas limpiar los archivos cargados?')) {
      setInitialData([]);
      setEntriesData([]);
      setExitsData([]);
      setKardexFilesCount(0);
      setKardexDetectedYears('');
    }
  };

  const totalLoadedRows = initialData.length + entriesData.length + exitsData.length;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Upload className="text-blue-600" size={20} /> Carga de Datos y Kardex
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Sube tus archivos Excel individuales o el historial anual de Kardex (2004 a la fecha). Puedes seleccionar múltiples archivos simultáneamente.
          </p>
        </div>

        {/* Tab selection */}
        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('STANDARD')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              activeTab === 'STANDARD' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3 Archivos Tradicionales
          </button>
          <button
            onClick={() => setActiveTab('KARDEX')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'KARDEX' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={13} /> Kardex Anual (2004-2026)
          </button>
        </div>
      </div>
      
      {isParsing && (
        <div className="p-6 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-center flex flex-col items-center justify-center gap-2 animate-pulse">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="font-semibold text-blue-800 text-sm">Leyendo y procesando archivos Excel...</span>
          <span className="text-xs text-blue-600">Esto puede tomar unos segundos para archivos grandes de varios años.</span>
        </div>
      )}

      {activeTab === 'STANDARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <UploadCard 
            title="Inventario Inicial" 
            subtitle="Existencia base (opcional)"
            data={initialData} 
            onChange={(e) => handleMultipleFileUpload(e, setInitialData)} 
            id="file-initial" 
          />
          <UploadCard 
            title="Compras (Entradas)" 
            subtitle="Soporta múltiples archivos de compras"
            data={entriesData} 
            onChange={(e) => handleMultipleFileUpload(e, setEntriesData)} 
            id="file-entries" 
          />
          <UploadCard 
            title="Ventas (Salidas)" 
            subtitle="Soporta múltiples archivos de ventas"
            data={exitsData} 
            onChange={(e) => handleMultipleFileUpload(e, setExitsData)} 
            id="file-exits" 
          />
        </div>
      ) : (
        <div className="mb-4">
          <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 rounded-xl p-6 flex flex-col items-center justify-center text-center relative transition-colors cursor-pointer">
            <input 
              type="file" 
              multiple 
              accept=".xlsx, .xls, .csv" 
              onChange={handleKardexUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
            <FileText className="text-blue-500 mb-2" size={36} />
            <h3 className="font-bold text-slate-800 text-sm md:text-base">
              Arrastra o selecciona tus archivos de Kardex Anual (2004 a la fecha)
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-lg">
              Puedes seleccionar todos los archivos Excel juntos (Ctrl + Clic o seleccionar carpeta). El sistema detecta automáticamente columnas de Fecha, Clave, Entradas, Salidas y Costos.
            </p>
            {kardexFilesCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>{kardexFilesCount} archivo(s) procesados: {entriesData.length} entradas y {exitsData.length} salidas detectadas</span>
              </div>
            )}
            {kardexDetectedYears && (
              <p className="text-xs font-semibold text-blue-700 mt-1.5">
                📅 Rango de años detectado: {kardexDetectedYears}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {totalLoadedRows > 0 ? (
            <span className="font-semibold text-slate-700">
              Total cargado: {totalLoadedRows.toLocaleString()} registros en cola ({initialData.length} inicial, {entriesData.length} entradas, {exitsData.length} salidas).
            </span>
          ) : (
            <span>Ningún archivo cargado todavía.</span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {totalLoadedRows > 0 && (
            <button 
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={14} /> Limpiar
            </button>
          )}
          <button 
            type="button"
            onClick={handleProcess}
            disabled={totalLoadedRows === 0 || isParsing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold text-xs md:text-sm transition-colors cursor-pointer shadow-sm flex items-center gap-2"
          >
            {isParsing ? <Loader2 size={16} className="animate-spin" /> : null}
            Procesar Analizador
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadCard = ({ 
  title, 
  subtitle,
  data, 
  onChange, 
  id 
}: { 
  title: string; 
  subtitle: string;
  data: any[]; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  id: string;
}) => (
  <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 hover:border-slate-400 transition-colors relative min-h-[140px]">
    <input 
      type="file" 
      id={id} 
      multiple 
      accept=".xlsx, .xls, .csv" 
      onChange={onChange} 
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
    />
    {data.length > 0 ? (
      <>
        <CheckCircle2 className="text-emerald-500 mb-1.5" size={28} />
        <span className="font-bold text-slate-800 text-sm">{title}</span>
        <span className="text-xs font-semibold text-emerald-700 mt-0.5">{data.length.toLocaleString()} registros</span>
        <span className="text-[11px] text-slate-400 mt-1">Clic para agregar más archivos</span>
      </>
    ) : (
      <>
        <FileSpreadsheet className="text-slate-400 mb-1.5" size={28} />
        <span className="font-semibold text-slate-700 text-sm">{title}</span>
        <span className="text-xs text-slate-400 mt-0.5">{subtitle}</span>
        <span className="text-[11px] text-blue-600 font-medium mt-1">Seleccionar o arrastrar</span>
      </>
    )}
  </div>
);

