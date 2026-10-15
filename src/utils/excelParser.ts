import * as XLSX from 'xlsx';
import type { Article, MaterialStatus } from '../types';

export const parseExcelData = async (file: File): Promise<Article[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        // 1. Read sheet names ONLY (super fast: 0.1s, avoids parsing sales sheets)
        const namesWb = XLSX.read(data, { type: 'array', bookSheets: true });
        const allSheetNames = namesWb.SheetNames || [];
        
        // Prefer 'Articulos' (only 2 columns, parses in ~1.5s!) or 'catalogo completo'
        let sheetName = allSheetNames[0] || 'Sheet1';
        const preferredSheets = ['Articulos', 'catalogo completo', 'catalogo', 'articulos', 'in'];
        for (const pref of preferredSheets) {
          const match = allSheetNames.find(s => s.trim().toLowerCase() === pref.toLowerCase());
          if (match) {
            sheetName = match;
            break;
          }
        }
        
        // 2. Parse ONLY the target sheet in dense mode (skips hundreds of thousands of sales rows)
        const workbook = XLSX.read(data, { type: 'array', sheets: [sheetName], dense: true });
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error('No se pudo encontrar una hoja válida en el archivo.');
        }

        // Use header: 1 to get an array of arrays
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const articles: Article[] = [];
        let isPipeSeparated = false;
        
        // Find header row to identify columns
        let headerRowIndex = -1;
        let headers: string[] = [];
        
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const firstCell = String(row[0] || '').trim();
          if (firstCell.includes('CLAVE|') && (firstCell.includes('DESCRIPCION') || firstCell.includes('DESCIPCION'))) {
            isPipeSeparated = true;
            headers = firstCell.split('|').map(h => h.trim().toUpperCase());
            headerRowIndex = i;
            break;
          } else {
            const rowUpper = row.map(h => String(h || '').trim().toUpperCase());
            const hasClave = rowUpper.some(h => h === 'CLAVE' || h === 'CODIGO' || h === 'ID');
            const hasDesc = rowUpper.some(h => h.includes('DESCIPCION') || h.includes('DESCRIPCION') || h === 'DESC');
            if (hasClave && (hasDesc || rowUpper.length >= 2)) {
              headers = rowUpper;
              headerRowIndex = i;
              break;
            }
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error('No se pudo encontrar el encabezado con CLAVE y DESCRIPCION en el archivo.');
        }
        
        const getIndex = (...possibleNames: string[]) => {
          for (const name of possibleNames) {
            const idx = headers.findIndex(h => h === name.toUpperCase() || h.includes(name.toUpperCase()));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const idxClave = getIndex('CLAVE', 'CODIGO', 'ID');
        const idxEstatus = getIndex('ESTATUS', 'STATUS');
        const idxDesc = getIndex('DESCIPCION', 'DESCRIPCION', 'DESC');
        const idxDescLarga = getIndex('DESCRIPCION LARGA');
        const idxClasif = getIndex('CLASIFICACION', 'CATEGORIA', 'LINEA');
        const idxProv = getIndex('PROVEEDOR');
        const idxCelaya = getIndex('CELAYA');
        const idxLeon = getIndex('LEON');
        const idxQro = getIndex('QRO', 'QUERETARO');
        const idxNovopark = getIndex('NOVOPARK');
        const idxBodegaLeon = getIndex('BODEGA LEON');
        const idxBodegaQro = getIndex('BODEGA QRO', 'BODEGA QUERETARO');
        const idxRevision = getIndex('ULTIMA REVISION', 'REVISION', 'FECHA');

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          let values: string[] = [];
          if (isPipeSeparated) {
            if (typeof row[0] !== 'string') continue;
            values = row[0].split('|');
          } else {
            values = row.map(v => (v !== null && v !== undefined ? String(v) : ''));
          }
          
          const clave = values[idxClave]?.trim();
          if (!clave || clave === '-') continue;
          
          let status: MaterialStatus = 'ACTIVE';
          const estatusVal = (idxEstatus !== -1 ? values[idxEstatus] : '')?.trim().toUpperCase();
          if (estatusVal === '*') status = 'OFFLINE';
          else if (estatusVal === 'D') status = 'DAMAGED';
          else if (['?', '¿', '{', '@', '#'].includes(estatusVal)) status = 'SLOW';
          
          let desc = (idxDesc !== -1 ? values[idxDesc] : '')?.trim() || '';
          if (desc === '-' || !desc) {
            const descLarga = (idxDescLarga !== -1 ? values[idxDescLarga] : '')?.trim() || '';
            const clasif = (idxClasif !== -1 ? values[idxClasif] : '')?.trim() || '';
            if (descLarga && descLarga !== '-') {
              desc = descLarga;
            } else if (clasif && clasif !== '-') {
              desc = clasif;
            } else {
              desc = clave;
            }
          }

          const category = (idxClasif !== -1 ? values[idxClasif] : '')?.trim();
          const provider = (idxProv !== -1 ? values[idxProv] : '')?.trim();

          const stockObj: Record<string, number> = {};
          if (idxCelaya !== -1) stockObj['CELAYA'] = Number(values[idxCelaya]) || 0;
          if (idxLeon !== -1) stockObj['LEON'] = Number(values[idxLeon]) || 0;
          if (idxQro !== -1) stockObj['QRO'] = Number(values[idxQro]) || 0;
          if (idxNovopark !== -1) stockObj['NOVOPARK'] = Number(values[idxNovopark]) || 0;
          if (idxBodegaLeon !== -1) stockObj['BODEGA LEON'] = Number(values[idxBodegaLeon]) || 0;
          if (idxBodegaQro !== -1) stockObj['BODEGA QRO'] = Number(values[idxBodegaQro]) || 0;
          
          articles.push({
            id: clave,
            status: status,
            description: desc,
            category: category && category !== '-' ? category : undefined,
            provider: provider && provider !== '-' ? provider : undefined,
            stock: stockObj,
            lastRevision: idxRevision !== -1 ? values[idxRevision]?.trim() : undefined,
          });
        }
        
        resolve(articles);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
