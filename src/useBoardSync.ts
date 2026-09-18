import { useEffect, useRef, useState } from 'react';
import { Editor, TLRecord } from '@tldraw/tldraw';

export interface SyncNotification {
  id: string;
  level: 'info' | 'success' | 'warn';
  message: string;
  sender?: string;
  timestamp: number;
}

function getOrCreateClientId(): string {
  let id = sessionStorage.getItem('whiteboardx_client_id');
  if (!id) {
    id = `client_${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem('whiteboardx_client_id', id);
  }
  return id;
}

export function useBoardSync(editor: Editor | null, boardId: string = 'default', token: string | null = null) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const isApplyingRemoteChange = useRef(false);
  const clientId = useRef<string>(getOrCreateClientId());

  // Debounce sync queue for ultra-smooth 120fps local drawing and fast typing
  const pendingRecordsRef = useRef<Record<string, any>>({});
  const pendingDeletesRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<any>(null);

  const flushSyncQueue = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const records = { ...pendingRecordsRef.current };
    const deleteIds = Array.from(pendingDeletesRef.current);

    pendingRecordsRef.current = {};
    pendingDeletesRef.current.clear();
    syncTimeoutRef.current = null;

    if (Object.keys(records).length > 0) {
      wsRef.current.send(
        JSON.stringify({
          type: 'sync_records',
          boardId,
          clientId: clientId.current,
          records,
        })
      );
    }

    if (deleteIds.length > 0) {
      wsRef.current.send(
        JSON.stringify({
          type: 'delete_records',
          boardId,
          clientId: clientId.current,
          recordIds: deleteIds,
        })
      );
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    let isMounted = true;
    let reconnectTimer: any = null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? `${window.location.hostname}:4876` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId.current)}`;

    function connect() {
      setStatus('connecting');
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('[WhiteboardX Sync] WebSocket connected with clientId:', clientId.current);
          setStatus('connected');
          ws.send(JSON.stringify({ type: 'auth', token, boardId, clientId: clientId.current }));
        };

        ws.onmessage = (event) => {
          if (!isMounted || !editor) return;
          try {
            const data = JSON.parse(event.data);

            // Ignore our own echoed patches
            if (data.senderClientId && data.senderClientId === clientId.current) {
              return;
            }

            if (data.type === 'init' && data.snapshot?.records) {
              isApplyingRemoteChange.current = true;
              try {
                const records = Object.values(data.snapshot.records) as TLRecord[];
                if (records.length > 0) {
                  editor.store.mergeRemoteChanges(() => {
                    editor.store.put(records);
                  });
                }
              } finally {
                setTimeout(() => {
                  isApplyingRemoteChange.current = false;
                }, 50);
              }
            } else if (data.type === 'patch') {
              isApplyingRemoteChange.current = true;
              try {
                const updatedRecords = Object.values(data.updated || {}) as TLRecord[];
                const removedIds = (data.removed || []) as any[];

                editor.store.mergeRemoteChanges(() => {
                  if (updatedRecords.length > 0) {
                    editor.store.put(updatedRecords);
                  }
                  if (removedIds.length > 0) {
                    editor.store.remove(removedIds);
                  }
                });
              } finally {
                setTimeout(() => {
                  isApplyingRemoteChange.current = false;
                }, 50);
              }
            } else if (data.type === 'notification') {
              const newNotif: SyncNotification = {
                id: Math.random().toString(),
                level: data.level || 'info',
                message: data.message,
                sender: data.sender || 'AI Agent',
                timestamp: Date.now(),
              };
              setNotifications((prev) => [newNotif, ...prev].slice(0, 5));
            }
          } catch (err) {
            console.error('[WhiteboardX Sync] Error processing WS message:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setStatus('disconnected');
          reconnectTimer = setTimeout(connect, 2000);
        };

        ws.onerror = (err) => {
          console.warn('[WhiteboardX Sync] WebSocket connection error:', err);
          ws.close();
        };
      } catch (err) {
        console.error('[WhiteboardX Sync] Failed to create WebSocket:', err);
        setStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [editor, boardId, token]);

  // Listen to local TLDraw store changes with throttled batching
  useEffect(() => {
    if (!editor || !token) return;

    const cleanup = editor.store.listen(
      (history) => {
        if (isApplyingRemoteChange.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const { added, updated, removed } = history.changes;

        for (const [id, record] of Object.entries(added)) {
          if (['shape', 'binding', 'asset'].includes(record.typeName)) {
            pendingRecordsRef.current[id] = record;
            pendingDeletesRef.current.delete(id);
          }
        }
        for (const [id, [, to]] of Object.entries(updated)) {
          if (to && ['shape', 'binding', 'asset'].includes(to.typeName)) {
            pendingRecordsRef.current[id] = to;
            pendingDeletesRef.current.delete(id);
          }
        }
        for (const [id, record] of Object.entries(removed)) {
          if (['shape', 'binding', 'asset'].includes(record.typeName)) {
            delete pendingRecordsRef.current[id];
            pendingDeletesRef.current.add(id);
          }
        }

        // Debounce network dispatch to 80ms to keep local drawing and typing 100% fluid
        if (!syncTimeoutRef.current) {
          syncTimeoutRef.current = setTimeout(flushSyncQueue, 80);
        }
      },
      { scope: 'document', source: 'user' }
    );

    return () => {
      cleanup();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        flushSyncQueue();
      }
    };
  }, [editor, boardId, token]);

  return { status, notifications, setNotifications };
}
