"""
Laya-Powered Canvas Diagram Router & Layout Planner for WhiteboardX
Sub-35ms diagram intent classification and coordinate generation for AI agents.
"""

import sys
import json
from typing import Dict, Any, List, Optional

try:
    from laya import Router
    HAS_LAYA = True
except ImportError:
    HAS_LAYA = False

class WhiteboardLayaRouter:
    def __init__(self, preload: bool = False):
        self.router = None
        if HAS_LAYA:
            try:
                self.router = Router(preload=preload)
            except Exception as e:
                print(f"[WhiteboardLayaRouter] Warning: Laya init failed: {e}", file=sys.stderr)

    def plan_diagram(self, prompt: str, theme: str = "default") -> Dict[str, Any]:
        """
        Classifies diagram intent and calculates precise node coordinates,
        dimensions, colors, and arrow bindings for TLDraw.
        """
        diagram_type = "flowchart"
        engine = "fallback"

        state = {"prompt": prompt}
        if self.router:
            questions = {
                "diagram_type": {
                    "type": "choice",
                    "instructions": "What type of whiteboard diagram or layout is being requested?",
                    "criteria": {
                        "kanban_board": "kanban, sprint tasks, columns, todo doing done, backlog, progress board",
                        "flowchart": "flowchart, step-by-step process, user flow, auth flow, decision tree, logic sequence",
                        "system_architecture": "architecture, backend, frontend, database, cloud, microservices, API infrastructure",
                        "brainstorm_cluster": "brainstorming, idea cluster, sticky notes collection, thoughts, retro",
                        "clear_board": "clear everything, reset canvas, wipe board, blank canvas"
                    }
                }
            }
            try:
                res = self.router.predict(state, questions)
                answers = res.get("answers", res)
                diagram_type = answers.get("diagram_type", {}).get("choice", "flowchart")
                engine = "laya"
            except Exception as e:
                print(f"[WhiteboardLayaRouter] Laya prediction error: {e}", file=sys.stderr)

        # Fallback classification if Laya wasn't active
        if engine == "fallback":
            p_lower = prompt.lower()
            if any(k in p_lower for k in ["kanban", "sprint", "column", "todo", "done", "backlog"]):
                diagram_type = "kanban_board"
            elif any(k in p_lower for k in ["arch", "microservice", "database", "infrastructure", "system", "backend"]):
                diagram_type = "system_architecture"
            elif any(k in p_lower for k in ["brainstorm", "sticky", "notes", "ideas", "cluster"]):
                diagram_type = "brainstorm_cluster"
            elif any(k in p_lower for k in ["clear", "reset", "wipe", "blank"]):
                diagram_type = "clear_board"
            else:
                diagram_type = "flowchart"

        # Generate geometric layout based on classified diagram type
        layout = self._generate_layout(diagram_type, prompt)
        layout["diagram_type"] = diagram_type
        layout["engine"] = engine
        return layout

    def _generate_layout(self, diagram_type: str, prompt: str) -> Dict[str, Any]:
        """Calculates exact TLDraw-compatible shapes, frames, and arrows."""
        if diagram_type == "clear_board":
            return {"action": "clear", "shapes": [], "arrows": [], "frames": []}

        if diagram_type == "kanban_board":
            frames = [
                {"title": "📋 To Do", "x": 100, "y": 100, "width": 320, "height": 600},
                {"title": "⚡ In Progress", "x": 460, "y": 100, "width": 320, "height": 600},
                {"title": "✅ Done", "x": 820, "y": 100, "width": 320, "height": 600}
            ]
            shapes = [
                {"type": "note", "x": 130, "y": 170, "text": "Research & Setup", "color": "yellow"},
                {"type": "note", "x": 130, "y": 320, "text": "Core Pipeline Design", "color": "yellow"},
                {"type": "note", "x": 490, "y": 170, "text": "Implementation", "color": "blue"},
                {"type": "note", "x": 850, "y": 170, "text": "Sprint Architecture Defined", "color": "green"}
            ]
            return {"action": "render", "frames": frames, "shapes": shapes, "arrows": []}

        elif diagram_type == "system_architecture":
            shapes = [
                {"id": "node_client", "type": "geo", "geo": "rectangle", "x": 100, "y": 250, "width": 180, "height": 90, "label": "Web & Mobile Client", "color": "blue"},
                {"id": "node_gateway", "type": "geo", "geo": "rectangle", "x": 360, "y": 250, "width": 180, "height": 90, "label": "API Gateway / Cloudflare", "color": "violet"},
                {"id": "node_backend", "type": "geo", "geo": "rectangle", "x": 620, "y": 180, "width": 180, "height": 90, "label": "Core App Server", "color": "green"},
                {"id": "node_laya", "type": "geo", "geo": "rectangle", "x": 620, "y": 320, "width": 180, "height": 90, "label": "Laya Decision Engine", "color": "orange"},
                {"id": "node_db", "type": "geo", "geo": "ellipse", "x": 880, "y": 250, "width": 160, "height": 90, "label": "Persistent Storage", "color": "grey"}
            ]
            arrows = [
                {"from": "node_client", "to": "node_gateway", "label": "HTTPS/WSS"},
                {"from": "node_gateway", "to": "node_backend", "label": "Route"},
                {"from": "node_gateway", "to": "node_laya", "label": "Fast Triage (<35ms)"},
                {"from": "node_backend", "to": "node_db", "label": "I/O"}
            ]
            frames = [
                {"title": "Cloud Infrastructure", "x": 320, "y": 120, "width": 760, "height": 340}
            ]
            return {"action": "render", "frames": frames, "shapes": shapes, "arrows": arrows}

        elif diagram_type == "brainstorm_cluster":
            shapes = [
                {"type": "note", "x": 200, "y": 150, "text": "Audience Hook & Title", "color": "yellow"},
                {"type": "note", "x": 420, "y": 150, "text": "Cinematic Visual Aesthetic", "color": "blue"},
                {"type": "note", "x": 640, "y": 150, "text": "Monetization & Conversion", "color": "green"},
                {"type": "note", "x": 310, "y": 320, "text": "Viral Momentum Mechanics", "color": "orange"},
                {"type": "note", "x": 530, "y": 320, "text": "Retention & Pacing", "color": "violet"}
            ]
            frames = [
                {"title": "💡 Strategy Brainstorm", "x": 150, "y": 80, "width": 750, "height": 450}
            ]
            return {"action": "render", "frames": frames, "shapes": shapes, "arrows": []}

        else: # flowchart
            shapes = [
                {"id": "step_1", "type": "geo", "geo": "ellipse", "x": 100, "y": 200, "width": 140, "height": 80, "label": "1. User Input", "color": "blue"},
                {"id": "step_2", "type": "geo", "geo": "rhombus", "x": 320, "y": 190, "width": 160, "height": 100, "label": "Laya Triage: Valid?", "color": "orange"},
                {"id": "step_3_yes", "type": "geo", "geo": "rectangle", "x": 560, "y": 140, "width": 180, "height": 80, "label": "Execute Pipeline", "color": "green"},
                {"id": "step_3_no", "type": "geo", "geo": "rectangle", "x": 560, "y": 280, "width": 180, "height": 80, "label": "Early Exit / Error", "color": "red"}
            ]
            arrows = [
                {"from": "step_1", "to": "step_2", "label": ""},
                {"from": "step_2", "to": "step_3_yes", "label": "Yes"},
                {"from": "step_2", "to": "step_3_no", "label": "No"}
            ]
            return {"action": "render", "frames": [], "shapes": shapes, "arrows": arrows}

if __name__ == "__main__":
    router = WhiteboardLayaRouter(preload=False)

    if "--test" in sys.argv:
        print("=== Testing WhiteboardX Laya Router ===")
        prompts = [
            "Draw a flowchart for our OAuth login flow with validation",
            "Set up a kanban board with Todo, In Progress, and Done columns",
            "Create an architecture diagram for our frontend, gateway, and database",
            "Brainstorm ideas for viral merchandise marketing",
            "Reset the canvas and start clean"
        ]
        for p in prompts:
            plan = router.plan_diagram(p)
            print(f"\nPrompt: '{p}'")
            print(f" -> Type: {plan['diagram_type']} | Shapes: {len(plan['shapes'])} | Arrows: {len(plan['arrows'])} | Frames: {len(plan['frames'])} (Engine: {plan['engine']})")

    elif "--json" in sys.argv:
        try:
            inp = json.load(sys.stdin)
            prompt = inp.get("prompt", "")
            theme = inp.get("theme", "default")
            out = router.plan_diagram(prompt, theme)
            print(json.dumps(out))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    else:
        print("Usage: python laya_canvas_router.py [--test | --json]")
