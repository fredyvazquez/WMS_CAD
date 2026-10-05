import { useState } from 'react';
import { LayoutEditor } from './components/LayoutEditor';
import { RackFrontalView } from './components/RackFrontalView';
import { useStore } from './store/useStore';
import { Layers, Settings, Search, Package, Map, Lock, Unlock, Trash2, CloudUpload, CloudDownload } from 'lucide-react';

function App() {
  const [view, setView] = useState<'LAYOUT' | 'DATA'>('LAYOUT');
  const articles = useStore(state => state.articles);
  const branches = useStore(state => state.branches);
  const activeBranchId = useStore(state => state.activeBranchId);
  const activeRoomId = useStore(state => state.activeRoomId);
  const selectedShapeId = useStore(state => state.selectedShapeId);
  const setActiveBranch = useStore(state => state.setActiveBranch);
  const setActiveRoom = useStore(state => state.setActiveRoom);
  const addRoom = useStore(state => state.addRoom);
  const addRack = useStore(state => state.addRack);
  const addBranch = useStore(state => state.addBranch);
  const addArea = useStore(state => state.addArea);
  const isEditMode = useStore(state => state.isEditMode);
  const setIsEditMode = useStore(state => state.setIsEditMode);
  const updateRackProperties = useStore(state => state.updateRackProperties);
  const updateBranchProperties = useStore(state => state.updateBranchProperties);
  const updateRoomProperties = useStore(state => state.updateRoomProperties);
  const updateAreaProperties = useStore(state => state.updateAreaProperties);
  const deleteRack = useStore(state => state.deleteRack);
  const deleteArea = useStore(state => state.deleteArea);
  const deleteRoom = useStore(state => state.deleteRoom);
  const syncStatus = useStore(state => state.syncStatus);
  const saveToCloud = useStore(state => state.saveToCloud);
  const loadFromCloud = useStore(state => state.loadFromCloud);

  return (
    <div className="flex h-screen w-screen bg-white text-slate-800 font-sans">
      {/* Sidebar */}
      <div className="w-16 bg-slate-900 text-white flex flex-col items-center py-4 space-y-8">
        <button className="p-2 hover:bg-slate-800 rounded-lg" title="Mapa 2D" onClick={() => setView('LAYOUT')}>
          <Map size={24} />
        </button>
        <button className="p-2 hover:bg-slate-800 rounded-lg" title="Artículos" onClick={() => setView('DATA')}>
          <Package size={24} />
        </button>
        <button className="p-2 hover:bg-slate-800 rounded-lg" title="Buscador">
          <Search size={24} />
        </button>
        <div className="flex-grow"></div>
        <div className="flex flex-col gap-2 mb-4 border-b border-slate-700 pb-4">
          <button 
            className={`p-2 rounded-lg ${syncStatus === 'saving' ? 'animate-pulse text-blue-400' : syncStatus === 'saved' ? 'text-emerald-400' : 'hover:bg-slate-800'}`} 
            title="Guardar en la Nube" 
            onClick={saveToCloud}
          >
            <CloudUpload size={24} />
          </button>
          <button className="p-2 hover:bg-slate-800 rounded-lg" title="Cargar desde la Nube" onClick={loadFromCloud}>
            <CloudDownload size={24} />
          </button>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-lg" title="Configuración">
          <Settings size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {view === 'LAYOUT' ? (
          <>
            {/* Context Panel */}
            <div className="w-80 bg-slate-50 border-r border-slate-200 p-3 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers size={20} /> Estructura
                </h2>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    isEditMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                  title={isEditMode ? "Bloquear Plano (Modo Lectura)" : "Desbloquear Plano (Modo Edición)"}
                >
                  {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                  {isEditMode ? 'Desbloqueado' : 'Bloqueado'}
                </button>
              </div>
              


              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sucursal</label>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => addBranch("Nueva Sucursal")}>+ Agregar</button>
                </div>
                <select 
                  className="w-full p-1 border border-slate-300 rounded text-sm"
                  value={activeBranchId || ''}
                  onChange={(e) => setActiveBranch(e.target.value)}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Habitación</label>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => { if(activeBranchId) addRoom(activeBranchId); }}>+ Agregar</button>
                </div>
                <select 
                  className="w-full p-1 border border-slate-300 rounded text-sm"
                  value={activeRoomId || ''}
                  onChange={(e) => setActiveRoom(e.target.value)}
                >
                  {branches.find(b => b.id === activeBranchId)?.rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2 border-t border-slate-200 pt-2">
                <h3 className="text-sm font-bold mb-2">Herramientas</h3>
                <div className="space-y-2">
                  <button 
                    className="w-full bg-indigo-100 text-indigo-700 rounded px-4 py-2 text-sm hover:bg-indigo-200 font-medium"
                    onClick={() => {
                      if(activeBranchId && activeRoomId) addArea(activeBranchId, activeRoomId);
                    }}
                  >
                    + Nueva Zona
                  </button>
                  <button 
                    className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 font-medium"
                    onClick={() => {
                      if(activeBranchId && activeRoomId) addRack(activeBranchId, activeRoomId);
                    }}
                  >
                    + Nuevo Rack
                  </button>
                </div>
              </div>

              {/* Properties Panel */}
              {(() => {
                if (!selectedShapeId) return null;
                
                let selectedType = '';
                let selectedData: any = null;

                for (const b of branches) {
                  if (b.id === selectedShapeId) { selectedType = 'BRANCH'; selectedData = b; break; }
                  for (const r of b.rooms) {
                    if (r.id === selectedShapeId) { selectedType = 'ROOM'; selectedData = r; break; }
                    for (const a of r.areas) {
                      if (a.id === selectedShapeId) { selectedType = 'AREA'; selectedData = a; break; }
                      const rack = a.racks.find(rack => rack.id === selectedShapeId);
                      if (rack) { selectedType = 'RACK'; selectedData = rack; break; }
                    }
                    if (selectedType) break;
                    const rack = r.racks.find(rack => rack.id === selectedShapeId);
                    if (rack) { selectedType = 'RACK'; selectedData = rack; break; }
                  }
                  if (selectedType) break;
                }

                if (!selectedData) return null;

                if (selectedType === 'RACK') {
                  return (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-blue-600">Propiedades del Rack</h3>
                        <button onClick={() => { if(confirm("¿Eliminar rack?")) deleteRack(selectedData.id) }} className="text-red-500 hover:text-red-700" title="Eliminar Rack">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <label className="block text-slate-500 mb-1">Nombre</label>
                          <input 
                            type="text" className="w-full p-1 border border-slate-300 rounded"
                            value={selectedData.name} onChange={e => updateRackProperties(selectedData.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-500 mb-1">Largo (cm)</label>
                            <input type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.width} onChange={e => updateRackProperties(selectedData.id, { width: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">Fondo (cm)</label>
                            <input type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.depth} onChange={e => updateRackProperties(selectedData.id, { depth: Number(e.target.value) })} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                           <span className="text-sm font-bold text-slate-600">Fijar Posición</span>
                           <button 
                             onClick={() => updateRackProperties(selectedData.id, { isLocked: !selectedData.isLocked })}
                             className={`px-3 py-1 rounded text-xs font-bold flex gap-1 items-center ${selectedData.isLocked ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}
                           >
                             {selectedData.isLocked ? <Lock size={12}/> : <Unlock size={12}/>}
                             {selectedData.isLocked ? 'Bloqueado' : 'Móvil'}
                           </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-500 mb-1">Alto (cm)</label>
                            <input type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.height} onChange={e => updateRackProperties(selectedData.id, { height: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">Rotación (°)</label>
                            <input type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={Math.round(selectedData.rotation)} onChange={e => updateRackProperties(selectedData.id, { rotation: Number(e.target.value) })} />
                          </div>
                        </div>
                        <div>
                           <label className="block text-slate-500 mb-1">Color (Opcional)</label>
                           <div className="flex gap-2 items-center">
                             <input 
                               type="color" className="p-0 border-0 w-10 h-10 rounded cursor-pointer"
                               value={selectedData.color && selectedData.color.startsWith('#') ? selectedData.color.slice(0, 7) : '#0f172a'} 
                               onChange={e => updateRackProperties(selectedData.id, { color: e.target.value })}
                             />
                             <span className="text-xs text-slate-400">Si lo dejas vacío o en negro, se coloreará según el estatus de sus artículos.</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (selectedType === 'BRANCH' || selectedType === 'ROOM' || selectedType === 'AREA') {
                  const titles = { 'BRANCH': 'Terreno Principal', 'ROOM': 'Habitación', 'AREA': 'Zona' };
                  const colors = { 'BRANCH': 'text-slate-700', 'ROOM': 'text-emerald-600', 'AREA': 'text-purple-600' };
                  
                  const updateProps = (updates: any) => {
                    if (selectedType === 'BRANCH') updateBranchProperties(selectedData.id, updates);
                    if (selectedType === 'ROOM') updateRoomProperties(selectedData.id, updates);
                    if (selectedType === 'AREA') updateAreaProperties(selectedData.id, updates);
                  };

                  return (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className={`text-sm font-bold ${colors[selectedType as keyof typeof colors]}`}>Propiedades: {titles[selectedType as keyof typeof titles]}</h3>
                        {(selectedType === 'AREA' || selectedType === 'ROOM') && (
                          <button 
                            onClick={() => { 
                              if(confirm(`¿Eliminar ${titles[selectedType as keyof typeof titles]} y todo su contenido?`)) {
                                if (selectedType === 'AREA') deleteArea(selectedData.id);
                                if (selectedType === 'ROOM') deleteRoom(selectedData.id);
                              }
                            }} 
                            className="text-red-500 hover:text-red-700" 
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <label className="block text-slate-500 mb-1">Nombre</label>
                          <input 
                            type="text" className="w-full p-1 border border-slate-300 rounded"
                            value={selectedData.name} onChange={e => updateProps({ name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-500 mb-1">Largo Total (cm)</label>
                            <input 
                              type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.width || 0} onChange={e => updateProps({ width: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">Fondo Total (cm)</label>
                            <input 
                              type="number" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.height || 0} onChange={e => updateProps({ height: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        {(selectedType === 'AREA' || selectedType === 'ROOM') && (
                          <div className="flex items-center justify-between pt-2">
                             <span className="text-sm font-bold text-slate-600">Fijar Posición</span>
                             <button 
                               onClick={() => updateProps({ isLocked: !selectedData.isLocked })}
                               className={`px-3 py-1 rounded text-xs font-bold flex gap-1 items-center ${selectedData.isLocked ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}
                             >
                               {selectedData.isLocked ? <Lock size={12}/> : <Unlock size={12}/>}
                               {selectedData.isLocked ? 'Bloqueado' : 'Móvil'}
                             </button>
                          </div>
                        )}
                        {(selectedType === 'AREA' || selectedType === 'ROOM') && (
                          <div>
                             <label className="block text-slate-500 mb-1">Color de Fondo</label>
                             <div className="flex gap-2 items-center">
                               <input 
                                 type="color" className="p-0 border-0 w-10 h-10 rounded cursor-pointer"
                                 value={selectedData.color && selectedData.color.startsWith('#') ? selectedData.color.slice(0, 7) : '#ffffff'} 
                                 onChange={e => updateProps({ color: e.target.value })}
                               />
                               <span className="text-xs text-slate-400">Escoge un color. Se verá transparente automáticamente.</span>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

            </div>
            
            {/* Canvas */}
            <div className="flex-1 relative">
              <LayoutEditor />
              {/* Overlay Top Bar */}
              <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                <div className="bg-white/90 backdrop-blur shadow-md rounded-lg p-2 px-4 flex gap-4 text-sm font-medium text-slate-600 pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span> Activo
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span> Lento/Revisión
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span> Basura/Chatarra
                  </div>
                </div>
                
                {/* Search Bar */}
                <div className="bg-white/90 backdrop-blur shadow-md rounded-lg p-2 px-4 flex items-center pointer-events-auto">
                  <Search size={18} className="text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Buscar Clave..."
                    className="bg-transparent border-none outline-none text-sm w-48"
                    value={useStore(s => s.searchQuery)}
                    onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 w-full bg-slate-50 overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Registro de Artículos</h1>
              <div className="flex gap-2">
                <button 
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-orange-600"
                  onClick={() => {
                     useStore.getState().autoAssignDemo();
                     alert("¡Inventario distribuido en los Racks automáticamente para propósitos de demostración!");
                  }}
                >
                  Auto-Asignar (Demo)
                </button>
                <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700">
                  Importar Excel
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        import('./utils/excelParser').then(async ({ parseExcelData }) => {
                          const data = await parseExcelData(file);
                          useStore.getState().setArticles(data);
                        });
                      }
                    }} 
                  />
                </label>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="p-3 font-semibold text-sm">Clave</th>
                    <th className="p-3 font-semibold text-sm">Descripción</th>
                    <th className="p-3 font-semibold text-sm">Bodega León</th>
                    <th className="p-3 font-semibold text-sm">Celaya</th>
                    <th className="p-3 font-semibold text-sm">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">
                        No hay artículos cargados. Importe un archivo Excel.
                      </td>
                    </tr>
                  ) : (
                    articles.slice(0, 100).map(art => (
                      <tr key={art.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm">{art.id}</td>
                        <td className="p-3 text-sm truncate max-w-xs">{art.description}</td>
                        <td className="p-3 text-sm">{art.stock['BODEGA LEON']}</td>
                        <td className="p-3 text-sm">{art.stock['CELAYA']}</td>
                        <td className="p-3 text-sm">
                           <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                             {art.status}
                           </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {articles.length > 100 && (
                <div className="p-3 text-center text-sm text-slate-500">
                  Mostrando 100 de {articles.length} artículos...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <RackFrontalView />
    </div>
  );
}

export default App;
