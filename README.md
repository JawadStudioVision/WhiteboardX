# WhiteboardX 🎨

> **A self-hosted, local-first interactive infinite whiteboard with persistent local storage and a Model Context Protocol (MCP) interface for AI agent manipulation.**

WhiteboardX combines the fluid vector graphics engine of **@tldraw/tldraw** with a real-time **Node.js/TypeScript MCP Server & WebSocket hub**. It allows both human users and AI agents (such as Antigravity, Claude, Cursor, or autonomous systems) to create, query, group, and connect visual nodes directly on canvas.

---

## 🌟 Features

- **Infinite Canvas (@tldraw/tldraw)**: Fluid pan/zoom, sticky notes, geometric shapes, arrows, freehand drawings, frames, and markdown text.
- **Local-First JSON Persistence**: All board changes automatically save to `./boards/<boardId>.json` so state persists across reboots and crashes.
- **Real-Time WebSocket Sync**: Changes from AI agent MCP tool calls reflect instantly on open browser screens with zero refresh required.
- **Model Context Protocol (MCP) Server**: Exposes standard stdio tools for AI agents (`get_board_state`, `create_sticky_note`, `create_shape`, `connect_nodes`, `create_frame`, `clear_board`).
- **Cloudflare Tunnel Ready**: Pre-configured for `w.studiovision.org` pointing to `localhost:4876`.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run in Development Mode

Run both the Vite frontend client and Express/WebSocket backend simultaneously:

```bash
npm run dev
```

- **Frontend Canvas (Vite)**: `http://localhost:5173`
- **Backend & WebSocket Server**: `http://localhost:4876` (`ws://localhost:4876/ws`)

### 3. Production Build & Headless Startup

```bash
# Build React client and server
npm run build

# Start the unified server on port 4876
npm start
```
Open `http://localhost:4876` in your browser.

---

## 🤖 MCP Server Tools (For AI Agents)

When configured in your MCP client, the following tools become available:

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `get_board_state` | `boardId?` | Returns all active shapes, IDs, positions, text, and connections on the board. |
| `create_sticky_note` | `text`, `color?`, `x?`, `y?`, `size?` | Creates a sticky note (post-it) on canvas. Colors: `yellow`, `blue`, `green`, `pink`, `red`, `violet`, `orange`, `grey`. |
| `create_shape` | `type?`, `label?`, `width?`, `height?`, `x?`, `y?`, `color?`, `fill?` | Creates shapes (`rectangle`, `ellipse`, `diamond`, `triangle`, `cloud`, `star`, etc.). |
| `connect_nodes` | `source_id`, `target_id`, `label?`, `color?` | Creates a magnetic connector arrow with arrowhead between two nodes. |
| `create_frame` | `title`, `x`, `y`, `width`, `height` | Creates a bounding frame container for organizing visual workflows. |
| `clear_board` | `boardId?`, `archive?` | Clears the canvas. Automatically archives current board into `./boards/archive/`. |

---

## ⚙️ AI Agent MCP Integration (`mcp_config.json`)

To register WhiteboardX with Antigravity or Claude Desktop:

### Antigravity / Claude Desktop Configuration
Add the following to your `claude_desktop_config.json` or Antigravity MCP settings:

```json
{
  "mcpServers": {
    "whiteboardx": {
      "command": "node",
      "args": [
        "c:/Users/AI Factorz/Documents/WhiteboardX/node_modules/tsx/dist/cli.mjs",
        "c:/Users/AI Factorz/Documents/WhiteboardX/server/mcpServer.ts"
      ],
      "env": {
        "PORT": "4876"
      }
    }
  }
}
```

---

## 🌐 Remote Access with Cloudflare Tunnel (`w.studiovision.org`)

To access your WhiteboardX canvas securely over the internet:

1. **Install Cloudflare Tunnel (`cloudflared`)**:
   ```powershell
   winget install Cloudflare.cloudflared
   ```

2. **Login and Create Tunnel**:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create whiteboardx
   ```

3. **Route DNS to `w.studiovision.org`**:
   ```bash
   cloudflared tunnel route dns whiteboardx w.studiovision.org
   ```

4. **Run the Tunnel**:
   Using the included `cloudflare/config.yml`:
   ```bash
   cloudflared tunnel --config ./cloudflare/config.yml run whiteboardx
   ```
   Or directly via quick command:
   ```bash
   cloudflared tunnel --url http://localhost:4876
   ```

---

## 📁 Project Structure

```
WhiteboardX/
├── boards/                      # Persistent board storage (JSON)
│   ├── default.json             # Active board snapshot
│   └── archive/                 # Cleared board backups
├── cloudflare/
│   └── config.yml               # Cloudflare tunnel ingress config for w.studiovision.org
├── server/
│   ├── boardStore.ts            # Board persistence & TLDraw record generator
│   ├── mcpServer.ts             # Model Context Protocol (MCP) server
│   ├── server.ts                # Express HTTP + WebSocket server (:4876)
│   ├── testMcp.ts               # Verification & test suite
│   └── types.ts                 # Shared TypeScript types & interfaces
├── src/
│   ├── App.tsx                  # TLDraw canvas + custom UI toolbar
│   ├── useBoardSync.ts          # Realtime bidirectional WebSocket sync hook
│   ├── main.tsx                 # React DOM mount
│   └── index.css                # Glassmorphic UI styling
├── mcp_config.json              # MCP registration snippet
├── package.json
├── tsconfig.json
└── vite.config.ts
```
