import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAnalyzerStore } from '../store/useAnalyzerStore';
import { ShoppingCart, Download, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export const SuggestedOrdersPanel: React.FC = () => {
  const records = useAnalyzerStore(state => state.inventoryRecords);
  const cartItems = useAnalyzerStore(state => state.cartItems);
  const providerConstraints = useAnalyzerStore(state => state.providerConstraints);
  const addToCart = useAnalyzerStore(state => state.addToCart);
  const removeFromCart = useAnalyzerStore(state => state.removeFromCart);
  const updateProviderConstraint = useAnalyzerStore(state => state.updateProviderConstraint);
  const clearCartProvider = useAnalyzerStore(state => state.clearCartProvider);

  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // Suggested items: where stock <= reorder point and needs replenish to Max Stock
  const suggestedItems = useMemo(() => {
    const list = records.filter(r => r.theoreticalStock <= r.reorderPoint && r.reorderPoint > 0);
    const byProvider = new Map<string, typeof list>();
    list.forEach(item => {
      if (!byProvider.has(item.provider)) byProvider.set(item.provider, []);
      byProvider.get(item.provider)!.push(item);
    });
    return byProvider;
  }, [records]);

  const handleExport = (provider: string) => {
    const providerCart = cartItems.filter(i => i.provider === provider);
    if (providerCart.length === 0) {
      alert('El carrito está vacío para este proveedor. Añade artículos sugeridos primero.');
      return;
    }
    const dataToExport = providerCart.map(i => ({
      'Clave': i.id,
      'Descripción': i.description,
      'Stock Actual': records.find(r => r.id === i.id)?.theoreticalStock || 0,
      'Cantidad a Pedir': i.quantityToOrder,
      'Costo Total': i.quantityToOrder * i.unitCost
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `Pedido_Sugerido_${provider}.xlsx`);
  };

  const handleAddAll = (provider: string) => {
    const items = suggestedItems.get(provider) || [];
    items.forEach(i => {
      const qty = Math.max(0, i.maxStock - i.theoreticalStock);
      if (qty > 0) {
        addToCart({
          id: i.id,
          provider: i.provider,
          description: i.description,
          quantityToOrder: qty,
          unitCost: i.unitCost
        });
      }
    });
  };

  if (suggestedItems.size === 0 && cartItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
        <ShoppingCart className="text-blue-600" size={20} /> Pedidos Sugeridos y Carrito
      </h2>

      <div className="space-y-4">
        {Array.from(suggestedItems.keys()).concat(Array.from(new Set(cartItems.map(i => i.provider)))).filter((v, i, a) => a.indexOf(v) === i).map(provider => {
          const suggestions = suggestedItems.get(provider) || [];
          const providerCart = cartItems.filter(i => i.provider === provider);
          const constraints = providerConstraints[provider] || { minCost: 0, minVolume: 0 };
          
          const cartTotalCost = providerCart.reduce((sum, i) => sum + (i.quantityToOrder * i.unitCost), 0);
          const cartTotalVol = providerCart.reduce((sum, i) => sum + i.quantityToOrder, 0);

          const meetsCost = constraints.minCost === 0 || cartTotalCost >= constraints.minCost;
          const meetsVol = constraints.minVolume === 0 || cartTotalVol >= constraints.minVolume;
          const isExpanded = expandedProvider === provider;

          return (
            <div key={provider} className="border border-slate-200 rounded-lg overflow-hidden">
              <div 
                className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedProvider(isExpanded ? null : provider)}
              >
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{provider}</span>
                  <span className="text-sm text-slate-500">Sugeridos: {suggestions.length} | En Carrito: {providerCart.length}</span>
                </div>
                <div className="flex items-center gap-4">
                  {!meetsCost && <span className="text-xs text-rose-600 font-bold flex items-center gap-1"><AlertCircle size={14}/> No llega al mínimo ($)</span>}
                  {!meetsVol && <span className="text-xs text-rose-600 font-bold flex items-center gap-1"><AlertCircle size={14}/> No llega al volumen</span>}
                  {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                  
                  {/* Suggestions List */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-slate-700 text-sm">Sugerencias del Analizador</h4>
                      <button onClick={() => handleAddAll(provider)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <Plus size={14} /> Añadir Todo
                      </button>
                    </div>
                    {suggestions.length === 0 ? <p className="text-xs text-slate-400">No hay sugerencias pendientes.</p> : (
                      <div className="max-h-60 overflow-auto space-y-2 pr-2">
                        {suggestions.map(item => {
                          const qty = Math.max(0, item.maxStock - item.theoreticalStock);
                          const inCart = providerCart.some(i => i.id === item.id);
                          return (
                            <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">{item.id}</span>
                                <span className="text-[10px] text-slate-500 truncate w-32" title={item.description}>{item.description}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-blue-600">{qty} pz</span>
                                <button 
                                  onClick={() => addToCart({ id: item.id, provider, description: item.description, quantityToOrder: qty, unitCost: item.unitCost })}
                                  disabled={inCart}
                                  className={`p-1 rounded ${inCart ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                                  title="Añadir al carrito"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Cart and Restrictions */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col">
                    <h4 className="font-bold text-slate-700 text-sm mb-3 flex justify-between">
                      Carrito de Pedido
                      <button onClick={() => clearCartProvider(provider)} className="text-xs text-rose-500 hover:text-rose-700">Vaciar</button>
                    </h4>
                    
                    <div className="flex-1 overflow-auto mb-4">
                      {providerCart.length === 0 ? <p className="text-xs text-slate-400 text-center mt-4">Carrito vacío</p> : (
                        <div className="space-y-2">
                          {providerCart.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                              <span className="text-xs font-bold">{item.id}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">{item.quantityToOrder}</span>
                                <button onClick={() => removeFromCart(item.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600">Volumen Mínimo (pz)</label>
                        <input type="number" className="w-20 text-xs p-1 border rounded text-right" value={constraints.minVolume} onChange={(e) => updateProviderConstraint(provider, { minVolume: Number(e.target.value) })} />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600">Monto Mínimo ($)</label>
                        <input type="number" className="w-20 text-xs p-1 border rounded text-right" value={constraints.minCost} onChange={(e) => updateProviderConstraint(provider, { minCost: Number(e.target.value) })} />
                      </div>
                      
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500">Vol: <span className={meetsVol ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{cartTotalVol}</span></span>
                          <span className="text-xs text-slate-500">Total: <span className={meetsCost ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>${cartTotalCost.toFixed(2)}</span></span>
                        </div>
                        <button 
                          onClick={() => handleExport(provider)}
                          disabled={!meetsCost || !meetsVol || providerCart.length === 0}
                          className={`flex items-center gap-1 px-4 py-2 rounded text-sm font-bold transition-colors ${(meetsCost && meetsVol && providerCart.length > 0) ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                          <Download size={16} /> Exportar Excel
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
};
