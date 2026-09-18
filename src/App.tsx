import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Lock,
  LogOut,
  User,
  KeyRound,
  ArrowRight,
  MousePointer,
  Hand,
  Pencil,
  Eraser,
  Type,
  Square,
  Circle,
  ArrowUpRight,
  Image as ImageIcon,
  Palette,
} from 'lucide-react';
import '@tldraw/tldraw/tldraw.css';

type CanvasTool = 'select' | 'hand' | 'draw' | 'eraser' | 'text' | 'note' | 'rectangle' | 'ellipse' | 'arrow';

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [boardId] = useState<string>('default');
  const [currentTool, setCurrentTool] = useState<CanvasTool>('select');
  const [selectedColor, setSelectedColor] = useState<string>('black');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('whiteboardx_token'));
  const [username, setUsername] = useState<string>(() => localStorage.getItem('whiteboardx_user') || '');
  const [inputUser, setInputUser] = useState<string>('');
  const [inputPass, setInputPass] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const { status, notifications, setNotifications } = useBoardSync(editor, boardId, token);

  const handleMount = useCallback((appEditor: Editor) => {
    setEditor(appEditor);
  }, []);

  // Update active tool state from editor
  useEffect(() => {
    if (!editor) return;
    const updateTool = () => {
      const toolId = editor.getCurrentToolId();
      if (['select', 'hand', 'draw', 'eraser', 'text', 'note', 'arrow'].includes(toolId)) {
        setCurrentTool(toolId as CanvasTool);
      }
    };
    const unlisten = editor.store.listen(updateTool);
    return () => unlisten();
  }, [editor]);

  const selectTool = (tool: CanvasTool) => {
    if (!editor) return;
    setCurrentTool(tool);

    if (tool === 'rectangle') {
      editor.setCurrentTool('geo');
      editor.updateInstanceState({ isReadonly: false });
    } else if (tool === 'ellipse') {
      editor.setCurrentTool('geo');
    } else {
      editor.setCurrentTool(tool);
    }
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (!editor) return;
    // Set style for current tool or selection
    editor.setStyleForSelectedShapes({ id: 'color', type: 'color' } as any, color as any);
    editor.setStyleForNextShapes({ id: 'color', type: 'color' } as any, color as any);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const center = editor.getViewportPageBounds().center;
      const img = new Image();
      img.onload = () => {
        const id = createShapeId();
        const maxW = 400;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = img.width * scale;
        const h = img.height * scale;

        editor.createShape({
          id,
          type: 'image',
          x: center.x - w / 2,
          y: center.y - h / 2,
          props: {
            w,
            h,
            src: dataUrl,
          },
        });
        editor.select(id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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
    setInputUser('');
    setInputPass('');
  };

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

  const colors = [
    { name: 'black', hex: '#1e293b' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'green', hex: '#10b981' },
    { name: 'yellow', hex: '#f59e0b' },
    { name: 'red', hex: '#ef4444' },
    { name: 'violet', hex: '#8b5cf6' },
    { name: 'orange', hex: '#f97316' },
  ];

  return (
    <div className="whiteboard-container">
      {/* Hidden File Input for Picture Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Login Screen when unauthenticated */}
      {!token && (
        <div className="login-overlay">
          <div className="login-card">
            <div className="login-header">
              <span className="login-logo">🎨</span>
              <h2>WhiteboardX</h2>
              <p>Enter your username and password to access the canvas.</p>
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
                  placeholder="Enter username"
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
                  placeholder="Enter password"
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

      {/* Compact Floating Glass Header (Top Right) */}
      {token && (
        <header className="floating-header">
          <div className="brand-badge">
            <span className="brand-logo">🎨</span>
            <span className="brand-title">WhiteboardX</span>
          </div>

          <div className={`status-pill ${status}`}>
            {status === 'connected' && <Wifi size={12} className="status-icon connected" />}
            {status === 'connecting' && <RefreshCw size={12} className="status-icon spinning" />}
            {status === 'disconnected' && <WifiOff size={12} className="status-icon disconnected" />}
            <span className="status-label">
              {status === 'connected' ? 'Synced' : status === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>

          <div className="header-actions-desktop">
            <button className="action-btn" onClick={handleZoomToFit} title="Fit view to all shapes">
              <Layers size={13} />
              <span>Fit All</span>
            </button>

            <button className="action-btn" onClick={handleExportJson} title="Export Board Snapshot JSON">
              <Download size={13} />
              <span>Export</span>
            </button>

            <button className="action-btn danger" onClick={handleClearBoard} title="Clear and Archive Canvas">
              <Trash2 size={13} />
              <span>Clear</span>
            </button>

            <div className="user-profile-badge">
              <User size={11} />
              <span>{username || 'User'}</span>
              <button className="logout-btn" onClick={handleLogout} title="Log Out">
                <LogOut size={11} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Prominent Always-Visible Primary Toolbar (Bottom Center) */}
      {token && (
        <nav className="primary-tools-bar">
          <div className="tools-group">
            <button
              className={`tool-btn ${currentTool === 'select' ? 'active' : ''}`}
              onClick={() => selectTool('select')}
              title="Select / Move (V)"
            >
              <MousePointer size={18} />
              <span className="tool-tooltip">Select</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'hand' ? 'active' : ''}`}
              onClick={() => selectTool('hand')}
              title="Hand / Pan Canvas (H)"
            >
              <Hand size={18} />
              <span className="tool-tooltip">Hand</span>
            </button>
          </div>

          <div className="tools-divider" />

          <div className="tools-group">
            <button
              className={`tool-btn ${currentTool === 'draw' ? 'active' : ''}`}
              onClick={() => selectTool('draw')}
              title="Pen / Freehand Draw (D)"
            >
              <Pencil size={18} />
              <span className="tool-tooltip">Pen</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
              onClick={() => selectTool('eraser')}
              title="Eraser (E)"
            >
              <Eraser size={18} />
              <span className="tool-tooltip">Eraser</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`}
              onClick={() => selectTool('text')}
              title="Text Box (T)"
            >
              <Type size={18} />
              <span className="tool-tooltip">Text</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'note' ? 'active' : ''}`}
              onClick={() => selectTool('note')}
              title="Sticky Note (N)"
            >
              <StickyNote size={18} />
              <span className="tool-tooltip">Note</span>
            </button>
          </div>

          <div className="tools-divider" />

          <div className="tools-group">
            <button
              className={`tool-btn ${currentTool === 'rectangle' ? 'active' : ''}`}
              onClick={() => selectTool('rectangle')}
              title="Rectangle (R)"
            >
              <Square size={18} />
              <span className="tool-tooltip">Rectangle</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'ellipse' ? 'active' : ''}`}
              onClick={() => selectTool('ellipse')}
              title="Circle (O)"
            >
              <Circle size={18} />
              <span className="tool-tooltip">Circle</span>
            </button>

            <button
              className={`tool-btn ${currentTool === 'arrow' ? 'active' : ''}`}
              onClick={() => selectTool('arrow')}
              title="Arrow Connector (A)"
            >
              <ArrowUpRight size={18} />
              <span className="tool-tooltip">Arrow</span>
            </button>

            <button
              className="tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Image / Picture"
            >
              <ImageIcon size={18} />
              <span className="tool-tooltip">Image</span>
            </button>
          </div>

          <div className="tools-divider" />

          {/* Quick Color Swatches */}
          <div className="color-swatches-group">
            {colors.map((c) => (
              <button
                key={c.name}
                className={`color-dot ${selectedColor === c.name ? 'selected' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => handleColorChange(c.name)}
                title={`Color: ${c.name}`}
              />
            ))}
          </div>
        </nav>
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
