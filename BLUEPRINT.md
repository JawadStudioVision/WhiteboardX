# 📐 WhiteboardX Complete System Blueprint & Architectural Specification

> **Project Name**: WhiteboardX  
> **Domain**: `w.studiovision.org`  
> **Primary Domain**: `studiovision.org`  
> **GitHub Repository**: [https://github.com/JawadStudioVision/WhiteboardX](https://github.com/JawadStudioVision/WhiteboardX)  
> **Local Port**: `4876` (`http://localhost:4876`)  
> **Local Storage**: `./boards/<boardId>.json`  

---

## 1. System Architecture Overview

```mermaid
flowchart TD
    UserBrowser["Browser Client (Desktop / Mobile)<br/>https://w.studiovision.org"] <--> |WSS /ws (Session Tagged)| CFTunnel["Cloudflare Tunnel (w.studiovision.org)"]
    CFTunnel <--> |HTTP/WS (0.0.0.0:4876)| NodeServer["Express + WebSocket Server (server/server.ts)"]
    
    AIAgent["AI Agent (Antigravity / Claude)"] <--> |MCP stdio Protocol| MCPServer["MCP Server (server/mcpServer.ts)"]
    MCPServer <--> |Internal IPC / REST API| NodeServer

    NodeServer <--> |Read / Debounced Write| DiskStorage[("Disk JSON Storage<br/>./boards/default.json")]
```

---

## 2. Core Components & Responsibilities

### A. Frontend Canvas Layer (`src/`)
- **Engine**: `@tldraw/tldraw` (v3.9.1) React infinite canvas component.
- **Viewport Engine**: Responsive layout utilizing `100dvh` (Dynamic Viewport Height) and `safe-area-inset` support for mobile browsers (Samsung Internet / Chrome / Safari).
- **Header**: Minimalist glassmorphic top-right status pill displaying sync state (`Synced` / `Connecting` / `Offline`), Zoom to Fit, Export, Clear, and User Profile controls.
- **Authentication**: Session token stored in `localStorage` with a login overlay.

### B. Synchronization & Echo Suppression Engine (`src/useBoardSync.ts`)
- **Session Identification (`clientId`)**: Unique ID generated per browser window (`client_<random>`).
- **Debounced Batching (80ms)**: Batches continuous pointer movements (60–120 FPS) into background WebSocket updates, ensuring native 120 FPS drawing and rapid keystrokes without main-thread blocking.
- **Echo Suppression**: Server suppresses broadcasting mutations back to the client that originated them, eliminating line-cutting and interrupted keystrokes.

### C. Persistent Storage Engine (`server/boardStore.ts`)
- **Format**: TLDraw compatible record collections (shapes, bindings, assets) serialized to `./boards/<boardId>.json`.
- **Debounced Disk I/O (500ms)**: Batches frequent in-memory mutations before writing to disk, protecting storage lifespan.
- **Archive System**: When boards are cleared, snapshots are archived with ISO timestamps to `./boards/archive/`.

### D. Model Context Protocol (MCP) Server (`server/mcpServer.ts`)
Implements `@modelcontextprotocol/sdk` over `stdio` transport, exposing 6 programmatic tools for AI agents:
1. `get_board_state`: Inspects all shapes, labels, positions, and connections.
2. `create_sticky_note`: Creates sticky notes with text, color, coordinates.
3. `create_shape`: Creates geometric shapes (`rectangle`, `ellipse`, `diamond`, `triangle`, `cloud`, etc.).
4. `connect_nodes`: Creates directional connector arrows magnetically bound between source and target shapes.
5. `create_frame`: Creates bounding box workflow clusters.
6. `clear_board`: Archives and resets the canvas.

### E. Remote Access Layer (`cloudflare/`)
- **Tunnel Name**: `whiteboardx`
- **Tunnel UUID**: `58a8b409-2623-49dd-8866-b3ee34a60066`
- **Config**: `cloudflare/config.yml` routing `w.studiovision.org` $\to$ `http://localhost:4876`.
- **Traffic Compression**: Express `compression()` middleware serving gzipped assets with 1-year immutable caching.

---

## 3. Directory Layout

```
WhiteboardX/
├── boards/                      # Persistent board storage
│   ├── default.json             # Active whiteboard snapshot
│   └── archive/                 # Cleared board archives
├── cloudflare/
│   └── config.yml               # Cloudflare tunnel ingress config
├── server/
│   ├── boardStore.ts            # Persistence engine & TLDraw record generator
│   ├── mcpServer.ts             # Model Context Protocol stdio server
│   ├── server.ts                # Express HTTP + WebSocket hub
│   ├── testMcp.ts               # Test suite verifying tool execution
│   └── types.ts                 # TypeScript type definitions
├── src/
│   ├── App.tsx                  # React TLDraw infinite canvas
│   ├── useBoardSync.ts          # Real-time WebSocket sync hook
│   ├── index.css                # Viewport & glassmorphism styling
│   └── main.tsx                 # Application DOM bootstrap
├── BLUEPRINT.md                 # Complete system blueprint (this file)
├── README.md                    # Project documentation
├── render.yaml                  # 1-click cloud deploy configuration
├── package.json                 # Dependencies and execution scripts
├── tsconfig.json                # TypeScript frontend configuration
├── tsconfig.server.json         # TypeScript backend configuration
├── vite.config.ts               # Vite bundler & dev server config
├── start-whiteboard.bat         # 1-click local launcher
└── start-tunnel.bat             # 1-click Cloudflare tunnel launcher
```

---

## 4. Execution & Operational Commands

| Action | Command |
| :--- | :--- |
| **Start Server** | `npm start` (Runs on `http://localhost:4876`) |
| **Development Mode** | `npm run dev` (Vite + hot reloading) |
| **Build Project** | `npm run build` (`dist/` + `dist-server/`) |
| **Run MCP Test Suite** | `npm run test:mcp` |
| **Start Cloudflare Tunnel** | `& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config cloudflare/config.yml run whiteboardx` |
| **Push Updates to GitHub** | `git push origin main` |

---

## 5. Security & Access Credentials

- **Default Username**: `admin` (configurable via `ADMIN_USER` environment variable)
- **Default Password**: `whiteboard2026` (configurable via `ADMIN_PASSWORD` environment variable)
- **Session Mechanism**: Token authentication protecting REST endpoints (`/api/boards`, `/api/tools`) and WebSocket handshake (`/ws?token=...`).
