import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { boardStore } from './boardStore.js';

export interface LayaDiagramFrame {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayaDiagramShape {
  id?: string;
  type: 'note' | 'geo';
  geo?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  label?: string;
  color?: string;
}

export interface LayaDiagramArrow {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

export interface LayaDiagramPlan {
  action: 'render' | 'clear';
  diagram_type: string;
  engine: 'laya' | 'fallback';
  frames: LayaDiagramFrame[];
  shapes: LayaDiagramShape[];
  arrows: LayaDiagramArrow[];
}

/**
 * Finds the preferred Python interpreter with Laya installed.
 */
function getPythonExecutable(): string {
  if (process.env.LAYA_PYTHON_PATH && fs.existsSync(process.env.LAYA_PYTHON_PATH)) {
    return process.env.LAYA_PYTHON_PATH;
  }
  const centralVenv = 'C:\\Users\\AI Factorz\\Documents\\Laya\\.venv\\Scripts\\python.exe';
  if (fs.existsSync(centralVenv)) {
    return centralVenv;
  }
  return 'python';
}

/**
 * Fallback in-process layout generator when Python/Laya is not reachable.
 */
function generateFallbackPlan(prompt: string): LayaDiagramPlan {
  const pLower = prompt.toLowerCase();
  let diagramType = 'flowchart';

  if (pLower.includes('kanban') || pLower.includes('sprint') || pLower.includes('todo') || pLower.includes('done') || pLower.includes('backlog')) {
    diagramType = 'kanban_board';
  } else if (pLower.includes('arch') || pLower.includes('microservice') || pLower.includes('database') || pLower.includes('infrastructure') || pLower.includes('system') || pLower.includes('backend')) {
    diagramType = 'system_architecture';
  } else if (pLower.includes('brainstorm') || pLower.includes('sticky') || pLower.includes('notes') || pLower.includes('ideas') || pLower.includes('cluster')) {
    diagramType = 'brainstorm_cluster';
  } else if (pLower.includes('clear') || pLower.includes('reset') || pLower.includes('wipe') || pLower.includes('blank')) {
    diagramType = 'clear_board';
  }

  if (diagramType === 'clear_board') {
    return { action: 'clear', diagram_type: diagramType, engine: 'fallback', frames: [], shapes: [], arrows: [] };
  }

  if (diagramType === 'kanban_board') {
    return {
      action: 'render',
      diagram_type: diagramType,
      engine: 'fallback',
      frames: [
        { title: '📋 To Do', x: 100, y: 100, width: 320, height: 600 },
        { title: '⚡ In Progress', x: 460, y: 100, width: 320, height: 600 },
        { title: '✅ Done', x: 820, y: 100, width: 320, height: 600 },
      ],
      shapes: [
        { type: 'note', x: 130, y: 170, text: 'Research & Setup', color: 'yellow' },
        { type: 'note', x: 130, y: 320, text: 'Core Pipeline Design', color: 'yellow' },
        { type: 'note', x: 490, y: 170, text: 'Implementation', color: 'blue' },
        { type: 'note', x: 850, y: 170, text: 'Sprint Architecture Defined', color: 'green' },
      ],
      arrows: [],
    };
  }

  if (diagramType === 'system_architecture') {
    return {
      action: 'render',
      diagram_type: diagramType,
      engine: 'fallback',
      frames: [
        { title: 'Cloud Infrastructure', x: 320, y: 120, width: 760, height: 340 },
      ],
      shapes: [
        { id: 'node_client', type: 'geo', geo: 'rectangle', x: 100, y: 250, width: 180, height: 90, label: 'Web & Mobile Client', color: 'blue' },
        { id: 'node_gateway', type: 'geo', geo: 'rectangle', x: 360, y: 250, width: 180, height: 90, label: 'API Gateway / Cloudflare', color: 'violet' },
        { id: 'node_backend', type: 'geo', geo: 'rectangle', x: 620, y: 180, width: 180, height: 90, label: 'Core App Server', color: 'green' },
        { id: 'node_laya', type: 'geo', geo: 'rectangle', x: 620, y: 320, width: 180, height: 90, label: 'Laya Decision Engine', color: 'orange' },
        { id: 'node_db', type: 'geo', geo: 'ellipse', x: 880, y: 250, width: 160, height: 90, label: 'Persistent Storage', color: 'grey' },
      ],
      arrows: [
        { from: 'node_client', to: 'node_gateway', label: 'HTTPS/WSS' },
        { from: 'node_gateway', to: 'node_backend', label: 'Route' },
        { from: 'node_gateway', to: 'node_laya', label: 'Fast Triage (<35ms)' },
        { from: 'node_backend', to: 'node_db', label: 'I/O' },
      ],
    };
  }

  if (diagramType === 'brainstorm_cluster') {
    return {
      action: 'render',
      diagram_type: diagramType,
      engine: 'fallback',
      frames: [
        { title: '💡 Strategy Brainstorm', x: 150, y: 80, width: 750, height: 450 },
      ],
      shapes: [
        { type: 'note', x: 200, y: 150, text: 'Audience Hook & Title', color: 'yellow' },
        { type: 'note', x: 420, y: 150, text: 'Cinematic Visual Aesthetic', color: 'blue' },
        { type: 'note', x: 640, y: 150, text: 'Monetization & Conversion', color: 'green' },
        { type: 'note', x: 310, y: 320, text: 'Viral Momentum Mechanics', color: 'orange' },
        { type: 'note', x: 530, y: 320, text: 'Retention & Pacing', color: 'violet' },
      ],
      arrows: [],
    };
  }

  // Flowchart
  return {
    action: 'render',
    diagram_type: 'flowchart',
    engine: 'fallback',
    frames: [],
    shapes: [
      { id: 'step_1', type: 'geo', geo: 'ellipse', x: 100, y: 200, width: 140, height: 80, label: '1. User Input', color: 'blue' },
      { id: 'step_2', type: 'geo', geo: 'rhombus', x: 320, y: 190, width: 160, height: 100, label: 'Laya Triage: Valid?', color: 'orange' },
      { id: 'step_3_yes', type: 'geo', geo: 'rectangle', x: 560, y: 140, width: 180, height: 80, label: 'Execute Pipeline', color: 'green' },
      { id: 'step_3_no', type: 'geo', geo: 'rectangle', x: 560, y: 280, width: 180, height: 80, label: 'Early Exit / Error', color: 'red' },
    ],
    arrows: [
      { from: 'step_1', to: 'step_2', label: '' },
      { from: 'step_2', to: 'step_3_yes', label: 'Yes' },
      { from: 'step_2', to: 'step_3_no', label: 'No' },
    ],
  };
}

/**
 * Plans a whiteboard layout using the local Laya model via Python subprocess.
 */
export async function planDiagramWithLaya(prompt: string, theme: string = 'default'): Promise<LayaDiagramPlan> {
  const pythonBin = getPythonExecutable();
  const scriptPath = path.resolve(process.cwd(), 'tools', 'laya_canvas_router.py');

  if (!fs.existsSync(scriptPath)) {
    console.warn(`[LayaCanvas] Script not found at ${scriptPath}, using fallback engine.`);
    return generateFallbackPlan(prompt);
  }

  return new Promise<LayaDiagramPlan>((resolve) => {
    let stdout = '';
    let stderr = '';
    let isSettled = false;

    const child = spawn(pythonBin, [scriptPath, '--json'], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          child.kill();
        } catch (_err) {
          // ignore
        }
        console.warn('[LayaCanvas] Subprocess timed out after 15000ms. Falling back.');
        resolve(generateFallbackPlan(prompt));
      }
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        console.warn(`[LayaCanvas] Failed to spawn python process: ${err.message}. Using fallback.`);
        resolve(generateFallbackPlan(prompt));
      }
    });

    child.on('close', (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        if (code === 0) {
          try {
            // Locate JSON in stdout (in case warnings were printed)
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
              const data = JSON.parse(jsonStr);
              if (data && (data.action || data.diagram_type)) {
                return resolve(data as LayaDiagramPlan);
              }
            }
          } catch (err) {
            console.warn(`[LayaCanvas] Failed to parse JSON output: ${err}. Stderr: ${stderr}`);
          }
        } else {
          console.warn(`[LayaCanvas] Process exited with code ${code}. Stderr: ${stderr}`);
        }
        resolve(generateFallbackPlan(prompt));
      }
    });

    try {
      child.stdin.write(JSON.stringify({ prompt, theme }));
      child.stdin.end();
    } catch (err) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(generateFallbackPlan(prompt));
      }
    }
  });
}

/**
 * Executes a planned layout directly on the WhiteboardX boardStore.
 */
export function applyDiagramPlan(plan: LayaDiagramPlan, boardId: string = 'default') {
  if (plan.action === 'clear') {
    const clearResult = boardStore.clearBoard(boardId, true);
    return {
      action: 'clear',
      diagram_type: plan.diagram_type,
      engine: plan.engine,
      message: clearResult.message,
      count: clearResult.count,
    };
  }

  const framesCreated: Array<{ id: string; title: string }> = [];
  const shapesCreated: Array<{ id: string; logicalId?: string; type: string }> = [];
  const arrowsCreated: Array<{ id: string; from: string; to: string }> = [];

  // 1. Create Frames
  for (const frame of plan.frames || []) {
    const res = boardStore.createFrame({
      title: frame.title,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      boardId,
    });
    framesCreated.push({ id: res.id, title: frame.title });
  }

  // 2. Create Shapes and Notes
  const idMap = new Map<string, string>();

  for (const shape of plan.shapes || []) {
    if (shape.type === 'note') {
      const res = boardStore.createStickyNote({
        text: shape.text || shape.label || '',
        x: shape.x,
        y: shape.y,
        color: (shape.color as any) || 'yellow',
        boardId,
      });
      if (shape.id) idMap.set(shape.id, res.id);
      shapesCreated.push({ id: res.id, logicalId: shape.id, type: 'note' });
    } else {
      // geo shape
      let geoType: any = shape.geo || 'rectangle';
      if (geoType === 'rhombus') geoType = 'diamond'; // Map rhombus to diamond in TLDraw

      const res = boardStore.createShape({
        type: geoType,
        label: shape.label || shape.text || '',
        x: shape.x,
        y: shape.y,
        width: shape.width || 180,
        height: shape.height || 90,
        color: (shape.color as any) || 'blue',
        boardId,
      });
      if (shape.id) idMap.set(shape.id, res.id);
      shapesCreated.push({ id: res.id, logicalId: shape.id, type: 'geo' });
    }
  }

  // 3. Connect Nodes with Arrows
  for (const arrow of plan.arrows || []) {
    const sourceId = idMap.get(arrow.from) || arrow.from;
    const targetId = idMap.get(arrow.to) || arrow.to;

    try {
      const res = boardStore.connectNodes({
        source_id: sourceId,
        target_id: targetId,
        label: arrow.label,
        color: (arrow.color as any) || 'black',
        boardId,
      });
      arrowsCreated.push({ id: res.arrowId, from: sourceId, to: targetId });
    } catch (err: any) {
      console.warn(`[LayaCanvas] Could not connect ${sourceId} -> ${targetId}: ${err.message}`);
    }
  }

  return {
    action: 'render',
    diagram_type: plan.diagram_type,
    engine: plan.engine,
    framesCreated: framesCreated.length,
    shapesCreated: shapesCreated.length,
    arrowsCreated: arrowsCreated.length,
    details: {
      frames: framesCreated,
      shapes: shapesCreated,
      arrows: arrowsCreated,
    },
  };
}
