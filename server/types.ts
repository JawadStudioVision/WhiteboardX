export interface BoardRecord {
  id: string;
  typeName: string;
  [key: string]: any;
}

export interface BoardSnapshot {
  schemaVersion: number;
  boardId: string;
  name: string;
  updatedAt: string;
  records: Record<string, BoardRecord>;
}

export type WebSocketClientMessage =
  | { type: 'auth'; token: string; boardId?: string; clientId?: string }
  | { type: 'join'; boardId?: string; clientId?: string }
  | { type: 'sync_records'; boardId: string; records: Record<string, BoardRecord>; clientId?: string }
  | { type: 'delete_records'; boardId: string; recordIds: string[]; clientId?: string }
  | { type: 'ping' };

export type WebSocketServerMessage =
  | { type: 'init'; boardId: string; snapshot: BoardSnapshot }
  | { type: 'patch'; boardId: string; updated: Record<string, BoardRecord>; removed: string[]; senderClientId?: string }
  | { type: 'notification'; level: 'info' | 'success' | 'warn'; message: string; sender?: string }
  | { type: 'pong' };

export interface CreateStickyNoteParams {
  boardId?: string;
  text: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'red' | 'violet' | 'orange' | 'grey' | 'black';
  x?: number;
  y?: number;
  size?: 's' | 'm' | 'l' | 'xl';
}

export interface CreateShapeParams {
  boardId?: string;
  type?: 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'cloud' | 'star' | 'hexagon' | 'oval';
  label?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  color?: 'black' | 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'orange' | 'grey';
  fill?: 'none' | 'semi' | 'solid' | 'pattern';
}

export interface ConnectNodesParams {
  boardId?: string;
  source_id: string;
  target_id: string;
  label?: string;
  color?: 'black' | 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'orange' | 'grey';
  arrowheadEnd?: 'arrow' | 'triangle' | 'square' | 'dot' | 'diamond' | 'none';
}

export interface CreateFrameParams {
  boardId?: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
