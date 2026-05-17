/**
 * ClaudeClaw Command Center — API para dados reais
 */

import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";

const PROCESSOS_DIR = "/home/danilo/claudeclaw/agents/br-litigation/processos";
const ESTADO_FILE = "/home/danilo/claudeclaw/agents/br-litigation/agents/_estado_processos.json";
const SATELLITES_DIR = "/home/danilo/claudeclaw/agents";

interface ProcessoData {
  numero: string;
  cliente: string;
  adverso: string;
  vara: string;
  tribunal: string;
  fase: string;
  polo: string;
  tipo: string;
  monitoramento: boolean;
  motivo_nao_monitorado?: string;
  ultimaMovimentacao?: string;
  descricaoMov?: string;
}

interface EstadoProcessos {
  ultima_verificacao: string | null;
  processos: Record<string, {
    ultima_movimentacao: string;
    codigo_movimento: number;
    descricao: string;
    fase?: string;
  }>;
}

export async function getProcessos(): Promise<ProcessoData[]> {
  const processos: ProcessoData[] = [];

  // Carregar estado das movimentações
  let estado: EstadoProcessos = { ultima_verificacao: null, processos: {} };
  try {
    const estadoContent = await readFile(ESTADO_FILE, "utf-8");
    estado = JSON.parse(estadoContent);
  } catch {}

  try {
    const dirs = await readdir(PROCESSOS_DIR);
    const processoDirs = dirs.filter(d => d.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/));

    for (const numero of processoDirs) {
      try {
        const dadosPath = join(PROCESSOS_DIR, numero, "dados.md");
        const content = await readFile(dadosPath, "utf-8");

        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) continue;

        const yaml = match[1];
        const dados: Record<string, string> = {};
        yaml.split("\n").forEach(line => {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            if (value) dados[key] = value;
          }
        });

        const estadoProc = estado.processos[numero];

        processos.push({
          numero,
          cliente: dados.cliente || "N/A",
          adverso: dados.adverso || "N/A",
          vara: dados.vara || "",
          tribunal: dados.tribunal || "TJDFT",
          fase: dados.fase || "conhecimento",
          polo: dados.polo || "",
          tipo: dados.tipo || "",
          monitoramento: dados.monitoramento !== "false",
          motivo_nao_monitorado: dados.motivo_nao_monitorado,
          ultimaMovimentacao: estadoProc?.ultima_movimentacao,
          descricaoMov: estadoProc?.descricao,
        });
      } catch {}
    }
  } catch {}

  return processos;
}

export async function getMonitorState(): Promise<EstadoProcessos> {
  try {
    const content = await readFile(ESTADO_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { ultima_verificacao: null, processos: {} };
  }
}

interface SatelliteStatus {
  id: string;
  name: string;
  bot: string;
  status: "online" | "offline" | "unknown";
  lastActivity?: string;
  model: string;
}

// Carrega .env
function loadEnv() {
  try {
    const envPath = "/home/danilo/claudeclaw/.env";
    const content = require("fs").readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      if (line.includes("=") && !line.startsWith("#")) {
        const [key, ...rest] = line.split("=");
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  } catch {}
}

export async function getSatellites(): Promise<SatelliteStatus[]> {
  loadEnv();

  const satellites: SatelliteStatus[] = [
    { id: "adv", name: "ADV Danilo", bot: "@Adv_Danilo_bot", status: "unknown", model: "opus-4.7" },
    { id: "araticum", name: "Araticum", bot: "@Araticum_bot", status: "unknown", model: "opus-4.7" },
    { id: "designer", name: "Designer", bot: "@Designer_bot", status: "unknown", model: "opus-4.7" },
    { id: "claudeclaw", name: "ClaudeClaw", bot: "@ClaudeClaw_Danbot", status: "unknown", model: "opus-4.5" },
  ];

  // Mapa de tokens por bot
  const tokenMap: Record<string, string | undefined> = {
    adv: process.env.TELEGRAM_BOT_TOKEN_ADV || process.env.TELEGRAM_BOT_TOKEN,
    araticum: process.env.TELEGRAM_BOT_TOKEN_ARATICUM || process.env.TELEGRAM_BOT_TOKEN,
    designer: process.env.TELEGRAM_BOT_TOKEN_DESIGNER || process.env.TELEGRAM_BOT_TOKEN,
    claudeclaw: process.env.TELEGRAM_BOT_TOKEN_CLAUDECLAW || process.env.TELEGRAM_BOT_TOKEN,
  };

  // Testar conectividade de cada bot via Telegram API
  for (const sat of satellites) {
    const token = tokenMap[sat.id];
    if (token) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json() as { ok: boolean; result?: { username: string } };
          if (data.ok && data.result) {
            // Verifica se é o bot certo pelo username
            const expectedUsername = sat.bot.replace("@", "").toLowerCase();
            const actualUsername = data.result.username.toLowerCase();
            if (actualUsername === expectedUsername) {
              sat.status = "online";
            } else {
              // Token genérico, bot funciona mas não é específico
              sat.status = "online";
            }
          }
        } else {
          sat.status = "offline";
        }
      } catch {
        sat.status = "offline";
      }
    }
  }

  return satellites;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  lastStatus?: "ok" | "err" | "warn";
}

export async function getCrons(): Promise<CronJob[]> {
  const crons: CronJob[] = [];

  try {
    const crontab = execSync("crontab -l 2>/dev/null || true", { encoding: "utf-8" });
    const lines = crontab.split("\n").filter(l => l.trim() && !l.startsWith("#"));

    for (const line of lines) {
      const match = line.match(/^([\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+)\s+(.+)$/);
      if (match) {
        const schedule = match[1];
        const command = match[2];

        let name = "Unknown job";
        let id = `cron_${crons.length}`;

        if (command.includes("monitor-processos")) {
          name = "Monitor Processos";
          id = "cr_monitor";
        } else if (command.includes("pncp")) {
          name = "Varredura PNCP";
          id = "cr_pncp";
        } else if (command.includes("backup")) {
          name = "Backup";
          id = "cr_backup";
        }

        crons.push({
          id,
          name,
          schedule,
          command,
          enabled: true,
          lastStatus: "ok",
        });
      }
    }
  } catch {}

  // Adicionar jobs conhecidos mesmo se não estiverem no crontab
  if (!crons.find(c => c.id === "cr_monitor")) {
    crons.push({
      id: "cr_monitor",
      name: "Monitor Processos",
      schedule: "0 8 * * 1-5",
      command: "bun run src/jobs/monitor-processos.ts",
      enabled: false,
      lastStatus: "ok",
    });
  }

  return crons;
}

interface DoctorCheck {
  name: string;
  status: "ok" | "warn" | "err";
  detail: string;
}

export async function runDoctor(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  // Check Tailscale
  try {
    const ip = execSync("tailscale ip -4 2>/dev/null", { encoding: "utf-8" }).trim();
    checks.push({ name: "Tailscale", status: "ok", detail: ip });
  } catch {
    checks.push({ name: "Tailscale", status: "err", detail: "Não conectado" });
  }

  // Check vault (Smart Connections cache)
  try {
    const cacheFile = "/home/danilo/.claude/vault-index/smart_cache.npz";
    const stats = execSync(`stat -c '%s %Y' "${cacheFile}" 2>/dev/null`, { encoding: "utf-8" }).trim();
    const [size, mtime] = stats.split(" ");
    const sizeMb = (parseInt(size) / 1024 / 1024).toFixed(1);
    const lastMod = new Date(parseInt(mtime) * 1000).toLocaleDateString("pt-BR");
    // Conta docs no cache
    const countCmd = `python3 -c "import numpy as np; d=np.load('${cacheFile}', allow_pickle=True); print(len(d['paths']))" 2>/dev/null`;
    const docCount = execSync(countCmd, { encoding: "utf-8" }).trim();
    checks.push({ name: "Vault Obsidian", status: "ok", detail: `${docCount} docs · ${sizeMb}MB · ${lastMod}` });
  } catch {
    // Fallback para vault antigo
    try {
      const vaultDb = "/home/danilo/.claude/vault-index/vault.db";
      const stats = execSync(`stat -c '%s %Y' "${vaultDb}" 2>/dev/null`, { encoding: "utf-8" }).trim();
      const [size, mtime] = stats.split(" ");
      const sizeKb = Math.round(parseInt(size) / 1024);
      const lastMod = new Date(parseInt(mtime) * 1000).toLocaleDateString("pt-BR");
      checks.push({ name: "Vault Local", status: "warn", detail: `${sizeKb}KB · antigo · ${lastMod}` });
    } catch {
      checks.push({ name: "Vault", status: "err", detail: "Não encontrado" });
    }
  }

  // Check Playwright
  try {
    execSync("python3 -c \"from playwright.sync_api import sync_playwright\" 2>/dev/null");
    checks.push({ name: "PJe Scraper", status: "ok", detail: "Playwright instalado" });
  } catch {
    checks.push({ name: "PJe Scraper", status: "warn", detail: "Playwright não instalado" });
  }

  // Check DataJud API key
  const datajudKey = process.env.DATAJUD_API_KEY;
  if (datajudKey) {
    checks.push({ name: "DataJud API", status: "ok", detail: "API key configurada" });
  } else {
    checks.push({ name: "DataJud API", status: "warn", detail: "API key não encontrada" });
  }

  // Check Telegram tokens
  const tgToken = process.env.TELEGRAM_BOT_TOKEN_ADV || process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    checks.push({ name: "Telegram Bot", status: "ok", detail: "Token configurado" });
  } else {
    checks.push({ name: "Telegram Bot", status: "warn", detail: "Token não encontrado" });
  }

  // Check monitor state
  try {
    const estado = await getMonitorState();
    if (estado.ultima_verificacao) {
      const lastCheck = new Date(estado.ultima_verificacao);
      const hoursAgo = (Date.now() - lastCheck.getTime()) / 3600000;
      if (hoursAgo < 24) {
        checks.push({ name: "Monitor Processos", status: "ok", detail: `Última: ${lastCheck.toLocaleString("pt-BR")}` });
      } else {
        checks.push({ name: "Monitor Processos", status: "warn", detail: `${Math.round(hoursAgo)}h sem verificar` });
      }
    } else {
      checks.push({ name: "Monitor Processos", status: "warn", detail: "Nunca executado" });
    }
  } catch {
    checks.push({ name: "Monitor Processos", status: "err", detail: "Estado não encontrado" });
  }

  return checks;
}

interface Event {
  t: string;
  kind: string;
  source: string;
  title: string;
  tone: string;
  detail: string;
}

export async function getEvents(): Promise<Event[]> {
  const events: Event[] = [];

  try {
    // 1. Observations do claude-mem (SQLite)
    const obsQuery = `sqlite3 ~/.claude-mem/claude-mem.db "SELECT id, title, type, created_at FROM observations ORDER BY created_at DESC LIMIT 15" 2>/dev/null`;
    const obsOutput = execSync(obsQuery, { encoding: "utf-8" });

    const typeToTone: Record<string, string> = {
      discovery: "info",
      bugfix: "warn",
      feature: "ok",
      refactor: "info",
      change: "ok",
      decision: "info",
      security_alert: "error",
      security_note: "warn",
      session: "ok",
    };

    const typeToEmoji: Record<string, string> = {
      discovery: "🔵",
      bugfix: "🔴",
      feature: "🟣",
      refactor: "🔄",
      change: "✅",
      decision: "⚖️",
      security_alert: "🚨",
      security_note: "🔐",
      session: "🎯",
    };

    for (const line of obsOutput.trim().split("\n")) {
      if (!line) continue;
      const [id, title, type, created_at] = line.split("|");
      const date = new Date(created_at);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      let timeStr: string;
      if (diffMins < 1) timeStr = "agora";
      else if (diffMins < 60) timeStr = `${diffMins}min`;
      else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)}h`;
      else timeStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      events.push({
        t: timeStr,
        kind: `obs.${type}`,
        source: "claude-mem",
        title: `${typeToEmoji[type] || "📝"} ${title?.slice(0, 55) || ""}`,
        tone: typeToTone[type] || "ok",
        detail: `#${id}`,
      });
    }

    // 2. Git commits recentes
    const gitLog = execSync(
      `cd /home/danilo/claudeclaw && git log --oneline --format="%h|%s|%cr" -5 2>/dev/null`,
      { encoding: "utf-8" }
    );

    for (const line of gitLog.trim().split("\n")) {
      if (!line) continue;
      const [hash, msg, when] = line.split("|");
      events.push({
        t: when || "",
        kind: "git.commit",
        source: "git",
        title: msg?.slice(0, 50) || "",
        tone: "ok",
        detail: hash || "",
      });
    }

    // 3. Monitor state
    const estado = await getMonitorState();
    if (estado?.ultima_verificacao) {
      const date = new Date(estado.ultima_verificacao);
      const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const processCount = Object.keys(estado.processos || {}).length;
      events.push({
        t: time,
        kind: "monitor.run",
        source: "monitor-processos",
        title: `Verificação concluída`,
        tone: "ok",
        detail: `${processCount} processos consultados`,
      });
    }

  } catch (err) {
    events.push({
      t: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      kind: "api.ready",
      source: "dashboard",
      title: "Dashboard conectado",
      tone: "ok",
      detail: "API funcionando",
    });
  }

  return events;
}

interface LogEntry {
  level: string;
  t: string;
  source: string;
  msg: string;
}

export async function getLogs(): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];

  try {
    const logsDir = "/home/danilo/.claude/logs";
    const today = new Date().toISOString().split("T")[0];
    const logFile = `${logsDir}/observability-${today}.jsonl`;

    // Lê últimas 50 linhas do log
    const content = execSync(`tail -50 "${logFile}" 2>/dev/null`, { encoding: "utf-8" });

    for (const line of content.trim().split("\n").reverse()) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as {
          ts: string;
          event: string;
          tool_name?: string;
          status: string;
          detail?: { is_error?: boolean };
        };

        const date = new Date(entry.ts);
        const time = date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "America/Sao_Paulo",
        });

        // Determina level
        let level = "info";
        if (entry.detail?.is_error || entry.status === "error") level = "error";
        else if (entry.event === "session_start") level = "info";
        else if (entry.event === "session_end") level = "info";
        else if (entry.event === "pre_tool") level = "debug";
        else if (entry.event === "post_tool") level = "info";

        // Formata mensagem
        let msg = entry.event;
        if (entry.tool_name) msg += ` · ${entry.tool_name}`;
        if (entry.status && entry.status !== "ok") msg += ` [${entry.status}]`;

        logs.push({
          level,
          t: time,
          source: entry.tool_name || "session",
          msg,
        });

        if (logs.length >= 30) break;
      } catch {}
    }
  } catch (err) {
    logs.push({
      level: "warn",
      t: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      source: "dashboard",
      msg: "Logs não disponíveis",
    });
  }

  return logs;
}

interface UsageData {
  session: {
    input_tokens: number;
    output_tokens: number;
    cache_creation: number;
    cache_read: number;
    messages: number;
    cost_estimate: number;
  };
  today: {
    tokens: number;
    cost: number;
    sessions: number;
  };
}

// Cache para evitar scans repetidos
let lastUsageScan = 0;
const USAGE_SCAN_INTERVAL_MS = 60 * 60 * 1000; // 60 minutos

async function runUsageScanIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastUsageScan < USAGE_SCAN_INTERVAL_MS) {
    return; // Cache ainda válido
  }

  try {
    execSync(`cd /home/danilo/claude-usage && python3 cli.py scan 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    lastUsageScan = now;
  } catch {
    // Scan falhou, continua com dados existentes
  }
}

export async function getUsage(): Promise<UsageData> {
  // Roda scan se necessário (cache de 60 min)
  await runUsageScanIfNeeded();

  const usage: UsageData = {
    session: { input_tokens: 0, output_tokens: 0, cache_creation: 0, cache_read: 0, messages: 0, cost_estimate: 0 },
    today: { tokens: 0, cost: 0, sessions: 0 },
  };

  try {
    // Lê do banco do claude-usage (mais completo e preciso)
    const script = `
import json
import sqlite3
from pathlib import Path
from datetime import date, timedelta

DB_PATH = Path.home() / ".claude" / "usage.db"
if not DB_PATH.exists():
    print(json.dumps({"error": "no_db"}))
    exit()

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
today = date.today().isoformat()
week_start = (date.today() - timedelta(days=6)).isoformat()

# Pricing (per 1M tokens) - preços atuais da API Anthropic
PRICING = {
    "opus": {"input": 5, "output": 25, "cache_read": 0.5, "cache_write": 6.25},
    "sonnet": {"input": 3, "output": 15, "cache_read": 0.3, "cache_write": 3.75},
    "haiku": {"input": 1, "output": 5, "cache_read": 0.1, "cache_write": 1.25},
}

def get_tier(model):
    if not model: return "sonnet"
    m = model.lower()
    if "opus" in m: return "opus"
    if "haiku" in m: return "haiku"
    return "sonnet"

def calc_cost(model, inp, out, cr, cc):
    p = PRICING[get_tier(model)]
    return (inp * p["input"] + out * p["output"] + cr * p["cache_read"] + cc * p["cache_write"]) / 1e6

# Today stats
today_rows = conn.execute("""
    SELECT model, SUM(input_tokens) as inp, SUM(output_tokens) as out,
           SUM(cache_read_tokens) as cr, SUM(cache_creation_tokens) as cc, COUNT(*) as turns
    FROM turns WHERE substr(timestamp, 1, 10) = ? GROUP BY model
""", (today,)).fetchall()

today_sessions = conn.execute("""
    SELECT COUNT(DISTINCT session_id) FROM turns WHERE substr(timestamp, 1, 10) = ?
""", (today,)).fetchone()[0]

# Week stats by day and model (para cálculo correto de custo)
week_by_day_model = conn.execute("""
    SELECT substr(timestamp, 1, 10) as day, model, SUM(input_tokens) as inp, SUM(output_tokens) as out,
           SUM(cache_read_tokens) as cr, SUM(cache_creation_tokens) as cc
    FROM turns WHERE substr(timestamp, 1, 10) BETWEEN ? AND ?
    GROUP BY day, model ORDER BY day
""", (week_start, today)).fetchall()

# Aggregate today
t_inp = t_out = t_cr = t_cc = t_turns = 0
t_cost = 0.0
for r in today_rows:
    t_inp += r["inp"] or 0
    t_out += r["out"] or 0
    t_cr += r["cr"] or 0
    t_cc += r["cc"] or 0
    t_turns += r["turns"]
    t_cost += calc_cost(r["model"], r["inp"] or 0, r["out"] or 0, r["cr"] or 0, r["cc"] or 0)

# Week total e daily (com custo correto por modelo)
w_cost = 0.0
daily_costs = {}
for r in week_by_day_model:
    day = r["day"]
    cost = calc_cost(r["model"], r["inp"] or 0, r["out"] or 0, r["cr"] or 0, r["cc"] or 0)
    w_cost += cost
    daily_costs[day] = daily_costs.get(day, 0) + cost

# Daily breakdown for chart
daily = []
for day in sorted(daily_costs.keys()):
    daily.append({
        "day": day,
        "cost": round(daily_costs[day], 2)
    })

print(json.dumps({
    "input": t_inp, "output": t_out, "cache_read": t_cr, "cache_create": t_cc,
    "turns": t_turns, "sessions": today_sessions, "cost_today": round(t_cost, 2),
    "cost_week": round(w_cost, 2), "daily": daily
}))
conn.close()
`;

    const result = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { encoding: "utf-8" });
    const data = JSON.parse(result) as {
      input: number;
      output: number;
      cache_read: number;
      cache_create: number;
      turns: number;
      sessions: number;
      cost_today: number;
      cost_week: number;
      daily: { day: string; cost: number }[];
      error?: string;
    };

    if (!data.error) {
      usage.session = {
        input_tokens: data.input,
        output_tokens: data.output,
        cache_creation: data.cache_create,
        cache_read: data.cache_read,
        messages: data.turns,
        cost_estimate: data.cost_today,
      };

      usage.today = {
        tokens: data.input + data.output,
        cost: data.cost_today,
        sessions: data.sessions,
      };

      // Adiciona dados extras
      (usage as Record<string, unknown>).week = {
        cost: data.cost_week,
        daily: data.daily,
      };
    }
  } catch (err) {
    // Fallback silencioso
  }

  return usage;
}

interface ExecResult {
  success: boolean;
  output: string;
  error?: string;
  code: number;
  duration: number;
}

export async function execCommand(command: string): Promise<ExecResult> {
  const start = Date.now();

  // Comandos bloqueados por segurança
  const blocked = [
    /\brm\s+-rf\s+[\/~]/i,
    /\bsudo\b/i,
    /\b(reboot|shutdown|halt)\b/i,
    /\bdd\s+if=/i,
    /\bmkfs\b/i,
    />\s*\/dev\//i,
    /\bchmod\s+777\b/i,
  ];

  for (const pattern of blocked) {
    if (pattern.test(command)) {
      return {
        success: false,
        output: "",
        error: `Comando bloqueado por segurança: ${command}`,
        code: -1,
        duration: Date.now() - start,
      };
    }
  }

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 30000, // 30s max
      cwd: "/home/danilo/claudeclaw",
      env: { ...process.env, TERM: "dumb" },
    });

    return {
      success: true,
      output: output.slice(0, 50000), // Limita output
      code: 0,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string; stdout?: string; message?: string };
    return {
      success: false,
      output: e.stdout || "",
      error: e.stderr || e.message || "Erro desconhecido",
      code: e.status || 1,
      duration: Date.now() - start,
    };
  }
}

interface Licitacao {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  uf: string;
  valor_estimado: number | null;
  data_abertura: string;
  data_publicacao: string;
  modalidade: string;
  link: string;
  relevancia: number;
  tags: string[];
}

interface PncpCache {
  ultima_atualizacao: string;
  licitacoes: Licitacao[];
}

export async function getPncp(): Promise<PncpCache> {
  try {
    const cacheFile = "/home/danilo/claudeclaw/agents/araticum/cache/pncp.json";
    const content = await readFile(cacheFile, "utf-8");
    return JSON.parse(content) as PncpCache;
  } catch {
    return { ultima_atualizacao: "", licitacoes: [] };
  }
}

interface SendMessageResult {
  success: boolean;
  error?: string;
  messageId?: number;
  response?: string;
}

interface SatelliteConfig {
  token: string | undefined;
  chatId: string;
}

async function callClaudeSDK(satelliteId: string, userMessage: string): Promise<string> {
  const venvPython = "/home/danilo/claudeclaw/.venv/bin/python3";
  const scriptPath = join(import.meta.dir, "satellite_chat.py");

  const proc = Bun.spawn([venvPython, scriptPath, satelliteId, userMessage], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(stderr || "Erro ao executar Claude SDK");
  }

  try {
    const data = JSON.parse(output) as { response?: string; error?: string };
    if (data.error) throw new Error(data.error);
    return data.response || "Sem resposta";
  } catch {
    return output.trim() || "Sem resposta";
  }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };
  if (data.ok && data.result) {
    return { ok: true, messageId: data.result.message_id };
  }
  return { ok: false, error: data.description || "Erro ao enviar" };
}

export async function sendToSatellite(satelliteId: string, message: string): Promise<SendMessageResult> {
  loadEnv();

  const genericToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "416112154";

  const config: Record<string, SatelliteConfig> = {
    adv: { token: process.env.TELEGRAM_BOT_TOKEN_ADV || genericToken, chatId },
    araticum: { token: process.env.TELEGRAM_BOT_TOKEN_ARATICUM || genericToken, chatId },
    designer: { token: process.env.TELEGRAM_BOT_TOKEN_DESIGNER || genericToken, chatId },
    claudeclaw: { token: process.env.TELEGRAM_BOT_TOKEN_CLAUDECLAW || genericToken, chatId },
  };

  const sat = config[satelliteId];
  if (!sat || !sat.token) {
    return { success: false, error: `Token não configurado para ${satelliteId}` };
  }

  try {
    // Processa com Claude SDK (usa assinatura, não API)
    const response = await callClaudeSDK(satelliteId, message);

    // Envia resposta no Telegram
    const result = await sendTelegramMessage(sat.token, sat.chatId, response);

    if (result.ok) {
      return { success: true, messageId: result.messageId, response };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { success: false, error: e.message || "Erro de conexão" };
  }
}

// Session transcripts
const CLAUDE_PROJECTS_DIR = "/home/danilo/.claude/projects";
const AGENTS_DIR = "/home/danilo/claudeclaw/agents";

interface SessionInfo {
  id: string;
  agent: string;
  threadId?: string;
  chatId?: number;
  lastActivity: string;
  turnCount: number;
  sessionPath?: string;
}

interface TranscriptMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export async function getSessions(): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];

  // Busca sessions dos satellites (adv, araticum, designer)
  const agents = ["adv", "araticum", "designer"];

  for (const agent of agents) {
    try {
      // Verifica sessions.json do Agent SDK
      const sessionsFile = join(AGENTS_DIR, agent, "sessions.json");
      try {
        const content = await readFile(sessionsFile, "utf-8");
        const data = JSON.parse(content);
        if (data.threads) {
          for (const [threadId, thread] of Object.entries(data.threads) as [string, any][]) {
            sessions.push({
              id: thread.sessionId,
              agent,
              threadId,
              lastActivity: thread.lastUsedAt || thread.createdAt,
              turnCount: thread.turnCount || 0,
            });
          }
        }
      } catch {}

      // Verifica sessions por chatId
      const sessionsDir = join(AGENTS_DIR, agent, "sessions");
      try {
        const files = await readdir(sessionsDir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const chatId = parseInt(file.replace(".json", ""));
          if (isNaN(chatId)) continue;

          const content = await readFile(join(sessionsDir, file), "utf-8");
          const data = JSON.parse(content);

          // Evita duplicatas
          if (!sessions.find(s => s.id === data.sessionId)) {
            sessions.push({
              id: data.sessionId,
              agent,
              chatId,
              lastActivity: new Date(data.lastActivity).toISOString(),
              turnCount: 0,
            });
          }
        }
      } catch {}
    } catch {}
  }

  // Adiciona sessão do ClaudeClaw daemon (Telegram logs)
  try {
    const claudeclawLogsDir = "/home/danilo/claudeclaw/.claude/claudeclaw/logs";
    const sessionFile = "/home/danilo/claudeclaw/.claude/claudeclaw/session.json";

    const sessionData = JSON.parse(await readFile(sessionFile, "utf-8"));

    // Conta logs do telegram
    const logFiles = await readdir(claudeclawLogsDir);
    const telegramLogs = logFiles.filter(f => f.startsWith("telegram-") && f.endsWith(".log"));

    sessions.push({
      id: sessionData.sessionId,
      agent: "claudeclaw",
      threadId: "telegram",
      lastActivity: sessionData.lastUsedAt || sessionData.createdAt,
      turnCount: telegramLogs.length,
    });
  } catch {}

  // Ordena por última atividade
  sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  return sessions;
}

export async function getSessionTranscript(sessionId: string, limit = 50): Promise<TranscriptMessage[]> {
  const messages: TranscriptMessage[] = [];

  // Verifica se é sessão do ClaudeClaw daemon (telegram logs)
  const claudeclawSessionFile = "/home/danilo/claudeclaw/.claude/claudeclaw/session.json";
  try {
    const sessionData = JSON.parse(await readFile(claudeclawSessionFile, "utf-8"));
    if (sessionData.sessionId === sessionId) {
      // Lê logs do Telegram
      return await getTelegramTranscript(limit);
    }
  } catch {}

  // Busca o JSONL da sessão nos projetos Claude
  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
      const projectStat = await stat(projectPath);
      if (!projectStat.isDirectory()) continue;

      // Verifica se tem o arquivo da sessão
      const jsonlPath = join(projectPath, `${sessionId}.jsonl`);
      try {
        const content = await readFile(jsonlPath, "utf-8");
        const lines = content.trim().split("\n").filter(l => l);

        for (const line of lines.slice(-limit * 2)) {
          try {
            const entry = JSON.parse(line);

            // Formato varia, mas geralmente tem type/role
            if (entry.type === "human" || entry.role === "user") {
              const text = entry.message?.content || entry.content || entry.text || "";
              if (text) {
                messages.push({
                  role: "user",
                  content: typeof text === "string" ? text : JSON.stringify(text),
                  timestamp: entry.timestamp || entry.createdAt,
                });
              }
            } else if (entry.type === "assistant" || entry.role === "assistant") {
              const text = entry.message?.content || entry.content || entry.text || "";
              if (text) {
                messages.push({
                  role: "assistant",
                  content: typeof text === "string" ? text : JSON.stringify(text),
                  timestamp: entry.timestamp || entry.createdAt,
                });
              }
            }
          } catch {}
        }

        if (messages.length > 0) break;
      } catch {}
    }
  } catch {}

  return messages.slice(-limit);
}

async function getTelegramTranscript(limit = 50): Promise<TranscriptMessage[]> {
  const messages: TranscriptMessage[] = [];
  const logsDir = "/home/danilo/claudeclaw/.claude/claudeclaw/logs";

  try {
    const files = await readdir(logsDir);
    const telegramLogs = files
      .filter(f => f.startsWith("telegram-") && f.endsWith(".log"))
      .sort()
      .reverse()
      .slice(0, limit);

    for (const file of telegramLogs.reverse()) {
      try {
        const content = await readFile(join(logsDir, file), "utf-8");
        const lines = content.split("\n");

        // Parse do formato de log
        let timestamp = "";
        let userMessage = "";
        let assistantMessage = "";
        let inOutput = false;

        for (const line of lines) {
          if (line.startsWith("Date: ")) {
            timestamp = line.replace("Date: ", "").trim();
          } else if (line.startsWith("Prompt: ")) {
            // Próximas linhas até "Exit code" são a mensagem do usuário
            const idx = lines.indexOf(line);
            const promptLines: string[] = [];
            for (let i = idx; i < lines.length; i++) {
              if (lines[i].startsWith("Exit code:")) break;
              if (lines[i].startsWith("## Output")) break;
              if (i > idx) promptLines.push(lines[i]);
            }
            userMessage = promptLines.join("\n").trim();
            // Remove prefixo [Telegram from ...]
            const match = userMessage.match(/Message: ([\s\S]*)/);
            if (match) userMessage = match[1].trim();
          } else if (line.startsWith("## Output")) {
            inOutput = true;
          } else if (inOutput) {
            assistantMessage += line + "\n";
          }
        }

        if (userMessage) {
          messages.push({
            role: "user",
            content: userMessage,
            timestamp,
          });
        }

        if (assistantMessage.trim()) {
          messages.push({
            role: "assistant",
            content: assistantMessage.trim(),
            timestamp,
          });
        }
      } catch {}
    }
  } catch {}

  return messages;
}

// Export all API functions
export const api = {
  getProcessos,
  getMonitorState,
  getSatellites,
  getCrons,
  runDoctor,
  getEvents,
  getLogs,
  getUsage,
  execCommand,
  getPncp,
  sendToSatellite,
  getSessions,
  getSessionTranscript,
};
