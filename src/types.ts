export type MaterialStatus = 'ACTIVE' | 'SLOW' | 'DAMAGED' | 'OFFLINE' | 'SCRAP';

export interface Article {
  id: string; // CLAVE
  status: MaterialStatus; // Derived from rules or user input
  description: string;
  provider?: string;
  category?: string;
  materialType?: string;
  stock: Record<string, number>; // BranchName -> stock amount
  lastRevision?: string;
}

export interface Cell {
  id: string;
  row: number;
  col: number;
  articleId: string | null;
  quantity: number;
}

export interface Rack {
  id: string;
  name: string; // e.g. "RACK-01"
  x: number;
  y: number;
  rotation: number;
  width: number; // Width of rack (e.g. 200cm)
  depth: number; // Depth of rack (e.g. 60cm)
  height: number; // Total height
  rows: number;
  cols: number;
  color?: string; // Optional custom color
  isLocked?: boolean;
  cells: Cell[];
}

export interface Area {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isLocked?: boolean;
  racks: Rack[];
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  isLocked?: boolean;
  areas: Area[];
  racks: Rack[]; // Racks not in specific areas but in the room
}

export interface Branch {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: Room[];
}

export interface LayoutState {
  branches: Branch[];
  activeBranchId: string | null;
  activeRoomId: string | null;
  activeRackId: string | null;
  selectedShapeId: string | null;
  articles: Article[];
  searchQuery: string;
  isEditMode: boolean;
}
