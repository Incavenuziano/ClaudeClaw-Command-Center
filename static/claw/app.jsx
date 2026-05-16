/* ClaudeClaw Command Center — App root */
const { useState: usApp, useEffect: ueApp, useRef: urApp, useMemo: umApp, useCallback: ucApp } = React;

const TWEAK_DEFAULTS = {
  "theme": "premium",
  "collapsed": false,
};

const { formatSaoPauloTime } = window.CC_TIME;

// Toast system
let toastId = 0;
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="hc-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`hc-toast ${t.type}`} onClick={() => onDismiss(t.id)}>
          <Icon name={t.type === 'error' ? 'alert' : t.type === 'success' ? 'check' : 'radio'} size={16} stroke={2} />
          <div className="hc-toast-content">
            <div className="hc-toast-title">{t.title}</div>
            {t.message && <div className="hc-toast-msg">{t.message}</div>}
          </div>
          <button className="hc-toast-close"><Icon name="x" size={12} stroke={2} /></button>
        </div>
      ))}
    </div>
  );
}

function CommandPalette({ open, onClose, data, onNavigate }) {
  const [query, setQuery] = usApp('');
  const [selected, setSelected] = usApp(0);
  const inputRef = urApp(null);

  const results = umApp(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items = [];

    // Páginas
    Object.entries(window.PAGE_META).forEach(([key, meta]) => {
      if (meta.title.toLowerCase().includes(q) || meta.sub?.toLowerCase().includes(q)) {
        items.push({ type: 'page', id: key, title: meta.title, sub: meta.sub, icon: 'dashboard' });
      }
    });

    // Agentes
    data.agents.forEach(a => {
      if (a.id.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)) {
        items.push({ type: 'agent', id: a.id, title: a.id, sub: a.description || a.role, icon: 'agents', nav: 'agents' });
      }
    });

    // Processos
    data.processos.forEach(p => {
      const searchStr = `${p.numero} ${p.cliente} ${p.adverso}`.toLowerCase();
      if (searchStr.includes(q)) {
        items.push({ type: 'processo', id: p.numero, title: p.numero, sub: `${p.cliente} vs ${p.adverso}`, icon: 'shield', nav: 'litigation' });
      }
    });

    // Satellites
    data.satellites.forEach(s => {
      if (s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q)) {
        items.push({ type: 'satellite', id: s.id, title: s.name || s.id, sub: `Status: ${s.status}`, icon: 'channels', nav: 'satellites' });
      }
    });

    // Crons
    data.cron.forEach(c => {
      if (c.name?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q)) {
        items.push({ type: 'cron', id: c.id, title: c.name, sub: c.schedule, icon: 'cron', nav: 'cron' });
      }
    });

    // Memory
    data.memory.forEach(m => {
      if (m.scope?.toLowerCase().includes(q) || m.preview?.toLowerCase().includes(q)) {
        items.push({ type: 'memory', id: m.scope, title: m.scope, sub: m.preview, icon: 'memory', nav: 'memory' });
      }
    });

    return items.slice(0, 10);
  }, [query, data]);

  ueApp(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  ueApp(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      const r = results[selected];
      onNavigate(r.nav || r.id);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="hc-cmd-backdrop" onClick={onClose}>
      <div className="hc-cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="hc-cmd-input">
          <Icon name="search" size={16} stroke={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, agentes, processos..."
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>ESC</kbd>
        </div>
        {query && (
          <div className="hc-cmd-results">
            {results.length === 0 ? (
              <div className="hc-cmd-empty">Nenhum resultado para "{query}"</div>
            ) : (
              results.map((r, i) => (
                <div
                  key={`${r.type}-${r.id}`}
                  className={`hc-cmd-item ${i === selected ? 'selected' : ''}`}
                  onClick={() => { onNavigate(r.nav || r.id); onClose(); }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <Icon name={r.icon} size={14} stroke={1.75} />
                  <div className="hc-cmd-item-text">
                    <span className="title">{r.title}</span>
                    <span className="sub">{r.sub}</span>
                  </div>
                  <span className="hc-cmd-type">{r.type}</span>
                </div>
              ))
            )}
          </div>
        )}
        {!query && (
          <div className="hc-cmd-hints">
            <div className="hc-cmd-hint"><kbd>↑↓</kbd> navegar</div>
            <div className="hc-cmd-hint"><kbd>↵</kbd> selecionar</div>
            <div className="hc-cmd-hint"><kbd>ESC</kbd> fechar</div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('cc_state') || '{}'); } catch { return {}; } })();
  const [active, setActive] = usApp(saved.active || 'dashboard');
  const [theme, setTheme] = usApp(saved.theme || TWEAK_DEFAULTS.theme);
  const [collapsed, setCollapsed] = usApp(TWEAK_DEFAULTS.collapsed);
  const [gatewayOnline, setGatewayOnline] = usApp(true);
  const [clock, setClock] = usApp(formatSaoPauloTime());
  const [tweaksOn, setTweaksOn] = usApp(false);
  const [mobileMenu, setMobileMenu] = usApp(false);
  const [cmdOpen, setCmdOpen] = usApp(false);
  const [refreshing, setRefreshing] = usApp(false);
  const [lastRefresh, setLastRefresh] = usApp(null);
  const [toasts, setToasts] = usApp([]);
  const prevDataRef = urApp({ satellites: [], cron: [] });

  const addToast = ucApp((type, title, message) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = ucApp((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  ueApp(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  ueApp(() => { localStorage.setItem('cc_state', JSON.stringify({ active, theme })); }, [active, theme]);

  ueApp(() => {
    const t = setInterval(() => {
      setClock(formatSaoPauloTime());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to data refresh events and check for notifications
  ueApp(() => {
    const unsub = window.CC_DATA.subscribe((state) => {
      setRefreshing(state.refreshing);
      if (state.lastRefresh) setLastRefresh(state.lastRefresh);

      // Check for changes after refresh completes
      if (!state.refreshing && state.success) {
        const data = window.CC_DATA;
        const prev = prevDataRef.current;

        // Check for satellite status changes
        data.satellites.forEach(sat => {
          const prevSat = prev.satellites.find(s => s.id === sat.id);
          if (prevSat && prevSat.status !== sat.status) {
            if (sat.status === 'online') {
              addToast('success', `${sat.name || sat.id} online`, 'Satellite conectado');
            } else {
              addToast('error', `${sat.name || sat.id} offline`, 'Satellite desconectado');
            }
          }
        });

        // Check for cron failures
        data.cron.forEach(job => {
          const prevJob = prev.cron.find(c => c.id === job.id);
          if (prevJob && prevJob.last !== 'err' && job.last === 'err') {
            addToast('error', `Cron falhou: ${job.name}`, job.schedule);
          }
        });

        // Update prev ref
        prevDataRef.current = {
          satellites: data.satellites.map(s => ({ ...s })),
          cron: data.cron.map(c => ({ ...c })),
        };
      }
    });
    return unsub;
  }, [addToast]);

  ueApp(() => {
    if (!mobileMenu) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenu]);

  // ⌘K / Ctrl+K para abrir command palette
  ueApp(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMobileNav = (next) => {
    setActive(next);
    setMobileMenu(false);
  };

  const data = window.CC_DATA;
  const meta = window.PAGE_META[active] || {};

  const Page = (() => {
    switch (active) {
      case 'dashboard':   return <Dashboard data={data} setActive={setActive} />;
      case 'kanban':      return <KanbanPage data={data} />;
      case 'agents':      return <AgentsPage data={data} />;
      case 'sessions':    return <SessionsPage data={data} />;
      case 'activity':    return <ActivityPage data={data} />;
      case 'usage':       return <UsagePage data={data} />;
      case 'satellites':  return <SatellitesPage data={data} />;
      case 'litigation':  return <LitigationPage data={data} />;
      case 'araticum':    return <AraticumPage data={data} />;
      case 'cron':        return <CronPage data={data} />;
      case 'memory':      return <MemoryPage data={data} />;
      case 'doctor':      return <DoctorPage data={data} />;
      case 'logs':        return <LogsPage data={data} />;
      case 'terminal':    return <TerminalPage />;
      case 'live':        return <LiveExecutionPage data={data} />;
      default:            return <Dashboard data={data} setActive={setActive} />;
    }
  })();

  return (
    <div className="hc-shell" data-collapsed={collapsed ? 'true' : 'false'}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div
        className={`hc-sidebar-backdrop${mobileMenu ? ' visible' : ''}`}
        onClick={() => setMobileMenu(false)}
        aria-hidden={mobileMenu ? 'false' : 'true'}
      />
      <Sidebar
        active={active}
        onNav={handleMobileNav}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileMenu}
      />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} data={data} onNavigate={setActive} />

      <div className="hc-main">
        <Topbar active={active} onRefresh={() => window.CC_DATA.refresh()}
          gatewayOnline={gatewayOnline} clock={clock}
          onToggleMobile={() => setMobileMenu(!mobileMenu)} mobileOpen={mobileMenu}
          onOpenSearch={() => setCmdOpen(true)}
          refreshing={refreshing} lastRefresh={lastRefresh} />
        <div className="hc-page">
          <div className="hc-page-header">
            <div className="hc-page-title">
              <h1>{meta.title}</h1>
              {meta.sub && <p>{meta.sub}</p>}
            </div>
            <div className="hc-page-actions">
              <button className="hc-btn sm ghost" onClick={() => setTweaksOn(!tweaksOn)} title="Configurações">
                <Icon name="config" size={12} /> Tema
              </button>
              <Tag tone="accent"><Icon name="dot" size={10} />&nbsp;{theme === 'premium' ? 'Premium' : 'Mission'}</Tag>
            </div>
          </div>
          {Page}
        </div>
      </div>

      {tweaksOn && (
        <div className="hc-tweaks">
          <div className="hc-tweaks-head">
            <span><Icon name="config" size={12} />&nbsp;&nbsp;Configurações</span>
            <button className="hc-btn sm ghost" onClick={() => setTweaksOn(false)}><Icon name="x" size={12} /></button>
          </div>
          <div className="hc-tweaks-body">
            <div className="hc-tweak-row">
              <label>Tema visual</label>
              <div className="hc-tweak-seg">
                <button className={theme === 'premium' ? 'active' : ''} onClick={() => setTheme('premium')}>Premium</button>
                <button className={theme === 'mission' ? 'active' : ''} onClick={() => setTheme('mission')}>Mission</button>
              </div>
            </div>
            <div className="hc-tweak-row">
              <label>Sidebar</label>
              <div className="hc-tweak-seg">
                <button className={!collapsed ? 'active' : ''} onClick={() => setCollapsed(false)}>Expandida</button>
                <button className={collapsed ? 'active' : ''} onClick={() => setCollapsed(true)}>Recolhida</button>
              </div>
            </div>
            <div className="hc-tweak-row">
              <label>Acesso rápido</label>
              <div className="hc-tweak-seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <button onClick={() => { setActive('dashboard'); setTweaksOn(false); }}>Dash</button>
                <button onClick={() => { setActive('agents'); setTweaksOn(false); }}>Agentes</button>
                <button onClick={() => { setActive('litigation'); setTweaksOn(false); }}>Processos</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
