import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Branch, Article, LayoutState, Rack, Room, Area } from '../types';
import { supabase } from '../lib/supabase';

interface WMSStore extends LayoutState {
  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branchId: string | null) => void;
  setActiveRoom: (roomId: string | null) => void;
  setActiveRack: (rackId: string | null) => void;
  setActiveLevel: (level: number) => void;
  setArticles: (articles: Article[]) => void;
  setSelectedShapeId: (id: string | null) => void;
  updateRackProperties: (rackId: string, updates: Partial<Rack>) => void;
  updateRackPosition: (branchId: string, roomId: string, areaId: string | null, rackId: string, x: number, y: number, rotation: number) => void;
  addRack: (branchId: string, roomId: string) => void;
  addRoom: (branchId: string) => void;
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
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  searchQuery: string;
  setCurrentUserRole: (role: import('../types').UserRole) => void;
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


export const useStore = create<WMSStore>()(
  persist(
    (set) => ({
      branches: [mockBranch],
  activeBranchId: 'b-1',
  activeRoomId: 'r-1',
  activeRackId: null,
  activeLevel: 0,
  selectedShapeId: null,
  articles: [],
  searchQuery: '',
  isEditMode: true,
  currentUserRole: null,
  viewMode: 'DEFAULT',
  setViewMode: (viewMode: import('../types').ViewMode) => set({ viewMode }),
  setCurrentUserRole: (role) => set({ currentUserRole: role }),
  setIsEditMode: (isEditMode) => set({ isEditMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setBranches: (branches) => set({ branches }),
  setActiveBranch: (activeBranchId) => set({ activeBranchId }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),
  setActiveRack: (activeRackId) => set({ activeRackId }),
  setActiveLevel: (activeLevel) => set({ activeLevel }),
  setSelectedShapeId: (selectedShapeId) => set({ selectedShapeId }),
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
  addRoom: (branchId) => set((state) => {
    const newBranches = [...state.branches];
    const branch = newBranches.find(b => b.id === branchId);
    if (branch) {
      const newRoom: Room = {
        id: `r-${Date.now()}`,
        name: `Habitación ${branch.rooms.length + 1}`,
        x: 50, y: 50, width: 800, height: 600,
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
  saveToCloud: async () => {
    set({ syncStatus: 'saving' });
    try {
      const state = useStore.getState();
      const payload = {
        branches: state.branches,
        articles: state.articles,
        updated_at: new Date().toISOString()
      };
      if (supabase) {
        const { error } = await supabase
          .from('layout_state')
          .upsert({ id: 'default-layout', state: payload });
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
  loadFromCloud: async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('layout_state')
          .select('state')
          .eq('id', 'default-layout')
          .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
        if (data && data.state) {
          set({ 
            branches: data.state.branches || [],
            articles: data.state.articles || []
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  }),
  {
    name: 'wms-cad-storage',
  }
));
