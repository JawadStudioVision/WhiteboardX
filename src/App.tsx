import React, { useState, useCallback, useEffect } from 'react';
import { Tldraw, Editor, createShapeId } from '@tldraw/tldraw';
import { useBoardSync } from './useBoardSync';
import {
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Download,
  StickyNote,
  Layers,
  Bot,
  Lock,
  LogOut,
  User,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import '@tldraw/tldraw/tldraw.css';

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [boardId] = useState<string>('default');

  // Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('whiteboardx_token'));
  const [username, setUsername] = useState<string>(() => localStorage.getItem('whiteboardx_user') || 'admin');
  const [inputUser, setInputUser] = useState<string>('admin');
  const [inputPass, setInputPass] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const { status, notifications, setNotifications } = useBoardSync(editor, boardId, token);

  const handleMount = useCallback((appEditor: Editor) => {
    setEditor(appEditor);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputUser.trim(), password: inputPass.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('whiteboardx_token', data.token);
        localStorage.setItem('whiteboardx_user', inputUser.trim());
        setToken(data.token);
        setUsername(inputUser.trim());
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setAuthError('Failed to connect to server');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('whiteboardx_token');
    localStorage.removeItem('whiteboardx_user');
    setToken(null);
  };

  const handleCreateQuickNote = useCallback(() => {
    if (!editor) return;
    const center = editor.getViewportPageBounds().center;
    const id = createShapeId();
    editor.createShape({
      id,
      type: 'note',
      x: center.x - 100,
      y: center.y - 100,
      props: {
        color: 'yellow',
        size: 'm',
        text: 'New Idea ✨',
      },
    });
    editor.select(id);
  }, [editor]);

  const handleZoomToFit = useCallback(() => {
    if (!editor) return;
    editor.zoomToFit({ animation: { duration: 300 } });
  }, [editor]);

  const handleClearBoard = useCallback(async () => {
    if (!confirm('Are you sure you want to clear the canvas? Existing content will be archived.')) return;
    try {
      await fetch(`/api/tools/clear_board`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ boardId, archive: true }),
      });
      if (editor) {
        editor.selectAll();
        editor.deleteShapes(editor.getSelectedShapeIds());
      }
    } catch (err) {
      console.error('Failed to clear board:', err);
    }
  }, [editor, boardId, token]);

  const handleExportJson = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch snapshot');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboardx_${boardId}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export board JSON');
    }
  }, [boardId, token]);

  return (
    <div className="whiteboard-container">
      {/* Login Screen when unauthenticated */}
      {!token && (
        <div className="login-overlay">
          <div className="login-card">
            <div className="login-header">
              <span className="login-logo">🎨</span>
              <h2>WhiteboardX</h2>
              <p>Enter your username and password to access the whiteboard canvas.</p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              {authError && <div className="login-error">{authError}</div>}

              <div className="input-group">
                <label>
                  <User size={14} /> Username
                </label>
                <input
                  type="text"
                  value={inputUser}
                  onChange={(e) => setInputUser(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label>
                  <KeyRound size={14} /> Password
                </label>
                <input
                  type="password"
                  value={inputPass}
                  onChange={(e) => setInputPass(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoggingIn}>
                <span>{isLoggingIn ? 'Unlocking...' : 'Unlock Canvas'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="login-footer">
              <Lock size={12} />
              <span>Protected with secure session authentication</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Glass Navigation Header */}
      {token && (
        <header className="floating-header">
          <div className="header-left">
            <div className="brand-badge">
              <span className="brand-logo">🎨</span>
              <div className="brand-text">
                <span className="brand-title">WhiteboardX</span>
                <span className="brand-sub">Infinite AI Canvas</span>
              </div>
            </div>

            <div className={`status-pill ${status}`}>
              {status === 'connected' && <Wifi size={14} className="status-icon connected" />}
              {status === 'connecting' && <RefreshCw size={14} className="status-icon spinning" />}
              {status === 'disconnected' && <WifiOff size={14} className="status-icon disconnected" />}
              <span className="status-label">
                {status === 'connected' ? 'Live Synced' : status === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>

            <div className="ai-agent-pill" title="MCP Server is listening for AI Agent tools">
              <Bot size={14} className="ai-icon" />
              <span>MCP Agent Active</span>
              <span className="ai-pulse" />
            </div>
          </div>

          <div className="header-right">
            <button className="action-btn" onClick={handleCreateQuickNote} title="Create Sticky Note">
              <StickyNote size={15} />
              <span>Add Note</span>
            </button>

            <button className="action-btn" onClick={handleZoomToFit} title="Fit view to all shapes">
              <Layers size={15} />
              <span>Fit All</span>
            </button>

            <button className="action-btn" onClick={handleExportJson} title="Export Board Snapshot JSON">
              <Download size={15} />
              <span>Export</span>
            </button>

            <button className="action-btn danger" onClick={handleClearBoard} title="Clear and Archive Canvas">
              <Trash2 size={15} />
              <span>Clear</span>
            </button>

            <div className="user-profile-badge">
              <User size={13} />
              <span>{username}</span>
              <button className="logout-btn" onClick={handleLogout} title="Log Out">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* AI Activity Live Notifications Toast Stack */}
      <div className="notifications-container">
        {notifications.map((notif) => (
          <div key={notif.id} className="notification-toast">
            <div className="notif-header">
              <Sparkles size={14} className="notif-sparkle" />
              <span className="notif-sender">{notif.sender || 'AI Agent'}</span>
              <button
                className="notif-close"
                onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
              >
                &times;
              </button>
            </div>
            <div className="notif-body">{notif.message}</div>
          </div>
        ))}
      </div>

      {/* Full Screen TLDraw Canvas */}
      <div className="canvas-wrapper">
        <Tldraw onMount={handleMount} autoFocus />
      </div>
    </div>
  );
}

export default App;
