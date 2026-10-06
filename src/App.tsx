import { useState } from 'react';
import { LayoutEditor } from './components/LayoutEditor';
import { RackFrontalView } from './components/RackFrontalView';
import { InventoryAnalyzer } from './components/InventoryAnalyzer';
import { useStore } from './store/useStore';
import { Layers, Search, Package, Map, Lock, Unlock, Trash2, CloudUpload, CloudDownload, X, Activity } from 'lucide-react';

function App() {
  const [view, setView] = useState<'LAYOUT' | 'DATA' | 'ANALYZER'>('LAYOUT');
  const [showPanel, setShowPanel] = useState(false);
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
  const activeLevel = useStore(state => state.activeLevel);
  const searchQuery = useStore(state => state.searchQuery);
  const setActiveLevel = useStore(state => state.setActiveLevel);
  const setSearchQuery = useStore(state => state.setSearchQuery);
  const currentUserRole = useStore(state => state.currentUserRole);
  const setCurrentUserRole = useStore(state => state.setCurrentUserRole);
  
  const [passwordInput, setPasswordInput] = useState('');

  if (!currentUserRole) {
    return (
      <div className="flex h-screen w-screen bg-slate-100 items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-xl w-96 flex flex-col items-center">
          <Layers size={48} className="text-blue-600 mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-6">WMS Login</h1>
          
          <input 
            type="password"
            placeholder="Contraseña"
            className="w-full p-3 border border-slate-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (passwordInput === 'almacen123') setCurrentUserRole('ALMACEN');
                else if (passwordInput === 'ventas123') setCurrentUserRole('VENTAS');
                else alert('Contraseña incorrecta');
              }
            }}
          />
          <div className="flex w-full gap-2 mt-2">
            <button 
              className="flex-1 bg-slate-800 text-white py-2 rounded font-bold hover:bg-slate-700"
              onClick={() => {
                if (passwordInput === 'almacen123') setCurrentUserRole('ALMACEN');
                else if (passwordInput === 'ventas123') setCurrentUserRole('VENTAS');
                else alert('Contraseña incorrecta');
              }}
            >
              Ingresar
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">Contraseñas por defecto: almacen123 / ventas123</p>
        </div>
      </div>
    );
  }

  const isVentas = currentUserRole === 'VENTAS';

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-white text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-16 h-16 md:h-full bg-slate-900 text-white flex flex-row md:flex-col items-center py-2 md:py-4 px-2 md:px-0 md:space-y-8 z-50 order-last md:order-first justify-around md:justify-start overflow-x-auto flex-shrink-0">
        <button className={`p-2 rounded-lg flex-shrink-0 ${view === 'LAYOUT' ? 'bg-blue-600' : 'hover:bg-slate-800'}`} title="Mapa 2D" onClick={() => setView('LAYOUT')}>
          <Map size={24} />
        </button>
        {!isVentas && (
          <>
            <button className={`p-2 rounded-lg flex-shrink-0 ${view === 'DATA' ? 'bg-blue-600' : 'hover:bg-slate-800'}`} title="Artículos" onClick={() => setView('DATA')}>
              <Package size={24} />
            </button>
            <button className={`p-2 rounded-lg flex-shrink-0 ${view === 'ANALYZER' ? 'bg-blue-600' : 'hover:bg-slate-800'}`} title="Analizador" onClick={() => setView('ANALYZER')}>
              <Activity size={24} />
            </button>
          </>
        )}
        <button className="p-2 hover:bg-slate-800 rounded-lg flex-shrink-0" title="Buscador" onClick={() => {
          setView('LAYOUT');
          setTimeout(() => document.getElementById('main-search-input')?.focus(), 100);
        }}>
          <Search size={24} />
        </button>
        <div className="hidden md:block flex-grow"></div>
        <div className="flex flex-row md:flex-col gap-2 md:mb-4 md:border-b md:border-slate-700 md:pb-4 border-l md:border-l-0 pl-2 md:pl-0 border-slate-700">
          {!isVentas && (
            <button 
              className={`p-2 rounded-lg flex-shrink-0 ${syncStatus === 'saving' ? 'animate-pulse text-blue-400' : syncStatus === 'saved' ? 'text-emerald-400' : 'hover:bg-slate-800'}`} 
              title="Guardar en la Nube" 
              onClick={() => {
                saveToCloud().then(() => {
                  if (useStore.getState().syncStatus === 'saved') {
                    alert('¡Guardado en la nube exitoso!');
                  } else if (useStore.getState().syncStatus === 'error') {
                    alert('No se pudo guardar. Verifica la conexión o configuración de la base de datos.');
                  }
                });
              }}
            >
              <CloudUpload size={24} />
            </button>
          )}
          <button className="p-2 hover:bg-slate-800 rounded-lg flex-shrink-0" title="Cargar desde la Nube" onClick={() => {
            loadFromCloud().then(() => alert('¡Datos cargados desde la nube! (si había algo guardado)'));
          }}>
            <CloudDownload size={24} />
          </button>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-lg flex-shrink-0 text-red-400" title="Cerrar Sesión" onClick={() => {
          if (confirm('¿Cerrar sesión?')) setCurrentUserRole(null);
        }}>
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {(view === 'LAYOUT' || isVentas) ? (
          <>
            {/* Mobile Panel Toggle */}
            <button
              className="md:hidden absolute bottom-20 md:bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg"
              onClick={() => setShowPanel(!showPanel)}
            >
              {showPanel ? <X size={24} /> : <Layers size={24} />}
            </button>
            
            {/* Context Panel */}
            <div className={`absolute md:relative z-40 h-full bg-slate-50 border-r border-slate-200 p-3 flex flex-col overflow-y-auto w-72 md:w-80 transform transition-transform duration-300 ${showPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers size={20} /> Estructura
                </h2>
                {!isVentas && (
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
                )}
              </div>
              


              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sucursal</label>
                  {!isVentas && <button className="text-xs text-blue-600 hover:underline" onClick={() => addBranch("Nueva Sucursal")}>+ Agregar</button>}
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
                  {!isVentas && <button className="text-xs text-blue-600 hover:underline" onClick={() => { if(activeBranchId) addRoom(activeBranchId); }}>+ Agregar</button>}
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

              {!isVentas && (
                <>
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
                            <label className="block text-slate-500 mb-1">Filas (Niveles)</label>
                            <input type="number" min="1" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.rows} onChange={e => updateRackProperties(selectedData.id, { rows: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="block text-slate-500 mb-1">Columnas</label>
                            <input type="number" min="1" className="w-full p-1 border border-slate-300 rounded"
                              value={selectedData.cols} onChange={e => updateRackProperties(selectedData.id, { cols: Number(e.target.value) })} />
                          </div>
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
                             <span className="text-xs text-slate-400">Si lo dejas vacío, se coloreará según estatus o búsqueda.</span>
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
                        {selectedType === 'ROOM' && (
                          <div>
                            <label className="block text-slate-500 mb-1 mt-1">Planta / Nivel</label>
                            <select 
                              className="w-full p-1 border border-slate-300 rounded text-sm"
                              value={selectedData.level || 0} 
                              onChange={e => updateProps({ level: Number(e.target.value) })}
                            >
                              <option value={0}>Planta Baja</option>
                              <option value={1}>1er Piso (Planta Alta)</option>
                              <option value={2}>2do Piso</option>
                            </select>
                          </div>
                        )}
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
              </>
              )}

            </div>
            
            {/* Canvas */}
            <div className="flex-1 relative">
              <LayoutEditor />

              {/* Floating Rack Contents Panel */}
              {(() => {
                if (!selectedShapeId) return null;
                let rack: any = null;
                for (const b of branches) {
                  for (const r of b.rooms) {
                    for (const a of r.areas) {
                      rack = a.racks.find(rack => rack.id === selectedShapeId);
                      if (rack) break;
                    }
                    if (rack) break;
                    rack = r.racks.find(rack => rack.id === selectedShapeId);
                    if (rack) break;
                  }
                  if (rack) break;
                }
                
                if (!rack) return null;

                const codes = new Set<string>();
                (rack.cells || []).forEach((c: any) => {
                  const items = c.items && c.items.length > 0 ? c.items : (c.articleId ? [{articleId: c.articleId}] : []);
                  items.forEach((i: any) => { if (i.articleId) codes.add(i.articleId) });
                });

                return (
                  <div className="absolute right-4 top-20 bottom-4 w-64 bg-slate-50 shadow-2xl border border-slate-200 rounded-xl pointer-events-auto flex flex-col z-20 overflow-hidden transition-all duration-300">
                    <div className="bg-slate-800 text-white p-3 font-bold text-sm flex justify-between items-center shadow-sm">
                      <span>Contenido de {rack.name}</span>
                      <span className="bg-slate-700 px-2 py-0.5 rounded-full text-xs">{codes.size} items</span>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 space-y-1.5 bg-slate-50">
                      {codes.size === 0 ? (
                        <div className="text-sm text-slate-400 italic text-center mt-4">Rack vacío</div>
                      ) : (
                        Array.from(codes).map(code => (
                          <div key={code} className="text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 font-mono shadow-sm">
                            {code}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Overlay Top Bar */}
              <div className="absolute top-4 left-4 right-4 flex flex-col md:flex-row justify-between pointer-events-none gap-2 z-30">
                <div className="hidden md:flex bg-white/90 backdrop-blur shadow-md rounded-lg p-2 px-4 gap-4 text-sm font-medium text-slate-600 pointer-events-auto">
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
                {/* Right Side Controls */}
                <div className="flex gap-2 pointer-events-auto w-full md:w-auto justify-between md:justify-end">
                  <select 
                    className="bg-white/90 backdrop-blur shadow-md rounded-lg p-2 px-2 md:px-4 text-sm font-bold text-slate-700 outline-none cursor-pointer flex-1 md:flex-none"
                    value={activeLevel || 0}
                    onChange={(e) => setActiveLevel(Number(e.target.value))}
                  >
                    <option value={0}>PB (Planta Baja)</option>
                    <option value={1}>PA (Planta Alta)</option>
                    <option value={2}>2do Piso</option>
                  </select>

                  {/* Search Bar */}
                  <div className="bg-white/90 backdrop-blur shadow-md rounded-lg p-2 px-2 md:px-4 flex items-center flex-1 md:flex-none">
                    <Search size={18} className="text-slate-400 mr-1 md:mr-2 flex-shrink-0" />
                    <input 
                      id="main-search-input"
                      type="text" 
                      placeholder="Buscar Clave o Desc..."
                      className="bg-transparent border-none outline-none text-sm w-full md:w-48"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : view === 'DATA' ? (
          <div className="p-4 md:p-8 w-full bg-slate-50 overflow-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h1 className="text-xl md:text-2xl font-bold">Registro de Artículos</h1>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="hidden md:inline-block text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full shadow-sm border border-emerald-200">
                  ✅ Activo y Memoria Lista
                </span>
                <button 
                  className={`px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 font-medium transition-colors ${useStore.getState().syncStatus === 'saving' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  onClick={() => {
                    useStore.getState().saveToCloud().then(() => {
                      if (useStore.getState().syncStatus === 'saved') {
                        alert('¡Catálogo guardado en la nube exitosamente!');
                      } else {
                        alert('Hubo un problema al subir a la nube.');
                      }
                    });
                  }}
                >
                  <CloudUpload size={18} /> 
                  {useStore.getState().syncStatus === 'saving' ? 'Subiendo...' : 'Respaldar en la Nube'}
                </button>
                <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 text-sm md:text-base font-medium">
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
                          alert('¡Excel importado con éxito! Tus artículos ya están listos en la memoria para asignarlos en el Mapa 2D.');
                        });
                      }
                    }} 
                  />
                </label>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg border border-slate-200 overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[600px]">
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
                  {!(Array.isArray(articles) && articles.length > 0) ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">
                        No hay artículos cargados. Importe un archivo Excel.
                      </td>
                    </tr>
                  ) : (
                    articles.slice(0, 100).map((art: any) => (
                      <tr key={String(art?.id || Math.random())} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm">{String(art?.id || '')}</td>
                        <td className="p-3 text-sm truncate max-w-xs">{String(art?.description || '')}</td>
                        <td className="p-3 text-sm">{String(art?.stock?.['BODEGA LEON'] || 0)}</td>
                        <td className="p-3 text-sm">{String(art?.stock?.['CELAYA'] || 0)}</td>
                        <td className="p-3 text-sm">
                           <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                             {String(art?.status || 'N/A')}
                           </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {(Array.isArray(articles) && articles.length > 100) && (
                <div className="p-3 text-center text-sm text-slate-500">
                  Mostrando 100 de {articles.length} artículos...
                </div>
              )}
            </div>
          </div>
        ) : view === 'ANALYZER' ? (
          <InventoryAnalyzer />
        ) : null}
      </div>
      <RackFrontalView />
    </div>
  );
}

export default App;
