import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { boardStore } from './boardStore.js';

const SERVER_PORT = process.env.PORT || '4876';
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

// Helper to execute via running HTTP server if available (for instant WS broadcast) or local boardStore
async function executeTool(toolName: string, params: any) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${SERVER_URL}/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data.result;
      }
    }
  } catch (_err) {
    // If HTTP server is not reachable, fallback to direct local boardStore access
  }

  // Direct boardStore fallback
  switch (toolName) {
    case 'get_board_state':
      return boardStore.getBoardSummary(params.boardId || 'default');
    case 'create_sticky_note':
      return boardStore.createStickyNote(params);
    case 'create_shape':
      return boardStore.createShape(params);
    case 'connect_nodes':
      return boardStore.connectNodes(params);
    case 'create_frame':
      return boardStore.createFrame(params);
    case 'clear_board':
      return boardStore.clearBoard(params.boardId || 'default', params.archive ?? true);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

const server = new McpServer({
  name: 'whiteboardx-mcp-server',
  version: '1.0.0',
});

// Tool: get_board_state
server.tool(
  'get_board_state',
  'Returns the current board nodes, IDs, positions, connections, and contents from WhiteboardX.',
  {
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
  },
  async ({ boardId }) => {
    try {
      const summary = await executeTool('get_board_state', { boardId: boardId || 'default' });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to retrieve board state: ${error.message}` }],
      };
    }
  }
);

// Tool: create_sticky_note
server.tool(
  'create_sticky_note',
  'Creates a sticky / post-it note on the WhiteboardX infinite canvas.',
  {
    text: z.string().describe('The markdown or plain text content of the note'),
    color: z
      .enum(['yellow', 'blue', 'green', 'pink', 'red', 'violet', 'orange', 'grey', 'black'])
      .optional()
      .describe('Color of the sticky note (default: yellow)'),
    x: z.number().optional().describe('X coordinate on the infinite canvas (default: auto-staggered)'),
    y: z.number().optional().describe('Y coordinate on the infinite canvas (default: auto-staggered)'),
    size: z.enum(['s', 'm', 'l', 'xl']).optional().describe('Size of note text (default: m)'),
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
  },
  async (params) => {
    try {
      const result = await executeTool('create_sticky_note', params);
      return {
        content: [
          {
            type: 'text',
            text: `Sticky note created successfully! Node ID: ${result.id}\nPosition: (${result.record.x}, ${result.record.y})\nText: "${params.text}"`,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create sticky note: ${error.message}` }],
      };
    }
  }
);

// Tool: create_shape
server.tool(
  'create_shape',
  'Creates a geometric shape (rectangle, ellipse, diamond, triangle, etc.) with an optional label on the canvas.',
  {
    type: z
      .enum(['rectangle', 'ellipse', 'diamond', 'triangle', 'cloud', 'star', 'hexagon', 'oval'])
      .optional()
      .describe('Geometric shape type (default: rectangle)'),
    label: z.string().optional().describe('Text label displayed inside the shape'),
    width: z.number().optional().describe('Shape width in pixels (default: 200)'),
    height: z.number().optional().describe('Shape height in pixels (default: 120)'),
    x: z.number().optional().describe('X coordinate on canvas (default: auto)'),
    y: z.number().optional().describe('Y coordinate on canvas (default: auto)'),
    color: z
      .enum(['black', 'blue', 'green', 'yellow', 'red', 'violet', 'orange', 'grey'])
      .optional()
      .describe('Border/fill color theme'),
    fill: z
      .enum(['none', 'semi', 'solid', 'pattern'])
      .optional()
      .describe('Fill style (default: semi)'),
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
  },
  async (params) => {
    try {
      const result = await executeTool('create_shape', params);
      return {
        content: [
          {
            type: 'text',
            text: `Shape (${params.type || 'rectangle'}) created successfully!\nNode ID: ${result.id}\nLabel: "${params.label || ''}"\nDimensions: ${params.width || 200}x${params.height || 120}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create shape: ${error.message}` }],
      };
    }
  }
);

// Tool: connect_nodes
server.tool(
  'connect_nodes',
  'Creates a directional connector arrow bound magnetically between two shapes/nodes.',
  {
    source_id: z.string().describe('ID of the starting shape (e.g. shape:note_abc or shape:geo_xyz)'),
    target_id: z.string().describe('ID of the ending shape'),
    label: z.string().optional().describe('Optional text label displayed along the connector line'),
    color: z
      .enum(['black', 'blue', 'green', 'yellow', 'red', 'violet', 'orange', 'grey'])
      .optional()
      .describe('Arrow stroke color (default: black)'),
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
  },
  async (params) => {
    try {
      const result = await executeTool('connect_nodes', params);
      return {
        content: [
          {
            type: 'text',
            text: `Nodes connected successfully!\nArrow ID: ${result.arrowId}\nFrom: ${params.source_id} -> To: ${params.target_id}${params.label ? `\nLabel: "${params.label}"` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to connect nodes: ${error.message}` }],
      };
    }
  }
);

// Tool: create_frame
server.tool(
  'create_frame',
  'Creates a visual frame to group a cluster of workflow cards, shapes, or diagrams.',
  {
    title: z.string().describe('Title of the frame displayed at top left'),
    x: z.number().describe('Top-left X coordinate of the frame'),
    y: z.number().describe('Top-left Y coordinate of the frame'),
    width: z.number().describe('Width of the frame in pixels'),
    height: z.number().describe('Height of the frame in pixels'),
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
  },
  async (params) => {
    try {
      const result = await executeTool('create_frame', params);
      return {
        content: [
          {
            type: 'text',
            text: `Frame "${params.title}" created successfully!\nFrame ID: ${result.id}\nBounds: (${params.x}, ${params.y}) ${params.width}x${params.height}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create frame: ${error.message}` }],
      };
    }
  }
);

// Tool: clear_board
server.tool(
  'clear_board',
  'Clears the whiteboard canvas. By default, archives existing content into ./boards/archive/ before clearing.',
  {
    boardId: z.string().optional().describe('Target board ID (default: "default")'),
    archive: z.boolean().optional().describe('Whether to archive the current board before clearing (default: true)'),
  },
  async (params) => {
    try {
      const result = await executeTool('clear_board', params);
      return {
        content: [
          {
            type: 'text',
            text: `Board cleared successfully. ${result.message}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to clear board: ${error.message}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[WhiteboardX MCP] Server started on stdio transport.');
}

main().catch((err) => {
  console.error('[WhiteboardX MCP] Fatal error starting server:', err);
  process.exit(1);
});
