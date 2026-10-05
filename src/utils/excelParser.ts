import * as XLSX from 'xlsx';
import type { Article, MaterialStatus } from '../types';

export const parseExcelData = async (file: File): Promise<Article[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header: 1 to get an array of arrays
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const articles: Article[] = [];
        let isPipeSeparated = false;
        
        // Find header row to identify columns
        let headerRowIndex = -1;
        let headers: string[] = [];
        
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          if (typeof row[0] === 'string' && row[0].includes('CLAVE|ESTATUS|DESCRIPCION')) {
            isPipeSeparated = true;
            headers = row[0].split('|');
            headerRowIndex = i;
            break;
          } else if (row.includes('CLAVE') && row.includes('DESCRIPCION')) {
            headers = row.map(h => String(h).trim());
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error('No se pudo encontrar el encabezado con CLAVE y DESCRIPCION en el archivo.');
        }
        
        const getIndex = (name: string) => headers.indexOf(name);
        const idxClave = getIndex('CLAVE');
        const idxEstatus = getIndex('ESTATUS');
        const idxDesc = getIndex('DESCRIPCION');
        const idxCelaya = getIndex('CELAYA');
        const idxLeon = getIndex('LEON');
        const idxQro = getIndex('QRO');
        const idxNovopark = getIndex('NOVOPARK');
        const idxBodegaLeon = getIndex('BODEGA LEON');
        const idxBodegaQro = getIndex('BODEGA QRO');
        const idxRevision = getIndex('ULTIMA REVISION');

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          let row = rawData[i];
          if (!row || row.length === 0) continue;
          
          let values: string[] = [];
          if (isPipeSeparated) {
            if (typeof row[0] !== 'string') continue;
            values = row[0].split('|');
          } else {
            values = row.map(String);
          }
          
          const clave = values[idxClave]?.trim();
          if (!clave) continue;
          
          let status: MaterialStatus = 'ACTIVE';
          const estatusVal = values[idxEstatus]?.trim();
          if (estatusVal === '*') status = 'OFFLINE';
          else if (estatusVal === 'D') status = 'DAMAGED'; // just in case
          
          articles.push({
            id: clave,
            status: status,
            description: values[idxDesc]?.trim() || '',
            stock: {
              'CELAYA': Number(values[idxCelaya]) || 0,
              'LEON': Number(values[idxLeon]) || 0,
              'QRO': Number(values[idxQro]) || 0,
              'NOVOPARK': Number(values[idxNovopark]) || 0,
              'BODEGA LEON': Number(values[idxBodegaLeon]) || 0,
              'BODEGA QRO': Number(values[idxBodegaQro]) || 0,
            },
            lastRevision: values[idxRevision]?.trim(),
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
