import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import { boardStore } from './boardStore.js';
import { WebSocketClientMessage, WebSocketServerMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '4876', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Configurable authentication credentials
const AUTH_USER = process.env.ADMIN_USER || 'admin';
const AUTH_PASSWORD = process.env.ADMIN_PASSWORD || 'whiteboard2026';

// Simple in-memory valid token set (can also generate persistent session tokens)
const validTokens = new Set<string>();
const MASTER_TOKEN = Buffer.from(`${AUTH_USER}:${AUTH_PASSWORD}`).toString('base64');
validTokens.add(MASTER_TOKEN);

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === AUTH_USER && password === AUTH_PASSWORD) {
    const token = MASTER_TOKEN;
    validTokens.add(token);
    return res.json({ success: true, token, user: { username } });
  }
  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

// Verify token endpoint
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || (req.query.token as string);
  if (token && validTokens.has(token)) {
    return res.json({ success: true, username: AUTH_USER });
  }
  return res.status(401).json({ success: false, error: 'Unauthorized' });
});

// Auth protection middleware for API routes
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || (req.query.token as string);
  if (token && validTokens.has(token)) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
};

// Health endpoint (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WhiteboardX',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Protected board snapshot / summary
app.get('/api/boards/:id', requireAuth, (req, res) => {
  const boardId = (req.params.id as string) || 'default';
  const snapshot = boardStore.getBoardSnapshot(boardId);
  res.json(snapshot);
});

app.get('/api/boards/:id/summary', requireAuth, (req, res) => {
  const boardId = (req.params.id as string) || 'default';
  const summary = boardStore.getBoardSummary(boardId);
  res.json(summary);
});

// Protected REST endpoint for agent tool execution
app.post('/api/tools/:toolName', requireAuth, (req, res) => {
  const toolName = req.params.toolName as string;
  const params = req.body || {};

  try {
    switch (toolName) {
      case 'get_board_state': {
        const summary = boardStore.getBoardSummary(params.boardId || 'default');
        return res.json({ success: true, result: summary });
      }
      case 'create_sticky_note': {
        const result = boardStore.createStickyNote(params);
        return res.json({ success: true, result });
      }
      case 'create_shape': {
        const result = boardStore.createShape(params);
        return res.json({ success: true, result });
      }
      case 'connect_nodes': {
        const result = boardStore.connectNodes(params);
        return res.json({ success: true, result });
      }
      case 'create_frame': {
        const result = boardStore.createFrame(params);
        return res.json({ success: true, result });
      }
      case 'clear_board': {
        const result = boardStore.clearBoard(params.boardId || 'default', params.archive ?? true);
        return res.json({ success: true, result });
      }
      default:
        return res.status(404).json({ success: false, error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`[Server] Error executing tool ${toolName}:`, err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// Serve frontend static files
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head><title>WhiteboardX Server</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;">
          <h1>🎨 WhiteboardX API & WebSocket Server Running</h1>
          <p>Web server active on port ${PORT}.</p>
        </body>
      </html>
    `);
  });
}

const server = http.createServer(app);

// WebSocket Server for real-time collaboration & AI sync
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientSession {
  ws: WebSocket;
  boardId: string;
  authenticated: boolean;
}

const clients: Set<ClientSession> = new Set();

wss.on('connection', (ws: WebSocket, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token') || '';
  const isAuthenticated = token ? validTokens.has(token) : false;

  const session: ClientSession = { ws, boardId: 'default', authenticated: isAuthenticated };
  clients.add(session);

  if (session.authenticated) {
    // Send initial board snapshot
    const initialSnapshot = boardStore.getBoardSnapshot(session.boardId);
    const initMsg: WebSocketServerMessage = {
      type: 'init',
      boardId: session.boardId,
      snapshot: initialSnapshot,
    };
    ws.send(JSON.stringify(initMsg));
  }

  ws.on('message', (data: string) => {
    try {
      const msg: any = JSON.parse(data.toString());

      if (msg.type === 'auth') {
        if (msg.token && validTokens.has(msg.token)) {
          session.authenticated = true;
          session.boardId = msg.boardId || 'default';
          const snap = boardStore.getBoardSnapshot(session.boardId);
          ws.send(JSON.stringify({ type: 'init', boardId: session.boardId, snapshot: snap }));
        } else {
          ws.send(JSON.stringify({ type: 'notification', level: 'warn', message: 'Authentication required' }));
        }
        return;
      }

      if (!session.authenticated) {
        ws.send(JSON.stringify({ type: 'notification', level: 'warn', message: 'Authentication required' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'join' && msg.boardId) {
        session.boardId = msg.boardId;
        const snap = boardStore.getBoardSnapshot(session.boardId);
        ws.send(JSON.stringify({ type: 'init', boardId: session.boardId, snapshot: snap }));
        return;
      }

      if (msg.type === 'sync_records' && msg.records) {
        boardStore.updateRecords(msg.boardId || session.boardId, msg.records, []);
      }

      if (msg.type === 'delete_records' && msg.recordIds) {
        boardStore.updateRecords(msg.boardId || session.boardId, {}, msg.recordIds);
      }
    } catch (err) {
      console.error('[WebSocket] Error handling message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(session);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Client socket error:', err);
    clients.delete(session);
  });
});

// Subscribe to board store mutations
boardStore.subscribe(({ boardId, updated, removed, notification }) => {
  const patchMsg: WebSocketServerMessage = {
    type: 'patch',
    boardId,
    updated,
    removed,
  };
  const patchPayload = JSON.stringify(patchMsg);

  for (const client of clients) {
    if (client.authenticated && client.boardId === boardId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(patchPayload);

      if (notification) {
        const notifMsg: WebSocketServerMessage = {
          type: 'notification',
          level: notification.level,
          message: notification.message,
          sender: notification.sender,
        };
        client.ws.send(JSON.stringify(notifMsg));
      }
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🎨 WhiteboardX Server running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  console.log(`🔐 Authentication Enabled: User '${AUTH_USER}'`);
  console.log(`💾 Persistent local storage: ${boardStore.getBoardFilePath('default')}`);
  console.log(`======================================================\n`);
});

export { app, server };
