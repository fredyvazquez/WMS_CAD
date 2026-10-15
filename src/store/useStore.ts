import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Branch, Article, LayoutState, Rack, Room, Area } from '../types';
import { supabase } from '../lib/supabase';
import { threeWayMerge } from '../utils/merge';
import { broadcastLayoutUpdate } from '../lib/realtime';

// Track the baseline state when we load from cloud so we can merge smartly
let baselineState: { branches: Branch[], articles: Article[] } | null = null;


interface WMSStore extends LayoutState {
  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branchId: string | null) => void;
  setActiveRoom: (roomId: string | null) => void;
  setActiveRack: (rackId: string | null) => void;
  setActiveLevel: (level: number) => void;
  setArticles: (articles: Article[]) => void;
  setSelectedShapeId: (id: string | null) => void;
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  toggleShapeSelection: (id: string) => void;
  moveShapesByDelta: (ids: string[], dx: number, dy: number) => void;
  duplicateRack: (rackId: string) => void;
  updateCellItemQuantity: (rackId: string, cellRow: number, cellCol: number, articleId: string, delta: number) => void;
  removeCellItem: (rackId: string, cellRow: number, cellCol: number, articleId: string) => void;
  updateRackProperties: (rackId: string, updates: Partial<Rack>) => void;
  updateRackPosition: (branchId: string, roomId: string, areaId: string | null, rackId: string, x: number, y: number, rotation: number) => void;
  addRack: (branchId: string, roomId: string) => void;
  addRoom: (branchId: string, level?: number) => void;
  assignArticleToCell: (rackId: string, row: number, col: number, articleId: string | null, quantity: number) => void;
  updateCellItems: (rackId: string, row: number, col: number, items: import('../types').CellItem[]) => void;
  autoAssignDemo: () => void;
  setSearchQuery: (query: string) => void;
  setIsEditMode: (v: boolean) => void;
  addBranch: (name: string) => void;
  addArea: (branchId: string, roomId: string) => void;
  updateBranchProperties: (branchId: string, updates: Partial<Branch>) => void;
  updateRoomProperties: (roomId: string, updates: Partial<Room>) => void;
  updateAreaProperties: (areaId: string, updates: Partial<Area>) => void;
  updateAreaPosition: (branchId: string, roomId: string, areaId: string, x: number, y: number) => void;
  updateRoomPosition: (branchId: string, roomId: string, x: number, y: number) => void;
  deleteRack: (rackId: string) => void;
  deleteArea: (areaId: string) => void;
  deleteRoom: (roomId: string) => void;
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasPendingLocalChanges: boolean;
  applyRemoteUpdate: (branches: Branch[], articles?: Article[]) => void;
  searchQuery: string;
  setCurrentUserRole: (role: import('../types').UserRole) => void;
  setUserBranchScope: (branchId: string | null) => void;
  setViewMode: (viewMode: import('../types').ViewMode) => void;
}

const mockBranch: Branch = {
  id: 'b-1',
  name: 'BODEGA LEON',
  width: 2000,
  height: 1500,
  rooms: [
    {
      id: 'r-1',
      name: 'Nave Principal',
      x: 50,
      y: 50,
      width: 1000,
      height: 800,
      areas: [
        {
          id: 'a-1',
          name: 'Zona Amarilla',
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          color: 'rgba(255, 255, 0, 0.2)',
          racks: [
            { id: 'rack-1', name: 'R-A1', x: 120, y: 120, rotation: 0, width: 200, depth: 60, height: 250, rows: 4, cols: 5, cells: [] },
            { id: 'rack-2', name: 'R-A2', x: 120, y: 220, rotation: 0, width: 200, depth: 60, height: 250, rows: 4, cols: 5, cells: [] }
          ]
        }
      ],
      racks: []
    }
  ]
};


let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const scheduleAutoSave = (delayMs: number = 400) => {
  useStore.setState({ hasPendingLocalChanges: true, syncStatus: 'idle' });
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    useStore.getState().saveToCloud();
  }, delayMs);
};

export const useStore = create<WMSStore>()(
  persist(
    (set) => ({
      branches: [mockBranch],
  activeBranchId: 'b-1',
  activeRoomId: 'r-1',
  activeRackId: null,
  activeLevel: 0,
  selectedShapeId: null,
  selectedShapeIds: [],
  articles: [],
  searchQuery: '',
  isEditMode: true,
  currentUserRole: null,
  userBranchScope: null,
  viewMode: 'DEFAULT',
  setViewMode: (viewMode: import('../types').ViewMode) => set({ viewMode }),
  setCurrentUserRole: (role) => set({ currentUserRole: role }),
  setUserBranchScope: (branchId) => set({ userBranchScope: branchId }),
  setIsEditMode: (isEditMode) => set({ isEditMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBranches: (branches) => set({ branches }),
  setActiveBranch: (activeBranchId) => set({ activeBranchId }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),
  setActiveRack: (activeRackId) => set({ activeRackId }),
  setActiveLevel: (activeLevel) => set({ activeLevel }),
  setSelectedShapeId: (selectedShapeId) => set({ selectedShapeId, selectedShapeIds: selectedShapeId ? [selectedShapeId] : [] }),
  setSelectedShapeIds: (ids) => set({ selectedShapeIds: ids, selectedShapeId: ids.length > 0 ? ids[ids.length - 1] : null }),
  toggleShapeSelection: (id) => set((state) => {
    if (state.selectedShapeIds.includes(id)) {
      const newIds = state.selectedShapeIds.filter(x => x !== id);
      return { selectedShapeIds: newIds, selectedShapeId: newIds.length > 0 ? newIds[newIds.length - 1] : null };
    } else {
      const newIds = [...state.selectedShapeIds, id];
      return { selectedShapeIds: newIds, selectedShapeId: id };
    }
  }),
  duplicateRack: (rackId) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        // Try to find in areas
        for (const a of r.areas) {
          const rackIdx = a.racks.findIndex(rk => rk.id === rackId);
          if (rackIdx !== -1) {
            const original = a.racks[rackIdx];
            let newName = `${original.name} (Copia)`;
            const match = original.name.match(/^(.*?)(\d+)$/);
            if (match) {
               newName = `${match[1]}${parseInt(match[2]) + 1}`;
            }
            const newRack = {
              ...original,
              id: `rack-${Date.now()}`,
              name: newName,
              x: original.x + 20,
              y: original.y + 20,
              cells: [] // Empty inventory!
            };
            a.racks.push(newRack);
            return { branches: newBranches, selectedShapeId: newRack.id, selectedShapeIds: [newRack.id] };
          }
        }
        // Try to find in room
        const rackIdx = r.racks.findIndex(rk => rk.id === rackId);
        if (rackIdx !== -1) {
            const original = r.racks[rackIdx];
            let newName = `${original.name} (Copia)`;
            const match = original.name.match(/^(.*?)(\d+)$/);
            if (match) {
               newName = `${match[1]}${parseInt(match[2]) + 1}`;
            }
            const newRack = {
              ...original,
              id: `rack-${Date.now()}`,
              name: newName,
              x: original.x + 20,
              y: original.y + 20,
              cells: [] // Empty inventory!
            };
            r.racks.push(newRack);
            return { branches: newBranches, selectedShapeId: newRack.id, selectedShapeIds: [newRack.id] };
        }
      }
    }
    return state;
  }),
  updateCellItemQuantity: (rackId, cellRow, cellCol, articleId, delta) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        let rack = r.racks.find(rk => rk.id === rackId);
        if (!rack) {
          for (const a of r.areas) {
            rack = a.racks.find(rk => rk.id === rackId);
            if (rack) break;
          }
        }
        if (rack && rack.cells) {
          const cell = rack.cells.find(c => c.row === cellRow && c.col === cellCol);
          if (cell) {
            if (!cell.items) {
              cell.items = cell.articleId ? [{ id: `${Date.now()}`, articleId: cell.articleId, quantity: cell.quantity || 1 }] : [];
            }
            const item = cell.items.find((i: any) => i.articleId === articleId);
            if (item) {
              item.quantity = Math.max(0, (item.quantity || 0) + delta);
              if (item.quantity === 0) {
                cell.items = cell.items.filter((i: any) => i.articleId !== articleId);
              }
            }
            if (cell.items.length > 0) {
              cell.articleId = cell.items[0].articleId;
              cell.quantity = cell.items[0].quantity;
            } else {
              cell.articleId = null;
              cell.quantity = 0;
            }
          }
          return { branches: newBranches };
        }
      }
    }
    return state;
  }),
  removeCellItem: (rackId, cellRow, cellCol, articleId) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        let rack = r.racks.find(rk => rk.id === rackId);
        if (!rack) {
          for (const a of r.areas) {
            rack = a.racks.find(rk => rk.id === rackId);
            if (rack) break;
          }
        }
        if (rack && rack.cells) {
          const cell = rack.cells.find(c => c.row === cellRow && c.col === cellCol);
          if (cell) {
            if (cell.items) {
              cell.items = cell.items.filter((i: any) => i.articleId !== articleId);
            }
            scheduleAutoSave();
            if (cell.items && cell.items.length > 0) {
              cell.articleId = cell.items[0].articleId;
              cell.quantity = cell.items[0].quantity;
            } else {
              cell.articleId = null;
              cell.quantity = 0;
              cell.items = [];
            }
          }
          return { branches: newBranches };
        }
      }
    }
    return state;
  }),
  moveShapesByDelta: (ids, dx, dy) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        if (ids.includes(r.id)) {
          r.x = (r.x || 0) + dx;
          r.y = (r.y || 0) + dy;
        }
        for (const a of r.areas) {
          if (ids.includes(a.id)) {
            a.x += dx;
            a.y += dy;
          }
          for (const rack of a.racks) {
            if (ids.includes(rack.id)) {
              rack.x += dx;
              rack.y += dy;
            }
          }
        }
        for (const rack of r.racks) {
          if (ids.includes(rack.id)) {
            rack.x += dx;
            rack.y += dy;
          }
        }
      }
    }
    return { branches: newBranches };
  }),
  setArticles: (articles) => set({ articles }),
  autoAssignDemo: () => set((state) => {
    // Randomly assign articles to empty cells across all racks to demonstrate the heat map
    if (state.articles.length === 0) return state;
    
    const newBranches = JSON.parse(JSON.stringify(state.branches)) as Branch[];
    const articlesCopy = [...state.articles];
    
    // Some logic to spread status
    let articleIndex = 0;
    
    for (const b of newBranches) {
      for (const r of b.rooms) {
        // Collect all racks in room
        const allRacks = [...r.racks, ...r.areas.flatMap(a => a.racks)];
        for (const rack of allRacks) {
          // ensure cells array is populated
          if (!rack.cells || rack.cells.length === 0) {
            rack.cells = [];
            for(let row=0; row<rack.rows; row++){
              for(let col=0; col<rack.cols; col++){
                rack.cells.push({ id: `${rack.id}-${row}-${col}`, row, col, articleId: null, quantity: 0 });
              }
            }
          }
          
          // assign 2-3 random articles to this rack to populate it
          for (let i = 0; i < 3; i++) {
             if (articleIndex >= articlesCopy.length) articleIndex = 0; // loop
             const art = articlesCopy[articleIndex++];
             // find empty cell
             const emptyCell = rack.cells.find(c => !c.articleId);
             if (emptyCell) {
                emptyCell.articleId = art.id;
                emptyCell.quantity = 10;
                // Add variety to status for demo purposes
                if (i % 3 === 0) art.status = 'DAMAGED';
                else if (i % 2 === 0) art.status = 'SLOW';
                else art.status = 'ACTIVE';
             }
          }
        }
      }
    }
    
    return { branches: newBranches, articles: articlesCopy };
  }),
  addRoom: (branchId, level = 0) => set((state) => {
    const newBranches = [...state.branches];
    const branch = newBranches.find(b => b.id === branchId);
    if (branch) {
      const newRoom: Room = {
        id: `r-${Date.now()}`,
        name: `Habitación ${branch.rooms.length + 1}`,
        x: 50, y: 50, width: 800, height: 600,
        level,
        areas: [], racks: []
      };
      branch.rooms.push(newRoom);
      return { branches: newBranches, activeRoomId: newRoom.id };
    }
    return state;
  }),
  addRack: (branchId, roomId) => set((state) => {
    const newBranches = [...state.branches];
    const room = newBranches.find(b => b.id === branchId)?.rooms.find(r => r.id === roomId);
    if (room) {
      const newRack: Rack = {
        id: `rack-${Date.now()}`,
        name: `RACK-${room.racks.length + 1}`,
        x: 100, y: 100, rotation: 0,
        width: 200, depth: 60, height: 200,
        rows: 4, cols: 5, cells: []
      };
      room.racks.push(newRack);
      scheduleAutoSave();
      return { branches: newBranches, selectedShapeId: newRack.id };
    }
    return state;
  }),
  updateRackProperties: (rackId, updates) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        let rack = r.racks.find(rack => rack.id === rackId);
        if (!rack) {
          for (const a of r.areas) {
            rack = a.racks.find(rack => rack.id === rackId);
            if (rack) break;
          }
        }
        if (rack) {
          Object.assign(rack, updates);
          scheduleAutoSave();
          if (updates.notes === undefined || updates.notes === '') {
            delete rack.notes;
          }
          return { branches: newBranches };
        }
      }
    }
    return state;
  }),
  updateRackPosition: (branchId, roomId, areaId, rackId, x, y, rotation) => set((state) => {
    const newBranches = [...state.branches];
    const branch = newBranches.find(b => b.id === branchId);
    if (!branch) return state;
    const room = branch.rooms.find(r => r.id === roomId);
    if (!room) return state;
    
    let rack;
    if (areaId) {
      const area = room.areas.find(a => a.id === areaId);
      if (area) rack = area.racks.find(r => r.id === rackId);
    } else {
      rack = room.racks.find(r => r.id === rackId);
    }
    
    if (rack) {
      rack.x = x;
      rack.y = y;
      rack.rotation = rotation;
    }
    
    return { branches: newBranches };
  }),
  assignArticleToCell: (rackId, row, col, articleId, quantity) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        let rack = r.racks.find(rack => rack.id === rackId);
        if (!rack) {
          for (const a of r.areas) {
            rack = a.racks.find(rack => rack.id === rackId);
            if (rack) break;
          }
        }
        if (rack) {
          if (!rack.cells) rack.cells = [];
          let cell = rack.cells.find(c => c.row === row && c.col === col);
          if (!cell) {
            cell = { id: `${rack.id}-${row}-${col}`, row, col, articleId: null, quantity: 0, items: [] };
            rack.cells.push(cell);
          }
          cell.articleId = articleId;
          cell.quantity = quantity;
          scheduleAutoSave();
          return { branches: newBranches };
        }
      }
    }
    return state;
  }),
  updateCellItems: (rackId: string, row: number, col: number, items: any[]) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        let rack = r.racks.find(rack => rack.id === rackId);
        if (!rack) {
          for (const a of r.areas) {
            rack = a.racks.find(rack => rack.id === rackId);
            if (rack) break;
          }
        }
        if (rack) {
          if (!rack.cells) rack.cells = [];
          let cell = rack.cells.find(c => c.row === row && c.col === col);
          if (!cell) {
            cell = { id: `${rack.id}-${row}-${col}`, row, col, articleId: null, quantity: 0, items: [] };
            rack.cells.push(cell);
          }
          cell.items = items;
          scheduleAutoSave();
          // Sync backward compat
          if (items.length > 0) {
             cell.articleId = items[0].articleId;
             cell.quantity = items[0].quantity;
          } else {
             cell.articleId = null;
             cell.quantity = 0;
          }
          return { branches: newBranches };
        }
      }
    }
    return state;
  }),
  addBranch: (name) => set((state) => {
    const id = `b-${Date.now()}`;
    return {
      branches: [...state.branches, { id, name, width: 2000, height: 1500, rooms: [] }],
      activeBranchId: id
    };
  }),
  addArea: (branchId, roomId) => set((state) => {
    const newBranches = [...state.branches];
    const branch = newBranches.find(b => b.id === branchId);
    if (!branch) return state;
    const room = branch.rooms.find(r => r.id === roomId);
    if (!room) return state;
    room.areas.push({
      id: `a-${Date.now()}`,
      name: 'Nueva Zona',
      x: 100, y: 100, width: 200, height: 200, color: 'rgba(0, 0, 255, 0.2)',
      racks: []
    });
    return { branches: newBranches };
  }),
  updateBranchProperties: (branchId, updates) => set((state) => {
    const newBranches = [...state.branches];
    const branch = newBranches.find(b => b.id === branchId);
    if (branch) Object.assign(branch, updates);
    return { branches: newBranches };
  }),
  updateRoomProperties: (roomId, updates) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      const room = b.rooms.find(r => r.id === roomId);
      if (room) { 
        if (updates.x !== undefined || updates.y !== undefined) {
          const dx = (updates.x ?? room.x) - room.x;
          const dy = (updates.y ?? room.y) - room.y;
          room.areas.forEach(a => { a.x -= dx; a.y -= dy; });
          room.racks.forEach(rak => { rak.x -= dx; rak.y -= dy; });
        }
        Object.assign(room, updates); 
        break; 
      }
    }
    return { branches: newBranches };
  }),
  updateAreaProperties: (areaId, updates) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        const area = r.areas.find(a => a.id === areaId);
        if (area) { 
          if (updates.x !== undefined || updates.y !== undefined) {
            const dx = (updates.x ?? area.x) - area.x;
            const dy = (updates.y ?? area.y) - area.y;
            area.racks.forEach(rak => { rak.x -= dx; rak.y -= dy; });
          }
          Object.assign(area, updates); 
          return { branches: newBranches }; 
        }
      }
    }
    return state;
  }),
  updateAreaPosition: (branchId, roomId, areaId, x, y) => set((state) => {
    const newBranches = [...state.branches];
    const area = newBranches.find(b => b.id === branchId)?.rooms.find(r => r.id === roomId)?.areas.find(a => a.id === areaId);
    if (area) { 
      const dx = x - area.x;
      const dy = y - area.y;
      area.x = x; 
      area.y = y; 
      area.racks.forEach(rak => { rak.x -= dx; rak.y -= dy; });
    }
    return { branches: newBranches };
  }),
  updateRoomPosition: (branchId, roomId, x, y) => set((state) => {
    const newBranches = [...state.branches];
    const room = newBranches.find(b => b.id === branchId)?.rooms.find(r => r.id === roomId);
    if (room) { 
      const dx = x - room.x;
      const dy = y - room.y;
      room.x = x; 
      room.y = y; 
      room.areas.forEach(a => { a.x -= dx; a.y -= dy; });
      room.racks.forEach(rak => { rak.x -= dx; rak.y -= dy; });
    }
    return { branches: newBranches };
  }),
  deleteRack: (rackId) => set((state) => {
    scheduleAutoSave();
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        const rackIndex = r.racks.findIndex(rak => rak.id === rackId);
        if (rackIndex !== -1) { 
          r.racks.splice(rackIndex, 1); 
          return { 
            branches: newBranches, 
            selectedShapeId: state.selectedShapeId === rackId ? null : state.selectedShapeId,
            activeRackId: state.activeRackId === rackId ? null : state.activeRackId
          }; 
        }
        for (const a of r.areas) {
          const areaRackIndex = a.racks.findIndex(rak => rak.id === rackId);
          if (areaRackIndex !== -1) { 
            a.racks.splice(areaRackIndex, 1); 
            return { 
              branches: newBranches, 
              selectedShapeId: state.selectedShapeId === rackId ? null : state.selectedShapeId,
              activeRackId: state.activeRackId === rackId ? null : state.activeRackId
            }; 
          }
        }
      }
    }
    return state;
  }),
  deleteArea: (areaId) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      for (const r of b.rooms) {
        const areaIndex = r.areas.findIndex(a => a.id === areaId);
        if (areaIndex !== -1) { r.areas.splice(areaIndex, 1); return { branches: newBranches, selectedShapeId: state.selectedShapeId === areaId ? null : state.selectedShapeId }; }
      }
    }
    return state;
  }),
  deleteRoom: (roomId) => set((state) => {
    const newBranches = [...state.branches];
    for (const b of newBranches) {
      const roomIndex = b.rooms.findIndex(r => r.id === roomId);
      if (roomIndex !== -1) { 
        b.rooms.splice(roomIndex, 1); 
        return { 
          branches: newBranches, 
          selectedShapeId: state.selectedShapeId === roomId ? null : state.selectedShapeId,
          activeRoomId: state.activeRoomId === roomId ? (b.rooms.length > 0 ? b.rooms[0].id : null) : state.activeRoomId
        }; 
      }
    }
    return state;
  }),
  syncStatus: 'idle',
  hasPendingLocalChanges: false,
  applyRemoteUpdate: (remoteBranches: Branch[], remoteArticles?: Article[]) => {
    const state = useStore.getState();
    if (state.hasPendingLocalChanges || state.syncStatus === 'saving') {
      console.log('⚡ [Realtime] Integrando cambios remotos recibidos vía WebSocket...');
      const baseline = baselineState || { branches: [], articles: [] };
      const mergedBranches = threeWayMerge(baseline.branches, remoteBranches, state.branches);
      let mergedArticles = state.articles;
      if (remoteArticles) {
        mergedArticles = threeWayMerge(baseline.articles, remoteArticles, state.articles);
      }
      set({ branches: mergedBranches, articles: mergedArticles });
    } else {
      console.log('⚡ [Realtime] Aplicando estado remoto actualizado vía WebSocket.');
      baselineState = JSON.parse(JSON.stringify({ 
        branches: remoteBranches, 
        articles: remoteArticles || state.articles 
      }));
      set({ 
        branches: remoteBranches, 
        articles: remoteArticles || state.articles 
      });
    }
  },
  saveToCloud: async () => {
    set({ syncStatus: 'saving' });
    try {
      const state = useStore.getState();
      
      let finalBranches = state.branches;
      let finalArticles = state.articles;

      if (supabase) {
        // Fetch current cloud state to do a smart 3-way merge!
        const { data, error: fetchError } = await supabase
          .from('layout_state')
          .select('state')
          .eq('id', 'default-layout')
          .single();
          
        if (!fetchError && data?.state) {
          const cloudState = data.state;
          const baseline = baselineState || { branches: [], articles: [] };
          
          finalBranches = threeWayMerge(baseline.branches, cloudState.branches || [], state.branches);
          finalArticles = threeWayMerge(baseline.articles, cloudState.articles || [], state.articles);
        }

        // Collect article IDs that are placed in any rack
        const placedArticleIds = new Set<string>();
        for (const b of finalBranches) {
          for (const r of b.rooms) {
            const scanRacks = [...r.racks, ...r.areas.flatMap(a => a.racks)];
            for (const rk of scanRacks) {
              for (const c of (rk.cells || [])) {
                if (c.articleId) placedArticleIds.add(c.articleId.trim().toUpperCase());
                for (const it of (c.items || [])) {
                  if (it.articleId) placedArticleIds.add(it.articleId.trim().toUpperCase());
                }
              }
            }
          }
        }

        // Only sync articles with actual stock, placements, or custom status to keep payload fast & light (<1MB)
        const articlesToSync = finalArticles.filter(a => {
          const upperId = a.id.trim().toUpperCase();
          const hasStock = a.stock && Object.keys(a.stock).some(k => (a.stock[k] || 0) !== 0);
          const isPlaced = placedArticleIds.has(upperId);
          const hasSpecialStatus = a.status && a.status !== 'ACTIVE';
          return hasStock || isPlaced || hasSpecialStatus;
        });

        const payload = {
          branches: finalBranches,
          articles: articlesToSync,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('layout_state')
          .upsert({ id: 'default-layout', state: payload });
          
        if (error) throw error;
        
        // Update baseline after successful save
        baselineState = JSON.parse(JSON.stringify({ branches: finalBranches, articles: finalArticles }));
        
        // Broadcast immediately over WebSockets to all other connected clients!
        broadcastLayoutUpdate(finalBranches, articlesToSync);

        // Also update local store with merged data in case there were cloud changes we integrated
        set({ 
          syncStatus: 'saved', 
          hasPendingLocalChanges: false, 
          branches: finalBranches, 
          articles: finalArticles 
        });
      } else {
        set({ syncStatus: 'error' });
      }
    } catch (e) {
      console.error(e);
      set({ syncStatus: 'error' });
    }
  },
  loadFromCloud: async () => {
    // PROTECT LOCAL CHANGES: Never overwrite if user has pending unsaved local edits
    const current = useStore.getState();
    if (current.hasPendingLocalChanges || current.syncStatus === 'saving') {
      console.log('⚡ [loadFromCloud] Protegiendo cambios locales pendientes, omitiendo sobreescritura.');
      return;
    }

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('layout_state')
          .select('state')
          .eq('id', 'default-layout')
          .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
        if (data && data.state) {
          const loadedBranches = data.state.branches || [];
          const loadedArticles: Article[] = data.state.articles || [];
          const currentArticles = useStore.getState().articles;
          
          let finalArticles = currentArticles;
          if (currentArticles.length === 0) {
            // If memory was empty, load the master catalog and merge cloud stock
            try {
              let res: Response | null = null;
              for (const p of ['/catalog.json', './catalog.json', 'catalog.json']) {
                try {
                  const r = await fetch(p);
                  if (r.ok) { res = r; break; }
                } catch { /* next */ }
              }
              if (res && res.ok) {
                const catalogData: Article[] = await res.json();
                const cloudMap = new Map(loadedArticles.map((a: Article) => [a.id.trim().toUpperCase(), a]));
                finalArticles = catalogData.map(art => {
                  const cloudItem = cloudMap.get(art.id.trim().toUpperCase());
                  if (cloudItem) {
                    return {
                      ...art,
                      stock: Object.keys(cloudItem.stock || {}).length > 0 ? cloudItem.stock : art.stock,
                      status: cloudItem.status || art.status,
                    };
                  }
                  return art;
                });
              } else {
                finalArticles = loadedArticles;
              }
            } catch {
              finalArticles = loadedArticles;
            }
          } else {
            const cloudMap = new Map(loadedArticles.map((a: Article) => [a.id.trim().toUpperCase(), a]));
            finalArticles = currentArticles.map(art => {
              const cloudItem = cloudMap.get(art.id.trim().toUpperCase());
              if (cloudItem) {
                return {
                  ...art,
                  stock: Object.keys(cloudItem.stock || {}).length > 0 ? cloudItem.stock : art.stock,
                  status: cloudItem.status || art.status,
                };
              }
              return art;
            });
          }
          
          baselineState = JSON.parse(JSON.stringify({ branches: loadedBranches, articles: finalArticles }));
          
          set({ 
            branches: loadedBranches,
            articles: finalArticles
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },
  loadCatalog: async () => {
    try {
      let res: Response | null = null;
      for (const p of ['/catalog.json', './catalog.json', 'catalog.json']) {
        try {
          const r = await fetch(p);
          if (r.ok) { res = r; break; }
        } catch { /* next */ }
      }
      if (res && res.ok) {
        const data: Article[] = await res.json();
        const current = useStore.getState().articles;
        if (current.length === 0) {
          set({ articles: data });
        } else {
          const currentMap = new Map(current.map(a => [a.id.trim().toUpperCase(), a]));
          const merged = data.map(item => {
            const existing = currentMap.get(item.id.trim().toUpperCase());
            if (existing) {
              return {
                ...item,
                stock: Object.keys(existing.stock || {}).length > 0 ? existing.stock : item.stock,
                status: existing.status || item.status,
                description: existing.description && existing.description !== '-' ? existing.description : item.description,
              };
            }
            return item;
          });
          const dataIds = new Set(data.map(d => d.id.trim().toUpperCase()));
          for (const curr of current) {
            if (!dataIds.has(curr.id.trim().toUpperCase())) {
              merged.push(curr);
            }
          }
          set({ articles: merged });
        }
      }

      // Also load default bundled layout if branches is just the empty mock
      const currentBranches = useStore.getState().branches;
      const isDefaultMock = currentBranches.length <= 1 && 
        (!currentBranches[0] || (currentBranches[0].id === 'b-1' && currentBranches[0].rooms?.[0]?.name === 'Nave Principal'));
      
      if (isDefaultMock) {
        let layoutRes: Response | null = null;
        for (const lp of ['/defaultLayout.json', './defaultLayout.json', 'defaultLayout.json']) {
          try {
            const lr = await fetch(lp);
            if (lr.ok) { layoutRes = lr; break; }
          } catch { /* next */ }
        }
        if (layoutRes && layoutRes.ok) {
          const layoutBranches = await layoutRes.json();
          if (Array.isArray(layoutBranches) && layoutBranches.length > 0) {
            set({ 
              branches: layoutBranches,
              activeBranchId: layoutBranches[0].id,
              activeRoomId: layoutBranches[0].rooms?.[0]?.id || null
            });
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar el catálogo predeterminado:', e);
    }
  }
  }),
  {
    name: 'wms-cad-storage',
    partialize: (state) => ({
      branches: state.branches,
      activeBranchId: state.activeBranchId,
      activeRoomId: state.activeRoomId,
      activeRackId: state.activeRackId,
      activeLevel: state.activeLevel,
      selectedShapeId: state.selectedShapeId,
      selectedShapeIds: state.selectedShapeIds,
      isEditMode: state.isEditMode,
      currentUserRole: state.currentUserRole,
      userBranchScope: state.userBranchScope,
      viewMode: state.viewMode,
    }),
  }
));
