/* ClaudeClaw Command Center — Layout (Sidebar + Topbar) */
const NAV = [
  { sector: 'Core', items: [
    { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', badge: null },
    { key: 'activity',  icon: 'activity',  label: 'Atividade', badge: null },
    { key: 'usage',     icon: 'usage',     label: 'Consumo',   badge: null },
  ]},
  { sector: 'Agentes', items: [
    { key: 'agents',    icon: 'agents',    label: 'Agentes',   badge: '6' },
    { key: 'sessions',  icon: 'sessions',  label: 'Sessões',   badge: null },
    { key: 'satellites',icon: 'channels',  label: 'Satellites',badge: '3' },
  ]},
  { sector: 'Plugins', items: [
    { key: 'litigation',icon: 'shield',    label: 'BR-Litigation', badge: null },
    { key: 'araticum',  icon: 'documents', label: 'Araticum',  badge: null },
  ]},
  { sector: 'Sistema', items: [
    { key: 'cron',      icon: 'cron',      label: 'Crons',     badge: null },
    { key: 'memory',    icon: 'memory',    label: 'Memória',   badge: null },
    { key: 'doctor',    icon: 'doctor',    label: 'Doctor',    badge: null },
    { key: 'logs',      icon: 'logs',      label: 'Logs',      badge: null },
    { key: 'terminal',  icon: 'terminal',  label: 'Terminal',  badge: null },
  ]},
];

const PAGE_META = {
  dashboard:  { title: 'Dashboard',      sub: 'Visão geral do ecossistema' },
  activity:   { title: 'Atividade',      sub: 'Timeline de eventos' },
  usage:      { title: 'Consumo',        sub: 'Tokens · custo · orçamento' },
  agents:     { title: 'Agentes',        sub: 'Plugins e satellites' },
  sessions:   { title: 'Sessões',        sub: 'Conversas ativas' },
  satellites: { title: 'Satellites',     sub: 'Bots Telegram' },
  litigation: { title: 'BR-Litigation',  sub: 'Processos e prazos' },
  araticum:   { title: 'Araticum',       sub: 'Licitações e propostas' },
  cron:       { title: 'Crons',          sub: 'Jobs agendados' },
  memory:     { title: 'Memória',        sub: 'Contexto persistente' },
  doctor:     { title: 'Doctor',         sub: 'Diagnóstico do sistema' },
  logs:       { title: 'Logs',           sub: 'Log estruturado' },
  terminal:   { title: 'Terminal',       sub: 'Execute comandos' },
};

function Sidebar({ active, onNav, collapsed, setCollapsed, mobileOpen }) {
  return (
    <aside id="cc-sidebar-nav" className={`hc-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="hc-brand">
        <div className="hc-brand-mark" title="ClaudeClaw">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <path d="M9 9h.01M15 9h.01" />
          </svg>
        </div>
        <div className="hc-brand-text">
          <span className="n">ClaudeClaw</span>
          <span className="t">command·center</span>
        </div>
      </div>

      <div className="hc-sidebar-scroll">
        {NAV.map(sector => (
          <div key={sector.sector} className="hc-nav-sector">
            <h3>{sector.sector}</h3>
            {sector.items.map(item => (
              <button
                key={item.key}
                className={`hc-nav-item ${active === item.key ? 'active' : ''}`}
                onClick={() => onNav(item.key)}
                title={item.label}
              >
                <Icon name={item.icon} size={16} stroke={1.75} />
                <span className="label">{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="hc-sidebar-footer">
        <div className="hc-operator">
          <div className="hc-operator-avatar">DA</div>
          <div className="hc-operator-text">
            <div className="n">Danilo</div>
            <div className="t">OAB/DF 59.724</div>
          </div>
        </div>
        <button className="hc-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir' : 'Recolher'}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} stroke={2} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({ active, onRefresh, gatewayOnline, clock, onToggleMobile, mobileOpen, onOpenSearch, refreshing, lastRefresh }) {
  const meta = PAGE_META[active] || {};

  const formatLastRefresh = () => {
    if (!lastRefresh) return '';
    const secs = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
    if (secs < 5) return 'agora';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m`;
  };

  return (
    <header className="hc-topbar">
      <button
        className="hc-mobile-toggle"
        onClick={onToggleMobile}
        aria-label="Menu"
        aria-expanded={mobileOpen ? 'true' : 'false'}
        aria-controls="cc-sidebar-nav"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="hc-breadcrumb">
        <span>ClaudeClaw</span>
        <span className="sep">/</span>
        <span className="cur">{meta.title}</span>
      </div>

      <div className="hc-topbar-spacer" />

      <div className="hc-search" onClick={onOpenSearch} style={{ cursor: 'pointer' }}>
        <Icon name="search" size={14} stroke={2} />
        <span className="hc-search-placeholder">Buscar agentes, processos…</span>
        <kbd>⌘K</kbd>
      </div>

      <span className={`hc-status-pill ${gatewayOnline ? 'online' : 'offline'}`}>
        <span className="dot" />
        {gatewayOnline ? 'Online' : 'Offline'}
      </span>

      <span className="hc-mono hc-muted" style={{fontSize:12}}>{clock}</span>

      <div className="hc-refresh-indicator">
        {refreshing && <span className="hc-refreshing">Atualizando...</span>}
        {!refreshing && lastRefresh && <span className="hc-last-refresh">{formatLastRefresh()}</span>}
        <button className={`hc-btn ghost ${refreshing ? 'spinning' : ''}`} onClick={onRefresh} title="Atualizar dados" disabled={refreshing}>
          <Icon name="refresh" size={14} stroke={2} />
        </button>
      </div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.PAGE_META = PAGE_META;
window.NAV = NAV;
