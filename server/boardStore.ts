import fs from 'node:fs';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import {
  BoardRecord,
  BoardSnapshot,
  CreateStickyNoteParams,
  CreateShapeParams,
  ConnectNodesParams,
  CreateFrameParams,
} from './types.js';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

export class BoardStore {
  private boardsDir: string;
  private currentBoardId: string = 'default';
  private snapshots: Map<string, BoardSnapshot> = new Map();
  private saveDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Set<(event: { boardId: string; updated: Record<string, BoardRecord>; removed: string[]; notification?: { level: 'info' | 'success' | 'warn'; message: string; sender?: string } }) => void> = new Set();

  constructor(boardsDir?: string) {
    this.boardsDir = boardsDir || path.resolve(process.cwd(), 'boards');
    if (!fs.existsSync(this.boardsDir)) {
      fs.mkdirSync(this.boardsDir, { recursive: true });
    }
  }

  public subscribe(fn: (event: { boardId: string; updated: Record<string, BoardRecord>; removed: string[]; notification?: { level: 'info' | 'success' | 'warn'; message: string; sender?: string } }) => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(boardId: string, updated: Record<string, BoardRecord>, removed: string[], notification?: { level: 'info' | 'success' | 'warn'; message: string; sender?: string }) {
    for (const sub of this.subscribers) {
      try {
        sub({ boardId, updated, removed, notification });
      } catch (err) {
        console.error('[BoardStore] Error notifying subscriber:', err);
      }
    }
  }

  public getBoardFilePath(boardId: string = 'default'): string {
    const safeId = boardId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.boardsDir, `${safeId}.json`);
  }

  public getBoardSnapshot(boardId: string = 'default'): BoardSnapshot {
    if (this.snapshots.has(boardId)) {
      return this.snapshots.get(boardId)!;
    }

    const filePath = this.getBoardFilePath(boardId);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && data.records) {
          this.snapshots.set(boardId, data);
          return data;
        }
      } catch (err) {
        console.error(`[BoardStore] Error reading board file ${filePath}, creating new board:`, err);
      }
    }

    // Initialize clean board
    const initialSnapshot: BoardSnapshot = {
      schemaVersion: 1,
      boardId,
      name: boardId === 'default' ? 'Main Whiteboard' : boardId,
      updatedAt: new Date().toISOString(),
      records: {},
    };

    this.snapshots.set(boardId, initialSnapshot);
    this.saveToDisk(boardId, initialSnapshot);
    return initialSnapshot;
  }

  public updateRecords(
    boardId: string,
    recordsToUpdate: Record<string, BoardRecord>,
    recordsToDelete: string[] = [],
    senderMessage?: string
  ) {
    const snapshot = this.getBoardSnapshot(boardId);

    const changedRecords: Record<string, BoardRecord> = {};
    for (const [id, rec] of Object.entries(recordsToUpdate)) {
      snapshot.records[id] = rec;
      changedRecords[id] = rec;
    }

    const removedIds: string[] = [];
    for (const id of recordsToDelete) {
      if (snapshot.records[id]) {
        delete snapshot.records[id];
        removedIds.push(id);
      }
    }

    snapshot.updatedAt = new Date().toISOString();
    this.scheduleSave(boardId);

    this.notify(
      boardId,
      changedRecords,
      removedIds,
      senderMessage ? { level: 'info', message: senderMessage, sender: 'AI Agent' } : undefined
    );
  }

  private scheduleSave(boardId: string) {
    if (this.saveDebounceTimers.has(boardId)) {
      clearTimeout(this.saveDebounceTimers.get(boardId)!);
    }

    const timer = setTimeout(() => {
      const snapshot = this.snapshots.get(boardId);
      if (snapshot) {
        this.saveToDisk(boardId, snapshot);
      }
      this.saveDebounceTimers.delete(boardId);
    }, 500);

    this.saveDebounceTimers.set(boardId, timer);
  }

  private saveToDisk(boardId: string, snapshot: BoardSnapshot) {
    try {
      const filePath = this.getBoardFilePath(boardId);
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[BoardStore] Failed to write board ${boardId} to disk:`, err);
    }
  }

  // --- High-level programmatic creation tools for MCP & UI ---

  private mapColor(color?: string): string {
    if (!color) return 'black';
    const c = color.toLowerCase();
    switch (c) {
      case 'yellow': return 'yellow';
      case 'blue': return 'blue';
      case 'green': return 'green';
      case 'pink': return 'light-violet';
      case 'violet':
      case 'purple': return 'violet';
      case 'red': return 'red';
      case 'orange': return 'orange';
      case 'grey':
      case 'gray': return 'grey';
      default: return 'black';
    }
  }

  private getNextIndex(snapshot: BoardSnapshot): string {
    const count = Object.keys(snapshot.records).length + 1;
    return `a${count}`;
  }

  public createStickyNote(params: CreateStickyNoteParams): { id: string; record: BoardRecord } {
    const boardId = params.boardId || 'default';
    const snapshot = this.getBoardSnapshot(boardId);
    const id = `shape:note_${nanoid()}`;

    const color = params.color === 'pink' ? 'light-violet' : this.mapColor(params.color || 'yellow');

    const record: BoardRecord = {
      id,
      typeName: 'shape',
      type: 'note',
      x: params.x ?? (Math.floor(Math.random() * 200) + 100),
      y: params.y ?? (Math.floor(Math.random() * 200) + 100),
      rotation: 0,
      index: this.getNextIndex(snapshot),
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      props: {
        color: color as any,
        size: params.size || 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        growY: 0,
        fontSizeAdjustment: 0,
        url: '',
        text: params.text,
      },
    };

    this.updateRecords(boardId, { [id]: record }, [], `Created sticky note: "${params.text.slice(0, 30)}..."`);
    return { id, record };
  }

  public createShape(params: CreateShapeParams): { id: string; record: BoardRecord } {
    const boardId = params.boardId || 'default';
    const snapshot = this.getBoardSnapshot(boardId);
    const id = `shape:geo_${nanoid()}`;

    const geoType = params.type || 'rectangle';
    const width = params.width || 200;
    const height = params.height || 120;

    const record: BoardRecord = {
      id,
      typeName: 'shape',
      type: 'geo',
      x: params.x ?? (Math.floor(Math.random() * 200) + 150),
      y: params.y ?? (Math.floor(Math.random() * 200) + 150),
      rotation: 0,
      index: this.getNextIndex(snapshot),
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      props: {
        geo: geoType,
        w: width,
        h: height,
        color: this.mapColor(params.color || 'blue'),
        fill: params.fill || 'semi',
        dash: 'draw',
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        growY: 0,
        url: '',
        text: params.label || '',
      },
    };

    this.updateRecords(boardId, { [id]: record }, [], `Created shape ${geoType}: "${params.label || ''}"`);
    return { id, record };
  }

  public connectNodes(params: ConnectNodesParams): { arrowId: string; startBindingId: string; endBindingId: string } {
    const boardId = params.boardId || 'default';
    const snapshot = this.getBoardSnapshot(boardId);

    let sourceRecord = snapshot.records[params.source_id];
    let targetRecord = snapshot.records[params.target_id];

    // Try finding by prefix if direct id wasn't prefixed with shape:
    if (!sourceRecord && !params.source_id.startsWith('shape:')) {
      sourceRecord = snapshot.records[`shape:${params.source_id}`];
      if (sourceRecord) params.source_id = `shape:${params.source_id}`;
    }
    if (!targetRecord && !params.target_id.startsWith('shape:')) {
      targetRecord = snapshot.records[`shape:${params.target_id}`];
      if (targetRecord) params.target_id = `shape:${params.target_id}`;
    }

    if (!sourceRecord) {
      throw new Error(`Source node '${params.source_id}' not found in board.`);
    }
    if (!targetRecord) {
      throw new Error(`Target node '${params.target_id}' not found in board.`);
    }

    const arrowId = `shape:arrow_${nanoid()}`;
    const startBindingId = `binding:${nanoid()}`;
    const endBindingId = `binding:${nanoid()}`;

    const srcX = (sourceRecord.x ?? 0) + ((sourceRecord.props?.w || 150) / 2);
    const srcY = (sourceRecord.y ?? 0) + ((sourceRecord.props?.h || 150) / 2);
    const tgtX = (targetRecord.x ?? 0) + ((targetRecord.props?.w || 150) / 2);
    const tgtY = (targetRecord.y ?? 0) + ((targetRecord.props?.h || 150) / 2);

    const arrowRecord: BoardRecord = {
      id: arrowId,
      typeName: 'shape',
      type: 'arrow',
      x: srcX,
      y: srcY,
      rotation: 0,
      index: this.getNextIndex(snapshot),
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      props: {
        kind: 'arrow',
        labelColor: 'black',
        color: this.mapColor(params.color || 'black'),
        fill: 'none',
        dash: 'draw',
        size: 'm',
        arrowheadStart: 'none',
        arrowheadEnd: params.arrowheadEnd || 'arrow',
        font: 'draw',
        start: { x: 0, y: 0 },
        end: { x: tgtX - srcX, y: tgtY - srcY },
        bend: 0,
        text: params.label || '',
        rawText: params.label || '',
      },
    };

    const startBinding: BoardRecord = {
      id: startBindingId,
      typeName: 'binding',
      type: 'arrow',
      fromId: arrowId,
      toId: params.source_id,
      props: {
        terminal: 'start',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    };

    const endBinding: BoardRecord = {
      id: endBindingId,
      typeName: 'binding',
      type: 'arrow',
      fromId: arrowId,
      toId: params.target_id,
      props: {
        terminal: 'end',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    };

    this.updateRecords(
      boardId,
      {
        [arrowId]: arrowRecord,
        [startBindingId]: startBinding,
        [endBindingId]: endBinding,
      },
      [],
      `Connected ${params.source_id} -> ${params.target_id}${params.label ? ` (${params.label})` : ''}`
    );

    return { arrowId, startBindingId, endBindingId };
  }

  public createFrame(params: CreateFrameParams): { id: string; record: BoardRecord } {
    const boardId = params.boardId || 'default';
    const snapshot = this.getBoardSnapshot(boardId);
    const id = `shape:frame_${nanoid()}`;

    const record: BoardRecord = {
      id,
      typeName: 'shape',
      type: 'frame',
      x: params.x,
      y: params.y,
      rotation: 0,
      index: 'a0', // frames generally go beneath items
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      props: {
        w: params.width,
        h: params.height,
        name: params.title,
      },
    };

    this.updateRecords(boardId, { [id]: record }, [], `Created frame: "${params.title}"`);
    return { id, record };
  }

  public clearBoard(boardId: string = 'default', archive: boolean = true): { message: string; count: number } {
    const snapshot = this.getBoardSnapshot(boardId);
    const recordIds = Object.keys(snapshot.records);
    const count = recordIds.length;

    if (archive && count > 0) {
      const archiveDir = path.join(this.boardsDir, 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = path.join(archiveDir, `${boardId}_${timestamp}.json`);
      fs.writeFileSync(archiveFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    }

    this.updateRecords(boardId, {}, recordIds, `Cleared board (archived ${count} items)`);
    return { message: `Cleared ${count} records from board ${boardId}`, count };
  }

  public getBoardSummary(boardId: string = 'default') {
    const snapshot = this.getBoardSnapshot(boardId);
    const records = snapshot.records;

    const shapes: Array<{
      id: string;
      type: string;
      label?: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      color?: string;
      connections?: { from?: string; to?: string };
    }> = [];

    const bindings = Object.values(records).filter((r) => r.typeName === 'binding');

    for (const [id, rec] of Object.entries(records)) {
      if (rec.typeName === 'shape') {
        const item: any = {
          id,
          type: rec.type,
          x: rec.x,
          y: rec.y,
          color: rec.props?.color,
        };

        if (rec.type === 'note' || rec.type === 'geo') {
          item.label = rec.props?.text;
          item.width = rec.props?.w;
          item.height = rec.props?.h;
        } else if (rec.type === 'frame') {
          item.label = rec.props?.name;
          item.width = rec.props?.w;
          item.height = rec.props?.h;
        } else if (rec.type === 'arrow') {
          item.label = rec.props?.text;
          const arrowBindings = bindings.filter((b) => b.fromId === id);
          const start = arrowBindings.find((b) => b.props?.terminal === 'start')?.toId;
          const end = arrowBindings.find((b) => b.props?.terminal === 'end')?.toId;
          item.connections = { from: start, to: end };
        }

        shapes.push(item);
      }
    }

    return {
      boardId,
      name: snapshot.name,
      updatedAt: snapshot.updatedAt,
      totalShapes: shapes.length,
      totalRecords: Object.keys(records).length,
      shapes,
    };
  }
}

// Global singleton instance for the running server process
export const boardStore = new BoardStore();
