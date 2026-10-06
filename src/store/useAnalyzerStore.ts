import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { InventoryRecord, RawDataRow, CartItem, ProviderConstraint } from '../types';
import { extractProvider, computeTheoreticalStock, calculateInventoryMetrics, performAbcAnalysis } from '../utils/inventoryCalculations';

interface AnalyzerState {
  inventoryRecords: InventoryRecord[];
  cartItems: CartItem[];
  providerConstraints: Record<string, ProviderConstraint>;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  setInventoryRecords: (records: InventoryRecord[]) => void;
  updatePhysicalStock: (id: string, stock: number) => void;
  updateLeadTime: (id: string, leadTimeDays: number) => void;
  processRawData: (initial: RawDataRow[], entries: RawDataRow[], exits: RawDataRow[]) => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateProviderConstraint: (provider: string, constraint: Partial<ProviderConstraint>) => void;
  clearCartProvider: (provider: string) => void;
  saveAnalyzerToCloud: () => Promise<void>;
  loadAnalyzerFromCloud: () => Promise<void>;
}

export const useAnalyzerStore = create<AnalyzerState>()(
  persist(
    (set, get) => ({
      inventoryRecords: [],
      cartItems: [],
      providerConstraints: {},
      syncStatus: 'idle',
      
      setInventoryRecords: (records) => set({ inventoryRecords: records }),
      
      updatePhysicalStock: (id, stock) => {
        set((state) => ({
          inventoryRecords: state.inventoryRecords.map((r) =>
            r.id === id ? { ...r, physicalStock: stock } : r
          ),
        }));
      },
      
      updateLeadTime: (id, leadTimeDays) => {
        set((state) => ({
          inventoryRecords: state.inventoryRecords.map((r) => {
            if (r.id === id) {
              const metrics = calculateInventoryMetrics(r.exits, leadTimeDays);
              return { ...r, leadTimeDays, ...metrics };
            }
            return r;
          }),
        }));
      },
      
      processRawData: (initial, entries, exits) => {
        const recordsMap = new Map<string, InventoryRecord>();

        const getRecord = (row: RawDataRow): InventoryRecord => {
          const id = row.Clave || row.Codigo || row.ID || 'DESCONOCIDO';
          const desc = row.Descripción || row.Descripcion || 'Sin Descripción';
          if (!recordsMap.has(id)) {
            recordsMap.set(id, {
              id,
              description: desc,
              provider: extractProvider(id),
              initialStock: 0,
              entries: 0,
              exits: 0,
              theoreticalStock: 0,
              physicalStock: null,
              leadTimeDays: 7, // Default 7 days
              maxStock: 0,
              minStock: 0,
              reorderPoint: 0,
              safetyStock: 0,
              rotation: 0,
              unitCost: row.Costo || row.Precio || 0,
              abcCategory: null
            });
          } else {
            // Update cost if found later
            const rec = recordsMap.get(id)!;
            if ((row.Costo || row.Precio) && rec.unitCost === 0) {
              rec.unitCost = row.Costo || row.Precio || 0;
            }
          }
          return recordsMap.get(id)!;
        };

        initial.forEach(row => {
          if (!row.Clave && !row.Codigo && !row.ID) return;
          const rec = getRecord(row);
          rec.initialStock += (row.Cantidad || row.Existencia || 0);
        });

        entries.forEach(row => {
          if (!row.Clave && !row.Codigo && !row.ID) return;
          const rec = getRecord(row);
          rec.entries += (row.Cantidad || 0);
        });

        exits.forEach(row => {
          if (!row.Clave && !row.Codigo && !row.ID) return;
          const rec = getRecord(row);
          rec.exits += (row.Cantidad || 0);
        });

        // Compute metrics and ABC
        let finalRecords = Array.from(recordsMap.values()).map(rec => {
          rec.theoreticalStock = computeTheoreticalStock(rec.initialStock, rec.entries, rec.exits);
          rec.rotation = rec.theoreticalStock > 0 ? rec.exits / rec.theoreticalStock : rec.exits;
          const metrics = calculateInventoryMetrics(rec.exits, rec.leadTimeDays);
          return { ...rec, ...metrics };
        });
        
        finalRecords = performAbcAnalysis(finalRecords);

        set({ inventoryRecords: finalRecords });
      },

      addToCart: (item) => set(state => {
        const existingIndex = state.cartItems.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
          const newCart = [...state.cartItems];
          newCart[existingIndex] = item;
          return { cartItems: newCart };
        }
        return { cartItems: [...state.cartItems, item] };
      }),

      removeFromCart: (id) => set(state => ({
        cartItems: state.cartItems.filter(i => i.id !== id)
      })),

      updateProviderConstraint: (provider, constraint) => set(state => {
        const current = state.providerConstraints[provider] || { minVolume: 0, minCost: 0 };
        return {
          providerConstraints: {
            ...state.providerConstraints,
            [provider]: { ...current, ...constraint }
          }
        };
      }),

      clearCartProvider: (provider) => set(state => ({
        cartItems: state.cartItems.filter(i => i.provider !== provider)
      })),

      saveAnalyzerToCloud: async () => {
        set({ syncStatus: 'saving' });
        try {
          const state = get();
          const payload = {
            inventoryRecords: state.inventoryRecords,
            cartItems: state.cartItems,
            providerConstraints: state.providerConstraints,
            updated_at: new Date().toISOString()
          };
          if (supabase) {
            const { error } = await supabase
              .from('layout_state')
              .upsert({ id: 'analyzer-state', state: payload });
            if (error) throw error;
            set({ syncStatus: 'saved' });
          } else {
            set({ syncStatus: 'error' });
          }
        } catch (e) {
          console.error(e);
          set({ syncStatus: 'error' });
        }
      },

      loadAnalyzerFromCloud: async () => {
        try {
          if (supabase) {
            const { data, error } = await supabase
              .from('layout_state')
              .select('state')
              .eq('id', 'analyzer-state')
              .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data && data.state) {
              set({ 
                inventoryRecords: data.state.inventoryRecords || [],
                cartItems: data.state.cartItems || [],
                providerConstraints: data.state.providerConstraints || {}
              });
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }),
    {
      name: 'wms-analyzer-storage',
    }
  )
);
