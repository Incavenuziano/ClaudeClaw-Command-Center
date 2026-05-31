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

// Normaliza model ID completo → label curto pra UI (claude-opus-4-8 → opus-4.8)
function shortModelLabel(model: string | undefined): string {
  if (!model) return "—";
  const m = model.toLowerCase();
  const match = m.match(/(opus|sonnet|haiku)[-]?(\d+)[-.](\d+)/);
  if (match) return `${match[1]}-${match[2]}.${match[3]}`;
  // Aliases simples ("opus", "sonnet")
  if (m === "opus") return "opus";
  if (m === "sonnet") return "sonnet";
  if (m === "haiku") return "haiku";
  return model;
}

// Lê o modelo configurado de cada agente/daemon a partir do config.json/settings.json
function readSatelliteModel(id: string): string {
  try {
    if (id === "claudeclaw") {
      const settings = JSON.parse(
        require("fs").readFileSync("/home/danilo/claudeclaw/.claude/claudeclaw/settings.json", "utf-8")
      );
      return shortModelLabel(settings.model);
    }
    const cfg = JSON.parse(
      require("fs").readFileSync(`/home/danilo/claudeclaw/agents/${id}/config.json`, "utf-8")
    );
    return shortModelLabel(cfg.model);
  } catch {
    return "—";
  }
}

export async function getSatellites(): Promise<SatelliteStatus[]> {
  loadEnv();

  const satellites: SatelliteStatus[] = [
    { id: "adv", name: "ADV Danilo", bot: "@Adv_Danilo_bot", status: "offline", model: readSatelliteModel("adv") },
    { id: "araticum", name: "Araticum", bot: "@Araticum_bot", status: "offline", model: readSatelliteModel("araticum") },
    { id: "designer", name: "Designer", bot: "@Designer_bot", status: "offline", model: readSatelliteModel("designer") },
    { id: "claudeclaw", name: "ClaudeClaw", bot: "@ClaudeClaw_Danbot", status: "offline", model: readSatelliteModel("claudeclaw") },
  ];

  // 1) Detecta processos rodando (verdade absoluta).
  // Filtra shells bash que apenas contêm a string como argumento de -c.
  let lines: string[] = [];
  try {
    const psOut = execSync("ps -eo pid,comm,args 2>/dev/null", { encoding: "utf-8", timeout: 3000 });
    lines = psOut.split("\n").filter(l => {
      // Ignora linhas onde o binário é bash/sh (shells de orquestração)
      const parts = l.trim().split(/\s+/);
      const comm = parts[1] || "";
      return comm !== "bash" && comm !== "sh" && comm !== "zsh";
    });
  } catch {}

  for (const sat of satellites) {
    const matches = (re: RegExp) => lines.some(l => re.test(l));
    if (sat.id === "claudeclaw") {
      if (matches(/claudeclaw\/claudeclaw\/[\d.]+\/src\/index\.ts.*start/)) {
        sat.status = "online";
      }
    } else {
      // Aceita ambas as versões: satellite-session.ts (atual) e satellite.ts (legado)
      const re = new RegExp(`src/satellite(-session)?\\.ts\\s+${sat.id}\\b`);
      if (matches(re)) sat.status = "online";
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

// Mapeia trechos do comando → nome amigável + id estável
function inferCronMeta(command: string): { name: string; id: string } {
  const map: Array<[RegExp, string, string]> = [
    [/monitor-processos/, "Monitor Processos", "cr_monitor"],
    [/pncp-scan|pncp\.ts|varredura.*pncp/i, "Varredura PNCP", "cr_pncp"],
    [/inteligencia_competitiva/, "Inteligência Competitiva", "cr_ic"],
    [/siged/i, "SIGED (SEFAZ-AM)", "cr_siged"],
    [/prazos/i, "Prazos Jurídicos", "cr_prazos"],
    [/satellites_ensure/, "Watchdog Satellites", "cr_watchdog"],
    [/satellites_session_health/, "Health Sessions", "cr_health"],
    [/memory-optimizer/, "Otimizador de Memória", "cr_memopt"],
    [/memory_ttl/, "Memory TTL", "cr_memttl"],
    [/quality_eval/, "Avaliação de Qualidade", "cr_quality"],
    [/vault_reindex/, "Reindex Vault", "cr_vault"],
    [/backup/i, "Backup", "cr_backup"],
  ];
  for (const [re, name, id] of map) {
    if (re.test(command)) return { name, id };
  }
  return { name: "Job desconhecido", id: "" };
}

// Extrai o caminho do arquivo de log do redirecionamento (>> path 2>&1)
// Aceita .log, .txt, .jsonl — qualquer destino de redirect
function extractLogPath(command: string): string | null {
  const m = command.match(/>>?\s*(\S+\.(?:log|txt|jsonl|out))\b/);
  return m ? m[1] : null;
}

// Lê mtime + escaneia tail do log pra derivar lastRun e lastStatus reais
function readCronRunState(logPath: string | null): { lastRun?: string; lastStatus: "ok" | "err" | "warn" } {
  if (!logPath) return { lastStatus: "warn" };
  try {
    const fs = require("fs");
    const st = fs.statSync(logPath);
    const lastRun = new Date(st.mtimeMs).toISOString();

    // Log vazio = nunca produziu saída útil
    if (st.size === 0) return { lastRun, lastStatus: "warn" };

    // Escaneia as últimas linhas. Prioriza marcadores explícitos de veredito
    // (job-runner emite "✅ sucesso" / "🔴 Job falhou") sobre heurística de palavras.
    const rawTail = execSync(`tail -30 "${logPath}" 2>/dev/null`, { encoding: "utf-8" });
    const tail = rawTail.toLowerCase();

    // 1) Veredito explícito do job-runner ou do próprio job (última ocorrência vence)
    const lastSuccess = Math.max(
      tail.lastIndexOf("✅ sucesso"),
      tail.lastIndexOf("🏁 monitoramento concluído"),
      tail.lastIndexOf("monitoramento concluído"),
    );
    const lastFailure = Math.max(
      tail.lastIndexOf("🔴 job falhou"),
      tail.lastIndexOf("job falhou"),
    );
    if (lastSuccess >= 0 || lastFailure >= 0) {
      return { lastRun, lastStatus: lastFailure > lastSuccess ? "err" : "ok" };
    }

    // 2) Sem veredito explícito → heurística de palavras
    const errSignals = /(error|erro|traceback|exception|failed|falhou|exit code [1-9]|❌|🔴|no such file|modulenotfound|timeout)/;
    const warnSignals = /(warn|aviso|retry|tentativa|skip|⚠)/;
    if (errSignals.test(tail)) return { lastRun, lastStatus: "err" };
    if (warnSignals.test(tail)) return { lastRun, lastStatus: "warn" };
    return { lastRun, lastStatus: "ok" };
  } catch {
    return { lastStatus: "warn" }; // log não existe → nunca rodou
  }
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

        const meta = inferCronMeta(command);
        const id = meta.id || `cron_${crons.length}`;
        const logPath = extractLogPath(command);
        const runState = readCronRunState(logPath);

        crons.push({
          id,
          name: meta.name,
          schedule,
          command,
          enabled: true, // está no crontab ativo
          lastRun: runState.lastRun,
          lastStatus: runState.lastStatus,
        });
      }
    }
  } catch {}

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
# Timestamps no DB são UTC. Danilo está em Brasília (UTC-3): calcula "hoje" em BSB
# e converte timestamp UTC→BSB no SQL antes de extrair a data.
from datetime import datetime, timezone
BSB = timezone(timedelta(hours=-3))
now_bsb = datetime.now(BSB)
today = now_bsb.date().isoformat()
week_start = (now_bsb.date() - timedelta(days=6)).isoformat()

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
    FROM turns WHERE substr(datetime(timestamp, '-3 hours'), 1, 10) = ? GROUP BY model
""", (today,)).fetchall()

today_sessions = conn.execute("""
    SELECT COUNT(DISTINCT session_id) FROM turns WHERE substr(datetime(timestamp, '-3 hours'), 1, 10) = ?
""", (today,)).fetchone()[0]

# Week stats by day and model (para cálculo correto de custo)
week_by_day_model = conn.execute("""
    SELECT substr(datetime(timestamp, '-3 hours'), 1, 10) as day, model, SUM(input_tokens) as inp, SUM(output_tokens) as out,
           SUM(cache_read_tokens) as cr, SUM(cache_creation_tokens) as cc
    FROM turns WHERE substr(datetime(timestamp, '-3 hours'), 1, 10) BETWEEN ? AND ?
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

interface SatelliteSessionHealth {
  agent: string;
  sessionId: string | null;
  sessionIdShort: string | null;
  ageHours: number | null;
  ttlRemainingDays: number | null;
  turns24h: number;
  recovered24h: number;
  status: "ok" | "warning" | "expired" | "no_session";
  lastActivity: number | null;
}

const SESSION_TTL_DAYS = 7;
const SESSION_WARNING_DAYS = 5;

export async function getSatellitesSessions(): Promise<SatelliteSessionHealth[]> {
  const agents = ["adv", "araticum", "designer"];
  const danilo = 416112154;
  const out: SatelliteSessionHealth[] = [];

  for (const agent of agents) {
    const agentDir = `/home/danilo/claudeclaw/agents/${agent}`;
    const sessionFile = `${agentDir}/sessions/${danilo}.json`;
    const logFile = `${agentDir}/logs/sessions.jsonl`;

    const entry: SatelliteSessionHealth = {
      agent,
      sessionId: null,
      sessionIdShort: null,
      ageHours: null,
      ttlRemainingDays: null,
      turns24h: 0,
      recovered24h: 0,
      status: "no_session",
      lastActivity: null,
    };

    try {
      const raw = await readFile(sessionFile, "utf-8");
      const state = JSON.parse(raw) as { sessionId?: string; lastActivity?: number };
      if (state.sessionId) {
        entry.sessionId = state.sessionId;
        entry.sessionIdShort = state.sessionId.slice(0, 8);
        if (state.lastActivity) {
          entry.lastActivity = state.lastActivity;
          const ageMs = Date.now() - state.lastActivity;
          entry.ageHours = Math.round((ageMs / 3600000) * 10) / 10;
          const ageDays = ageMs / 86400000;
          entry.ttlRemainingDays = Math.round((SESSION_TTL_DAYS - ageDays) * 10) / 10;
          if (ageDays >= SESSION_TTL_DAYS) {
            entry.status = "expired";
          } else if (ageDays >= SESSION_WARNING_DAYS) {
            entry.status = "warning";
          } else {
            entry.status = "ok";
          }
        }
      }
    } catch {
      // sem session file → status: no_session
    }

    // Conta turnos das últimas 24h via JSONL
    try {
      const log = await readFile(logFile, "utf-8");
      const cutoff = Date.now() - 24 * 3600000;
      const lines = log.trim().split("\n").slice(-500);
      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          if (ev.event !== "turn") continue;
          const ts = new Date(ev.timestamp).getTime();
          if (ts < cutoff) continue;
          entry.turns24h++;
          if (ev.recovered) entry.recovered24h++;
        } catch {}
      }
    } catch {
      // sem log
    }

    out.push(entry);
  }

  return out;
}

interface RateLimitWindow {
  tokens: number;
  limit: number;
  pressure: number;     // 0-1
  pressurePct: number;  // 0-100
  status: "ok" | "warning" | "critical";
  resetAt: string;      // ISO timestamp da próxima reset
  // ── extras (ADR-006) ──
  opusTokens: number;        // quanto do consumo é Opus
  burnRatePerMin: number;    // tokens/min recentes
  etaMinutes: number | null; // min até bater o limite no ritmo atual
  limitSource: "calibrated" | "p90" | "tier";  // origem do denominador
  calibratedAgeHours: number | null;           // idade da última calibração
}

interface RateLimitInfo {
  tier: string;
  five_hour: RateLimitWindow;
  weekly: RateLimitWindow;
  source: "calibrated" | "p90" | "estimate";
}

// Calibrado em 2026-05-17 com Danilo: 1.26M = 24% (5h), 15.1M = 11% (semana)
const TIER_LIMITS: Record<string, { fiveHour: number; weekly: number }> = {
  "default_claude_pro":    { fiveHour: 1_000_000,   weekly: 30_000_000  },
  "default_claude_max_5x": { fiveHour: 5_200_000,   weekly: 137_000_000 },
  "default_claude_max_20x":{ fiveHour: 20_800_000,  weekly: 548_000_000 },
};

function statusFromPressure(p: number): "ok" | "warning" | "critical" {
  return p < 0.5 ? "ok" : p < 0.8 ? "warning" : "critical";
}

const USAGE_DB = "/home/danilo/.claude/usage.db";

function sqliteRL(query: string): string {
  try {
    return execSync(`sqlite3 ${USAGE_DB} ${JSON.stringify(query)}`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

function ensureCalibrationTable(): void {
  sqliteRL(
    "CREATE TABLE IF NOT EXISTS rate_limit_calibration (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, window TEXT NOT NULL, " +
    "pct_real REAL NOT NULL, tokens_calc INTEGER NOT NULL, created_at TEXT NOT NULL)"
  );
}

// Calibração mais recente de uma janela → limite derivado + idade (horas)
function readCalibration(window: "5h" | "week"): { limit: number; ageHours: number } | null {
  const row = sqliteRL(
    `SELECT pct_real, tokens_calc, created_at FROM rate_limit_calibration ` +
    `WHERE window='${window}' ORDER BY created_at DESC LIMIT 1`
  );
  if (!row) return null;
  const [pctStr, tokStr, createdAt] = row.split("|");
  const pct = parseFloat(pctStr);
  const tok = parseInt(tokStr, 10);
  if (!pct || pct <= 0 || !tok) return null;
  return {
    limit: Math.round(tok / (pct / 100)),
    ageHours: (Date.now() - new Date(createdAt).getTime()) / 3600000,
  };
}

// P90 do histórico de 8 dias (denominador aprendido)
function p90Limit(window: "5h" | "week"): number | null {
  const bucket =
    window === "5h"
      ? "CAST(strftime('%s', timestamp) / 18000 AS INT)"
      : "strftime('%Y-%W', timestamp)";
  const out = sqliteRL(
    `SELECT ROUND(SUM(input_tokens)+SUM(output_tokens)+SUM(cache_creation_tokens)*0.8) AS t ` +
    `FROM turns WHERE datetime(timestamp) > datetime('now','-8 days') GROUP BY ${bucket} ORDER BY t`
  );
  if (!out) return null;
  const vals = out.split("\n").map((v) => parseFloat(v)).filter((v) => v > 0);
  if (vals.length < 3) return null;
  return Math.round(vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))]);
}

// Escolhe o melhor denominador: calibração fresca > P90 > tier fixo
function resolveLimit(
  window: "5h" | "week",
  tierLimit: number
): { limit: number; source: "calibrated" | "p90" | "tier"; ageHours: number | null } {
  const maxAge = window === "5h" ? 48 : 24 * 7; // calibração decai
  const cal = readCalibration(window);
  if (cal && cal.ageHours <= maxAge) {
    return { limit: cal.limit, source: "calibrated", ageHours: cal.ageHours };
  }
  const p90 = p90Limit(window);
  if (p90 && p90 > 0) return { limit: p90, source: "p90", ageHours: null };
  return { limit: tierLimit, source: "tier", ageHours: null };
}

// Burn-rate (tokens/min) numa janela curta + ETA até o limite
function burnAndEta(windowMinutes: number, tokensNow: number, limit: number): { burn: number; eta: number | null } {
  const out = sqliteRL(
    `SELECT COALESCE(ROUND(SUM(input_tokens)+SUM(output_tokens)+SUM(cache_creation_tokens)*0.8),0) ` +
    `FROM turns WHERE datetime(timestamp) > datetime('now','-${windowMinutes} minutes')`
  );
  const recent = parseFloat(out) || 0;
  const burn = recent / windowMinutes;
  if (burn <= 0) return { burn: 0, eta: null };
  const remaining = limit - tokensNow;
  if (remaining <= 0) return { burn: Math.round(burn), eta: 0 };
  return { burn: Math.round(burn), eta: Math.round(remaining / burn) };
}

// Conta tokens só de Opus numa janela
function opusTokensIn(sinceClause: string): number {
  const out = sqliteRL(
    `SELECT COALESCE(ROUND(SUM(input_tokens)+SUM(output_tokens)+SUM(cache_creation_tokens)*0.8),0) ` +
    `FROM turns WHERE datetime(timestamp) > ${sinceClause} AND lower(model) LIKE '%opus%'`
  );
  return Math.round(parseFloat(out)) || 0;
}

// Grava um ponto de calibração (ADR-006)
export function recordCalibration(window: "5h" | "week", pctReal: number, tokensCalc: number): void {
  ensureCalibrationTable();
  const now = new Date().toISOString();
  sqliteRL(
    `INSERT INTO rate_limit_calibration (window, pct_real, tokens_calc, created_at) ` +
    `VALUES ('${window}', ${pctReal}, ${tokensCalc}, '${now}')`
  );
}

function nextWedAt7h(): Date {
  const now = new Date();
  // weekday: 0=Sun ... 3=Wed
  const daysUntilWed = (3 - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilWed);
  next.setHours(7, 0, 0, 0);
  // se hoje é quarta antes das 7h, próxima reset é hoje
  if (now.getDay() === 3 && now.getHours() < 7) {
    next.setDate(now.getDate());
  }
  return next;
}

function lastWedAt7h(): Date {
  const now = new Date();
  const daysSinceWed = (now.getDay() - 3 + 7) % 7;
  const last = new Date(now);
  last.setDate(now.getDate() - daysSinceWed);
  last.setHours(7, 0, 0, 0);
  if (last > now) last.setDate(last.getDate() - 7);
  return last;
}

export async function getRateLimit(): Promise<RateLimitInfo> {
  let tier = "default_claude_max_5x";
  try {
    const credsRaw = await readFile("/home/danilo/.claude/.credentials.json", "utf-8");
    const creds = JSON.parse(credsRaw);
    tier = creds?.claudeAiOauth?.rateLimitTier || tier;
  } catch {}

  const limits = TIER_LIMITS[tier] || TIER_LIMITS["default_claude_max_5x"];

  function countTokens(sinceClause: string): number {
    // Anthropic não documenta a fórmula exata para rate limit.
    // Calibrado com Danilo em 2026-05-17: input + output + 0.8*cache_creation
    // bate aproximadamente com o painel oficial (±5pp).
    try {
      const out = execSync(
        `sqlite3 /home/danilo/.claude/usage.db "SELECT COALESCE(ROUND(SUM(input_tokens) + SUM(output_tokens) + SUM(cache_creation_tokens) * 0.8), 0) FROM turns WHERE datetime(timestamp) > ${sinceClause}"`,
        { encoding: "utf-8", timeout: 5000 }
      );
      return Math.round(parseFloat(out.trim())) || 0;
    } catch {
      return 0;
    }
  }

  ensureCalibrationTable();

  const fiveHourSince = `datetime('now', '-5 hours')`;
  const tokens5h = countTokens(fiveHourSince);
  const lastWed = lastWedAt7h();
  const weekStart = lastWed.toISOString().replace("T", " ").substring(0, 19);
  const weekSince = `datetime('${weekStart}')`;
  const tokensWeek = countTokens(weekSince);

  // Denominador: calibração fresca > P90 > tier (ADR-006)
  const lim5h = resolveLimit("5h", limits.fiveHour);
  const limWeek = resolveLimit("week", limits.weekly);

  const p5h = Math.min(1, tokens5h / lim5h.limit);
  const pWeek = Math.min(1, tokensWeek / limWeek.limit);

  // Burn-rate: 30min pro 5h, 6h pro semanal
  const burn5h = burnAndEta(30, tokens5h, lim5h.limit);
  const burnWeek = burnAndEta(360, tokensWeek, limWeek.limit);

  const fiveHourReset = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
  const weeklyReset = nextWedAt7h().toISOString();

  const rank = { calibrated: 3, p90: 2, tier: 1 } as const;
  const best = rank[lim5h.source] >= rank[limWeek.source] ? lim5h.source : limWeek.source;
  const overallSource = best === "tier" ? "estimate" : best;

  return {
    tier,
    five_hour: {
      tokens: tokens5h,
      limit: lim5h.limit,
      pressure: p5h,
      pressurePct: Math.round(p5h * 100),
      status: statusFromPressure(p5h),
      resetAt: fiveHourReset,
      opusTokens: opusTokensIn(fiveHourSince),
      burnRatePerMin: burn5h.burn,
      etaMinutes: burn5h.eta,
      limitSource: lim5h.source,
      calibratedAgeHours: lim5h.ageHours === null ? null : Math.round(lim5h.ageHours * 10) / 10,
    },
    weekly: {
      tokens: tokensWeek,
      limit: limWeek.limit,
      pressure: pWeek,
      pressurePct: Math.round(pWeek * 100),
      status: statusFromPressure(pWeek),
      resetAt: weeklyReset,
      opusTokens: opusTokensIn(weekSince),
      burnRatePerMin: burnWeek.burn,
      etaMinutes: burnWeek.eta,
      limitSource: limWeek.source,
      calibratedAgeHours: limWeek.ageHours === null ? null : Math.round(limWeek.ageHours * 10) / 10,
    },
    source: overallSource,
  };
}

interface ProjectUsage {
  project: string;       // ex: "claudeclaw", "claudeclaw/dashboard", "claude-mem/observer"
  turns: number;
  tokens: number;        // input + output + 0.8*cache_creation (mesma fórmula do rate-limit)
  pctOfTotal: number;    // % da janela 5h
}

export async function getUsageByProject(): Promise<{ window: "5h"; projects: ProjectUsage[]; totalTokens: number }> {
  const query = `SELECT
    COALESCE(NULLIF(cwd, ''), 'unknown') AS proj,
    COUNT(*) as turns,
    ROUND(SUM(input_tokens) + SUM(output_tokens) + SUM(cache_creation_tokens) * 0.8) AS tokens
  FROM turns
  WHERE datetime(timestamp) > datetime('now', '-5 hours')
  GROUP BY proj
  ORDER BY tokens DESC`;

  let projects: ProjectUsage[] = [];
  let totalTokens = 0;
  try {
    const out = execSync(
      `sqlite3 -json /home/danilo/.claude/usage.db "${query}"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const rows = JSON.parse(out || "[]") as Array<{ proj: string; turns: number; tokens: number }>;
    totalTokens = rows.reduce((s, r) => s + (r.tokens || 0), 0) || 1;
    projects = rows.map(r => ({
      project: friendlyProjectName(r.proj),
      turns: r.turns,
      tokens: r.tokens || 0,
      pctOfTotal: Math.round(((r.tokens || 0) / totalTokens) * 100),
    }));
  } catch {}

  return { window: "5h", projects, totalTokens };
}

function friendlyProjectName(cwd: string): string {
  if (!cwd || cwd === "unknown") return "desconhecido";
  // Normaliza path → nome curto
  const norm = cwd.replace(/^\/home\/[^/]+\//, "").replace(/^\.claude-mem\//, "claude-mem/");
  if (norm.includes("observer-sessions")) return "claude-mem (observer)";
  if (norm === "claudeclaw") return "claudeclaw (principal)";
  if (norm === "claudeclaw/dashboard") return "claudeclaw (dashboard)";
  return norm;
}

// Calibra uma janela: calcula tokens atuais e grava o ponto (ADR-006)
export async function calibrateRateLimit(
  window: "5h" | "week",
  pctReal: number
): Promise<{ ok: true; window: string; pct: number; tokens: number; derivedLimit: number }> {
  function count(since: string): number {
    const out = sqliteRL(
      `SELECT COALESCE(ROUND(SUM(input_tokens)+SUM(output_tokens)+SUM(cache_creation_tokens)*0.8),0) ` +
      `FROM turns WHERE datetime(timestamp) > ${since}`
    );
    return Math.round(parseFloat(out)) || 0;
  }
  let tokens: number;
  if (window === "5h") {
    tokens = count(`datetime('now', '-5 hours')`);
  } else {
    const ws = lastWedAt7h().toISOString().replace("T", " ").substring(0, 19);
    tokens = count(`datetime('${ws}')`);
  }
  recordCalibration(window, pctReal, tokens);
  return {
    ok: true,
    window,
    pct: pctReal,
    tokens,
    derivedLimit: Math.round(tokens / (pctReal / 100)),
  };
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
  getRateLimit,
  getUsageByProject,
  getSatellitesSessions,
  execCommand,
  getPncp,
  sendToSatellite,
  getSessions,
  getSessionTranscript,
  calibrateRateLimit,
};
