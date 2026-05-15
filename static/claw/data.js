/* ClaudeClaw Command Center — data layer
   Dados reais via API + fallback mock */

const NOW = new Date();
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

function formatSaoPauloTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${lookup.hour}:${lookup.minute}:${lookup.second} BRT`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

window.CC_TIME = {
  formatSaoPauloTime,
  formatDate,
  timeZone: SAO_PAULO_TIMEZONE,
};

// Agentes do ecossistema ClaudeClaw (estático por enquanto)
const agents = [
  { id: 'claudeclaw', role: 'orchestrator', status: 'active', lastSeen: 'agora', model: 'claude-opus-4.5', sessions: 1, tokens24h: 0, cost24h: 0, avatar: 'CC', description: 'Agente principal, coordena satellites e plugins' },
  { id: 'adv-danilo', role: 'satellite', status: 'unknown', lastSeen: '—', model: 'claude-opus-4.7', sessions: 0, tokens24h: 0, cost24h: 0, avatar: 'AD', description: 'BR-Litigation — contencioso brasileiro' },
  { id: 'araticum', role: 'satellite', status: 'unknown', lastSeen: '—', model: 'claude-opus-4.7', sessions: 0, tokens24h: 0, cost24h: 0, avatar: 'AR', description: 'Consultoria em licitações públicas' },
  { id: 'designer', role: 'satellite', status: 'unknown', lastSeen: '—', model: 'claude-opus-4.7', sessions: 0, tokens24h: 0, cost24h: 0, avatar: 'DS', description: 'Satellite Telegram — design e criação' },
  { id: 'monitor-processos', role: 'cron', status: 'idle', lastSeen: '—', model: 'bun-runtime', sessions: 0, tokens24h: 0, cost24h: 0, avatar: 'MP', description: 'Job automático — monitora DataJud/PJe' },
];

// Sessões ativas (estático por enquanto)
const sessions = [
  { id: 'sess_claw01', agent: 'claudeclaw', status: 'active', platform: 'cli', title: 'Sessão atual', msgs: 0, started: formatSaoPauloTime(), tokens: 0 },
];

// Transcrição mock
const transcript = [
  { role: 'user', name: 'danilo', time: formatSaoPauloTime(), content: 'Todos os dados do command center são reais?' },
  { role: 'agent', name: 'claudeclaw', time: formatSaoPauloTime(), content: 'Vou integrar dados reais dos processos, satellites e doctor...' },
];

// Eventos (carregados via API)
let events = [
  { t: formatSaoPauloTime(), kind: 'loading', source: 'dashboard', title: 'Carregando eventos...', tone: '', detail: '' },
];

// Approvals pendentes
const approvals = [];

// Usage (carregado via API)
const usage = {
  today: { tokens: 0, cost: 0, budget: 0, sessions: 0, requests: 0 },
  session: { input_tokens: 0, output_tokens: 0, cache_creation: 0, cache_read: 0, messages: 0, cost_estimate: 0 },
  breaker: { tripped: false, maxCost: 0, maxTokens: 0 },
  agents: [],
  hourly: [],
};

// Memory scopes (estático)
const memory = [
  { scope: 'user.danilo', preview: 'Advogado OAB/DF 59.724, fundador Araticum', updated: '14/05/2026' },
  { scope: 'project.br-litigation', preview: 'Processos monitorados via PJe+DataJud', updated: '14/05/2026' },
  { scope: 'project.araticum', preview: 'Consultoria em licitações', updated: '14/05/2026' },
  { scope: 'infra.claudeclaw', preview: 'WSL Ubuntu, Tailscale, pgvector', updated: '14/05/2026' },
];

// Files relevantes (estático)
const files = [
  { path: 'CLAUDE.md', size: '1.2 KB', updated: '14/05/2026', preview: 'Identidade e regras do ClaudeClaw' },
  { path: 'agents/br-litigation/CLAUDE.md', size: '8.4 KB', updated: '14/05/2026', preview: 'Plugin contencioso brasileiro' },
  { path: 'src/jobs/monitor-processos.ts', size: '10.2 KB', updated: '14/05/2026', preview: 'Monitor DataJud + PJe' },
];

// Logs (carregados via API)
let logs = [
  { level: 'info', t: formatSaoPauloTime(), source: 'dashboard', msg: 'Carregando logs...' },
];

// System health (estático)
const systemHealth = {
  env: 'development',
  bind: '0.0.0.0:3000',
  auth: 'local-only',
  uptime: '—',
  version: 'claudeclaw/0.1.0',
};

// Dados dinâmicos (preenchidos via API)
let processos = [];
let cron = [];
let doctor = [];
let satellites = [];
let monitorState = null;
let pncp = { ultima_atualizacao: null, licitacoes: [] };

// Estado de loading e callbacks
let isRefreshing = false;
let lastRefresh = null;
let refreshListeners = [];

function notifyListeners(state) {
  refreshListeners.forEach(fn => {
    try { fn(state); } catch (e) { console.error('[CC] Listener error:', e); }
  });
}

// Função para buscar dados reais da API
async function fetchRealData() {
  if (isRefreshing) return;
  isRefreshing = true;
  notifyListeners({ refreshing: true, lastRefresh });

  try {
    const [processosRes, cronsRes, doctorRes, satellitesRes, monitorRes, eventsRes, logsRes, usageRes, pncpRes] = await Promise.all([
      fetch('/api/processos').then(r => r.json()).catch(() => []),
      fetch('/api/crons').then(r => r.json()).catch(() => []),
      fetch('/api/doctor').then(r => r.json()).catch(() => []),
      fetch('/api/satellites').then(r => r.json()).catch(() => []),
      fetch('/api/monitor-state').then(r => r.json()).catch(() => null),
      fetch('/api/events').then(r => r.json()).catch(() => []),
      fetch('/api/logs').then(r => r.json()).catch(() => []),
      fetch('/api/usage').then(r => r.json()).catch(() => null),
      fetch('/api/pncp').then(r => r.json()).catch(() => ({ ultima_atualizacao: null, licitacoes: [] })),
    ]);

    // Processos
    processos = processosRes.map(p => ({
      numero: p.numero,
      cliente: p.cliente,
      adverso: p.adverso,
      tribunal: p.tribunal,
      fase: p.fase,
      polo: p.polo,
      status: p.monitoramento === false ? (p.motivo_nao_monitorado || 'não monitorado') : 'ativo',
      ultimaMov: formatDate(p.ultimaMovimentacao),
      descricaoMov: p.descricaoMov || '—',
      novidades: false,
    }));

    // Crons
    cron = cronsRes.map(c => ({
      id: c.id,
      name: c.name,
      schedule: c.schedule,
      next: calcNextRun(c.schedule),
      last: c.lastStatus || 'ok',
      enabled: c.enabled,
      duration: '—',
    }));

    // Doctor
    doctor = doctorRes;

    // Satellites
    satellites = satellitesRes.map(s => ({
      id: s.id,
      name: s.bot,
      status: s.status,
      lastMsg: s.lastActivity || '—',
      msgs24h: 0,
    }));

    // Monitor state
    monitorState = monitorRes;

    // Events (observations)
    if (eventsRes && eventsRes.length > 0) {
      events = eventsRes;
    }

    // Logs
    if (logsRes && logsRes.length > 0) {
      logs = logsRes;
    }

    // Usage
    if (usageRes) {
      usage.today.tokens = usageRes.today?.tokens || 0;
      usage.today.cost = usageRes.today?.cost || 0;
      usage.today.sessions = usageRes.today?.sessions || 0;
      usage.session = usageRes.session || {};
    }
    if (monitorState?.ultima_verificacao) {
      const lastCheck = new Date(monitorState.ultima_verificacao);
      const agent = agents.find(a => a.id === 'monitor-processos');
      if (agent) {
        const hoursAgo = Math.round((Date.now() - lastCheck.getTime()) / 3600000);
        agent.lastSeen = hoursAgo < 1 ? 'agora' : `${hoursAgo}h atrás`;
      }
    }

    // Atualizar satellites nos agents
    for (const sat of satellites) {
      const agent = agents.find(a => a.id === sat.id || a.id === sat.id.replace('-bot', ''));
      if (agent) {
        agent.status = sat.status;
        agent.lastSeen = sat.lastMsg;
      }
    }

    // PNCP
    pncp = pncpRes || { ultima_atualizacao: null, licitacoes: [] };

    console.log('[CC] Dados reais carregados:', {
      processos: processos.length,
      crons: cron.length,
      doctor: doctor.length,
      satellites: satellites.length,
      licitacoes: pncp.licitacoes?.length || 0,
    });

    lastRefresh = new Date();
    isRefreshing = false;
    notifyListeners({ refreshing: false, lastRefresh, success: true });

  } catch (err) {
    console.error('[CC] Erro ao carregar dados:', err);
    isRefreshing = false;
    notifyListeners({ refreshing: false, lastRefresh, success: false, error: err.message });
  }
}

function calcNextRun(schedule) {
  // Simplificado: retorna descrição do schedule
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  const [min, hour, dom, mon, dow] = parts;
  const days = { '1-5': 'seg-sex', '*': 'todo dia', '1': 'seg', '0': 'dom' };
  return `${hour.padStart(2, '0')}:${min.padStart(2, '0')} BRT (${days[dow] || dow})`;
}

// Carregar dados na inicialização
fetchRealData();

// Recarregar a cada 30 segundos
setInterval(fetchRealData, 30000);

// Exportar dados (getter para sempre pegar versão atualizada)
window.CC_DATA = {
  get agents() { return agents; },
  get sessions() { return sessions; },
  get transcript() { return transcript; },
  get processos() { return processos; },
  get cron() { return cron; },
  get events() { return events; },
  get approvals() { return approvals; },
  get usage() { return usage; },
  get memory() { return memory; },
  get files() { return files; },
  get logs() { return logs; },
  get doctor() { return doctor; },
  get systemHealth() { return systemHealth; },
  get satellites() { return satellites; },
  get monitorState() { return monitorState; },
  get pncp() { return pncp; },
  get isRefreshing() { return isRefreshing; },
  get lastRefresh() { return lastRefresh; },
  refresh: fetchRealData,
  subscribe: (fn) => {
    refreshListeners.push(fn);
    return () => { refreshListeners = refreshListeners.filter(f => f !== fn); };
  },
};
