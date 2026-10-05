import * as XLSX from 'xlsx';
import type { Article, MaterialStatus } from '../types';

export const parseExcelData = async (file: File): Promise<Article[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assuming the first sheet is the one we need
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        // We use header: 1 to get an array of arrays to handle custom formatting
        // But since the markdown had a nice table, let's assume it has headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const articles: Article[] = [];
        
        // This is a basic mapping based on the provided columns:
        // CLAVE, ESTATUS, DESCRIPCION, CELAYA, LEON, QRO, NOVOPARK, BODEGA LEON, BODEGA QRO, EXISTENCIA, ULTIMA REVISION
        for (const row of jsonData) {
          if (!row['CLAVE']) continue; // Skip empty rows
          
          // Dummy logic to determine status
          let status: MaterialStatus = 'ACTIVE';
          if (row['ESTATUS'] === '*') status = 'OFFLINE';
          // More logic needed based on user requirements
          
          articles.push({
            id: String(row['CLAVE']),
            status: status,
            description: String(row['DESCRIPCION'] || ''),
            stock: {
              'CELAYA': Number(row['CELAYA']) || 0,
              'LEON': Number(row['LEON']) || 0,
              'QRO': Number(row['QRO']) || 0,
              'NOVOPARK': Number(row['NOVOPARK']) || 0,
              'BODEGA LEON': Number(row['BODEGA LEON']) || 0,
              'BODEGA QRO': Number(row['BODEGA QRO']) || 0,
            },
            lastRevision: row['ULTIMA REVISION'],
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
