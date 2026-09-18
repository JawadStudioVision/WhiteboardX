import { useEffect, useRef, useState } from 'react';
import { Editor, TLRecord } from '@tldraw/tldraw';

export interface SyncNotification {
  id: string;
  level: 'info' | 'success' | 'warn';
  message: string;
  sender?: string;
  timestamp: number;
}

export function useBoardSync(editor: Editor | null, boardId: string = 'default', token: string | null = null) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const isApplyingRemoteChange = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    let isMounted = true;
    let reconnectTimer: any = null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? `${window.location.hostname}:4876` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    function connect() {
      setStatus('connecting');
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('[WhiteboardX Sync] WebSocket connected');
          setStatus('connected');
          ws.send(JSON.stringify({ type: 'auth', token, boardId }));
        };

        ws.onmessage = (event) => {
          if (!isMounted || !editor) return;
          try {
            const data = JSON.parse(event.data);

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
      if (wsRef.current) wsRef.current.close();
    };
  }, [editor, boardId, token]);

  // Listen to local TLDraw store changes and sync them to server
  useEffect(() => {
    if (!editor || !token) return;

    const cleanup = editor.store.listen(
      (history) => {
        if (isApplyingRemoteChange.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const { added, updated, removed } = history.changes;

        const recordsToSync: Record<string, any> = {};
        for (const [id, record] of Object.entries(added)) {
          if (['shape', 'binding', 'asset'].includes(record.typeName)) {
            recordsToSync[id] = record;
          }
        }
        for (const [id, [, to]] of Object.entries(updated)) {
          if (to && ['shape', 'binding', 'asset'].includes(to.typeName)) {
            recordsToSync[id] = to;
          }
        }

        const recordsToDelete: string[] = [];
        for (const [id, record] of Object.entries(removed)) {
          if (['shape', 'binding', 'asset'].includes(record.typeName)) {
            recordsToDelete.push(id);
          }
        }

        if (Object.keys(recordsToSync).length > 0) {
          wsRef.current.send(
            JSON.stringify({
              type: 'sync_records',
              boardId,
              records: recordsToSync,
            })
          );
        }

        if (recordsToDelete.length > 0) {
          wsRef.current.send(
            JSON.stringify({
              type: 'delete_records',
              boardId,
              recordIds: recordsToDelete,
            })
          );
        }
      },
      { scope: 'document', source: 'user' }
    );

    return () => {
      cleanup();
    };
  }, [editor, boardId, token]);

  return { status, notifications, setNotifications };
}
