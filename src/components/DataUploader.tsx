import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import type { RawDataRow } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export const DataUploader: React.FC = () => {
  const [initialData, setInitialData] = useState<RawDataRow[]>([]);
  const [entriesData, setEntriesData] = useState<RawDataRow[]>([]);
  const [exitsData, setExitsData] = useState<RawDataRow[]>([]);
  
  const processRawData = useAnalyzerStore(state => state.processRawData);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<RawDataRow[]>>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string' && !(bstr instanceof ArrayBuffer)) return;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const rawArrays = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const parsedData: any[] = [];
      
      if (rawArrays.length > 0) {
        let headers: string[] = [];
        let isPipe = false;
        
        // Find headers
        for (let i=0; i<Math.min(10, rawArrays.length); i++) {
          if (rawArrays[i] && typeof rawArrays[i][0] === 'string' && rawArrays[i][0].includes('|')) {
            isPipe = true;
            headers = rawArrays[i][0].split('|').map((h: string) => h.trim());
            break;
          } else if (rawArrays[i] && rawArrays[i].length > 1) {
            headers = rawArrays[i].map((h: any) => String(h).trim());
            break;
          }
        }
        
        if (headers.length > 0) {
          const startIndex = rawArrays.findIndex(row => 
            (isPipe && row[0] && typeof row[0] === 'string' && row[0].includes('|') && row[0].includes(headers[0])) ||
            (!isPipe && row.includes && row.includes(headers[0]))
          ) + 1;
          
          for (let i = startIndex; i < rawArrays.length; i++) {
            const row = rawArrays[i];
            if (!row || row.length === 0) continue;
            
            const obj: any = {};
            if (isPipe && typeof row[0] === 'string') {
              const parts = row[0].split('|');
              headers.forEach((h, idx) => {
                obj[h] = parts[idx] || '';
              });
            } else {
              headers.forEach((h, idx) => {
                obj[h] = row[idx] || '';
              });
            }
            parsedData.push(obj);
          }
        } else {
          // Fallback
          parsedData.push(...XLSX.utils.sheet_to_json<RawDataRow>(ws));
        }
      }
      
      setter(parsedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleProcess = () => {
    if (initialData.length === 0 && entriesData.length === 0 && exitsData.length === 0) {
      alert('Sube al menos un archivo para procesar.');
      return;
    }
    processRawData(initialData, entriesData, exitsData);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Upload className="text-blue-600" size={20} /> Carga de Datos
        </h2>
        <p className="text-sm text-slate-500">Sube tus archivos Excel. El sistema buscará columnas: Clave/Código, Descripción, Cantidad/Existencia y Costo/Precio.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <UploadCard title="Inventario Inicial" data={initialData} onChange={(e) => handleFileUpload(e, setInitialData)} id="file-initial" />
        <UploadCard title="Compras (Entradas)" data={entriesData} onChange={(e) => handleFileUpload(e, setEntriesData)} id="file-entries" />
        <UploadCard title="Ventas (Salidas)" data={exitsData} onChange={(e) => handleFileUpload(e, setExitsData)} id="file-exits" />
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleProcess}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Procesar Analizador
        </button>
      </div>
    </div>
  );
};

const UploadCard = ({ title, data, onChange, id }: { title: string, data: any[], onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, id: string }) => (
  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative">
    <input type="file" id={id} accept=".xlsx, .xls, .csv" onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
    {data.length > 0 ? (
      <>
        <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="text-xs text-slate-500">{data.length} registros listos</span>
      </>
    ) : (
      <>
        <FileSpreadsheet className="text-slate-400 mb-2" size={32} />
        <span className="font-semibold text-slate-600">{title}</span>
        <span className="text-xs text-slate-400 mt-1">Clic o arrastrar archivo</span>
      </>
    )}
  </div>
);

