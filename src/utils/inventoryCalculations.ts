import type { InventoryRecord } from '../types';

export const extractProvider = (id: string): string => {
  if (!id) return 'UNKNOWN';
  return id.length >= 4 ? id.substring(0, 4) : id;
};

export const computeTheoreticalStock = (initial: number, entries: number, exits: number): number => {
  return initial + entries - exits;
};

export const calculateInventoryMetrics = (
  exits: number,
  leadTimeDays: number,
  periodDays: number = 30,
  orderCycleDays: number = 30
) => {
  const safePeriod = periodDays > 0 ? periodDays : 30;
  const avgDailySales = exits / safePeriod;
  const maxDailySales = avgDailySales * 1.5;
  const maxLeadTime = leadTimeDays * 1.2;

  let safetyStock = (maxDailySales * maxLeadTime) - (avgDailySales * leadTimeDays);
  if (safetyStock < 0) safetyStock = 0;
  
  const reorderPoint = (leadTimeDays * avgDailySales) + safetyStock;
  // El lote o cantidad de reposición cubre el ciclo de pedido (por defecto 30 días)
  const safeCycle = orderCycleDays > 0 ? orderCycleDays : 30;
  const orderQuantity = avgDailySales * safeCycle;
  const maxStock = safetyStock + orderQuantity;
  const minStock = safetyStock;

  return {
    safetyStock: Math.ceil(safetyStock),
    reorderPoint: Math.ceil(reorderPoint),
    maxStock: Math.ceil(maxStock),
    minStock: Math.ceil(minStock),
  };
};

export const performAbcAnalysis = (records: InventoryRecord[]): InventoryRecord[] => {
  // Sort by Exits Volume (Value = Exits * UnitCost)
  const evaluated = records.map(r => ({
    ...r,
    _abcValue: r.exits * (r.unitCost || 1) // Fallback to exits if cost is 0
  }));

  evaluated.sort((a, b) => b._abcValue - a._abcValue);

  let totalValue = 0;
  evaluated.forEach(r => { totalValue += r._abcValue; });

  let cumulativeValue = 0;
  const finalRecords = evaluated.map(r => {
    cumulativeValue += r._abcValue;
    const percentage = totalValue === 0 ? 0 : cumulativeValue / totalValue;

    let abc: 'A' | 'B' | 'C' = 'C';
    if (percentage <= 0.8) {
      abc = 'A';
    } else if (percentage <= 0.95) {
      abc = 'B';
    }

    const { _abcValue, ...rest } = r;
    return { ...rest, abcCategory: abc };
  });

  return finalRecords;
};
