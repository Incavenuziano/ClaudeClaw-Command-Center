/**
 * ClaudeClaw Command Center — Dev Server
 *
 * Servidor simples para desenvolvimento do dashboard.
 *
 * Uso:
 *   bun run dashboard/server.ts
 */

import { readFile, appendFile } from "fs/promises";
import { join, extname } from "path";
import { api } from "./api";

// Live Execution State
interface ExecutionEntry {
  id: string;
  timestamp: string;
  command: string;
  status: "running" | "completed" | "error";
  output?: string;
  exitCode?: number;
}

const liveExecutions: ExecutionEntry[] = [];
const MAX_EXECUTIONS = 50;
const wsClients = new Set<WebSocket>();

function broadcastExecution(entry: ExecutionEntry) {
  const message = JSON.stringify({ type: "execution", data: entry });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function registerExecution(entry: ExecutionEntry) {
  liveExecutions.unshift(entry);
  if (liveExecutions.length > MAX_EXECUTIONS) {
    liveExecutions.pop();
  }
  broadcastExecution(entry);
}

export function updateExecution(id: string, updates: Partial<ExecutionEntry>) {
  const entry = liveExecutions.find(e => e.id === id);
  if (entry) {
    Object.assign(entry, updates);
    broadcastExecution(entry);
  }
}

const PORT = 3000;
const DASHBOARD_DIR = import.meta.dir;
const STATIC_DIR = join(DASHBOARD_DIR, "static");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jsx": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function serveFile(path: string): Promise<Response> {
  try {
    const content = await readFile(path);
    const ext = extname(path);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(content, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",

  // WebSocket handler para Live Execution
  websocket: {
    open(ws) {
      wsClients.add(ws);
      // Envia histórico recente ao conectar
      ws.send(JSON.stringify({ type: "history", data: liveExecutions.slice(0, 20) }));
    },
    close(ws) {
      wsClients.delete(ws);
    },
    message(ws, message) {
      // Ping/pong para manter conexão
      if (message === "ping") {
        ws.send("pong");
      }
    },
  },

  async fetch(req, server) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Serve index.html na raiz
    if (pathname === "/" || pathname === "/index.html") {
      return serveFile(join(DASHBOARD_DIR, "index.html"));
    }

    // Serve arquivos estáticos
    if (pathname.startsWith("/static/")) {
      const filePath = join(DASHBOARD_DIR, pathname);
      return serveFile(filePath);
    }

    // API endpoints
    if (pathname === "/api/health") {
      return Response.json({ status: "ok", timestamp: new Date().toISOString() });
    }

    if (pathname === "/api/processos") {
      const data = await api.getProcessos();
      return Response.json(data);
    }

    if (pathname === "/api/monitor-state") {
      const data = await api.getMonitorState();
      return Response.json(data);
    }

    if (pathname === "/api/satellites") {
      const data = await api.getSatellites();
      return Response.json(data);
    }

    if (pathname === "/api/crons") {
      const data = await api.getCrons();
      return Response.json(data);
    }

    if (pathname === "/api/doctor") {
      const data = await api.runDoctor();
      return Response.json(data);
    }

    if (pathname === "/api/events") {
      const data = await api.getEvents();
      return Response.json(data);
    }

    if (pathname === "/api/logs") {
      const data = await api.getLogs();
      return Response.json(data);
    }

    if (pathname === "/api/usage") {
      const data = await api.getUsage();
      return Response.json(data);
    }

    if (pathname === "/api/exec" && req.method === "POST") {
      try {
        const body = await req.json() as { command?: string };
        if (!body.command || typeof body.command !== "string") {
          return Response.json({ error: "comando não fornecido" }, { status: 400 });
        }
        const data = await api.execCommand(body.command);
        return Response.json(data);
      } catch {
        return Response.json({ error: "body inválido" }, { status: 400 });
      }
    }

    if (pathname === "/api/pncp") {
      const data = await api.getPncp();
      return Response.json(data);
    }

    if (pathname === "/api/satellite/send" && req.method === "POST") {
      try {
        const body = await req.json() as { satelliteId?: string; message?: string };
        if (!body.satelliteId || !body.message) {
          return Response.json({ error: "satelliteId e message são obrigatórios" }, { status: 400 });
        }
        const data = await api.sendToSatellite(body.satelliteId, body.message);
        return Response.json(data);
      } catch {
        return Response.json({ error: "body inválido" }, { status: 400 });
      }
    }

    // Legacy health endpoint
    if (pathname === "/health/live") {
      return Response.json({ status: "ok" });
    }

    // WebSocket upgrade para Live Execution
    if (pathname === "/ws/live") {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined as unknown as Response;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // API: Listar execuções recentes
    if (pathname === "/api/executions") {
      return Response.json(liveExecutions.slice(0, 20));
    }

    // API: Registrar execução (chamado pelo Claude)
    if (pathname === "/api/executions/register" && req.method === "POST") {
      try {
        const body = await req.json() as ExecutionEntry;
        if (!body.id || !body.command) {
          return Response.json({ error: "id e command são obrigatórios" }, { status: 400 });
        }
        registerExecution({
          id: body.id,
          timestamp: body.timestamp || new Date().toISOString(),
          command: body.command,
          status: body.status || "running",
          output: body.output,
          exitCode: body.exitCode,
        });
        return Response.json({ success: true });
      } catch {
        return Response.json({ error: "body inválido" }, { status: 400 });
      }
    }

    // API: Atualizar execução
    if (pathname === "/api/executions/update" && req.method === "POST") {
      try {
        const body = await req.json() as { id: string } & Partial<ExecutionEntry>;
        if (!body.id) {
          return Response.json({ error: "id é obrigatório" }, { status: 400 });
        }
        updateExecution(body.id, body);
        return Response.json({ success: true });
      } catch {
        return Response.json({ error: "body inválido" }, { status: 400 });
      }
    }

    // Fallback para index.html (SPA)
    return serveFile(join(DASHBOARD_DIR, "index.html"));
  },
});

console.log(`🎛️ ClaudeClaw Command Center`);
console.log(`   http://localhost:${PORT}`);
console.log(`   Press Ctrl+C to stop`);
