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

export interface CellItem {
  id: string;
  articleId: string;
  quantity: number;
}

export interface Cell {
  id: string;
  row: number;
  col: number;
  articleId: string | null; // Keep for backward compatibility or simple mode
  quantity: number;
  items?: CellItem[]; // For multiple subdivisions
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
  level?: number; // 0 = PB, 1 = PA, etc
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

export type UserRole = 'ALMACEN' | 'VENTAS' | null;

export interface LayoutState {
  branches: Branch[];
  activeBranchId: string | null;
  activeRoomId: string | null;
  activeRackId: string | null;
  activeLevel: number;
  selectedShapeId: string | null;
  articles: Article[];
  searchQuery: string;
  isEditMode: boolean;
  currentUserRole: UserRole;
}

export interface InventoryRecord {
  id: string; // CLAVE
  description: string;
  provider: string; // Extracted provider
  initialStock: number;
  entries: number;
  exits: number;
  theoreticalStock: number;
  physicalStock: number | null; // Null if not registered yet
  leadTimeDays: number; // Capturado por el usuario
  maxStock: number;
  minStock: number;
  reorderPoint: number;
  safetyStock: number;
  rotation: number;
  unitCost: number;
  abcCategory: 'A' | 'B' | 'C' | null;
}

export interface RawDataRow {
  Clave?: string;
  Codigo?: string;
  ID?: string;
  Descripción?: string;
  Descripcion?: string;
  Cantidad?: number;
  Existencia?: number;
  Costo?: number;
  Precio?: number;
}

export interface ProviderConstraint {
  minVolume: number;
  minCost: number;
}

export interface CartItem {
  id: string;
  provider: string;
  description: string;
  quantityToOrder: number;
  unitCost: number;
}
