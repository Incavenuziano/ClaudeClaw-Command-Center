/* ClaudeClaw Command Center — Pages */
const { useState: usP, useEffect: ueP, useMemo: umP, useRef: urP } = React;
const { formatSaoPauloTime } = window.CC_TIME;

function Dashboard({ data, setActive }) {
  return (
    <div className="hc-flex-col" style={{ gap: 16 }}>
      <div className="hc-grid hc-grid-4">
        <Stat label="Agentes" value={data.agents.filter(a=>a.status==='online'||a.status==='active').length + ' / ' + data.agents.length} icon="agents" spark={[2,3,3,4,4,4,5,4,4,5,5,6]} />
        <Stat label="Sessões" value={data.sessions.filter(s=>s.status==='active').length} icon="sessions" spark={[1,1,1,2,2,1,1,2,2,2,2,2]} />
        <Stat label="Tokens hoje" value={(data.usage.today.tokens/1000).toFixed(1) + 'k'} icon="zap" spark={data.usage.hourly.slice(-12)} />
        <Stat label="Custo hoje" value={'$' + data.usage.today.cost.toFixed(2)} delta={data.usage.week?.cost ? `$${data.usage.week.cost.toFixed(0)} semana` : ''} icon="usage" spark={data.usage.hourly.slice(-12).map(v => v * 0.008)} />
      </div>

      <div className="hc-grid hc-grid-2-1">
        <Panel title="Atividade recente" icon="activity" sub="últimos eventos"
          actions={<button className="hc-btn sm" onClick={() => setActive('activity')}>Ver todos</button>}>
          <div className="hc-feed" style={{ margin: -14 }}>
            {data.events.slice(0, 8).map((e, i) => <FeedItem key={i} event={e} />)}
          </div>
        </Panel>

        <div className="hc-flex-col" style={{ gap: 16 }}>
          <Panel title="Satellites" icon="channels" sub="Bots Telegram">
            <div style={{ margin: -14 }}>
              {data.satellites.map(s => <SatelliteRow key={s.id} s={s} />)}
            </div>
          </Panel>

          <Panel title="Sistema" icon="heart" sub={data.systemHealth.env}>
            <dl className="hc-kv">
              <dt>versão</dt><dd className="hc-mono">{data.systemHealth.version}</dd>
              <dt>uptime</dt><dd className="hc-mono">{data.systemHealth.uptime}</dd>
              <dt>runtime</dt><dd><Tag tone="ok">online</Tag></dd>
              <dt>vault</dt><dd><Tag tone="ok">conectado</Tag></dd>
            </dl>
          </Panel>
        </div>
      </div>

      <div className="hc-grid hc-grid-2">
        <Panel title="Agentes por consumo" icon="agents" sub="tokens 24h"
          actions={<button className="hc-btn sm ghost" onClick={() => setActive('agents')}>Todos <Icon name="arrow_up_right" size={12} /></button>}>
          <div style={{ margin: -14 }}>
            {data.agents.slice(0, 5).map(a => (
              <div key={a.id} className="hc-row">
                <div className="hc-agent-avatar">{a.avatar}<span className={`dot ${agentStatusTone(a.status)}`} /></div>
                <div className="hc-grow">
                  <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{a.id}</div>
                  <div className="hc-meta-line">{a.role} · {a.model}</div>
                </div>
                <div style={{ width: 140 }}>
                  <div className="hc-flex" style={{ justifyContent: 'space-between', fontSize: 11 }}>
                    <span className="hc-muted hc-mono">{(a.tokens24h/1000).toFixed(1)}k</span>
                    <span className="hc-mono hc-text-sec">${a.cost24h.toFixed(2)}</span>
                  </div>
                  <Bar value={a.tokens24h} max={200000} tone={a.tokens24h > 150000 ? 'warn' : 'ok'} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Crons" icon="cron" sub="próximos jobs"
          actions={<button className="hc-btn sm ghost" onClick={() => setActive('cron')}>Ver todos <Icon name="arrow_up_right" size={12} /></button>}>
          <div style={{ margin: -14 }}>
            {data.cron.map(c => (
              <div key={c.id} className="hc-row">
                <Icon name="clock" size={14} stroke={1.75} style={{ color: c.last === 'err' ? 'var(--danger)' : c.last === 'warn' ? 'var(--warning)' : 'var(--success)' }} />
                <div className="hc-grow">
                  <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div className="hc-meta-line">{c.schedule} · próximo {c.next}</div>
                </div>
                <Tag tone={c.last === 'err' ? 'err' : c.last === 'warn' ? 'warn' : 'ok'}>{c.last}</Tag>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AgentsPage({ data }) {
  const [sel, setSel] = usP(data.agents[0]);
  return (
    <div className="hc-split">
      <Panel title="Agentes" icon="agents" sub={`${data.agents.length} registrados`} className="hc-split-list">
        <div style={{ margin: -14 }}>
          {data.agents.map(a => (
            <div key={a.id} className={`hc-row ${sel?.id === a.id ? 'selected' : ''}`} onClick={() => setSel(a)}>
              <div className="hc-agent-avatar">{a.avatar}<span className={`dot ${agentStatusTone(a.status)}`} /></div>
              <div className="hc-grow">
                <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{a.id}</div>
                <div className="hc-meta-line">{a.role} · {a.model}</div>
              </div>
              <Tag tone={agentStatusTone(a.status)}>{a.status}</Tag>
            </div>
          ))}
        </div>
      </Panel>

      {sel && (
        <Panel title={sel.id} icon="agents" sub={sel.role} className="hc-split-detail">
          <div className="hc-grid hc-grid-2" style={{ marginBottom: 14 }}>
            <Stat label="Tokens 24h" value={(sel.tokens24h/1000).toFixed(1) + 'k'} />
            <Stat label="Custo 24h" value={'$' + sel.cost24h.toFixed(2)} />
          </div>
          <dl className="hc-kv">
            <dt>status</dt><dd><Tag tone={agentStatusTone(sel.status)}>{sel.status}</Tag></dd>
            <dt>modelo</dt><dd className="hc-mono">{sel.model}</dd>
            <dt>tipo</dt><dd>{sel.role}</dd>
            <dt>sessões</dt><dd className="hc-mono">{sel.sessions}</dd>
            <dt>última vez</dt><dd className="hc-mono">{sel.lastSeen}</dd>
          </dl>
          <div className="hc-divider" />
          <p className="hc-text-sec" style={{ fontSize: 13 }}>{sel.description}</p>
        </Panel>
      )}
    </div>
  );
}

function ActivityPage({ data }) {
  const [filter, setFilter] = usP('all');
  const filtered = data.events.filter(e => filter === 'all' || (filter === 'errors' && e.tone === 'err') || (filter === 'ok' && e.tone === 'ok'));
  return (
    <Panel title="Timeline" icon="activity" sub={`${filtered.length} eventos`}
      actions={
        <div className="hc-tweak-seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {['all','ok','errors'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'Todos' : f === 'ok' ? 'OK' : 'Erros'}</button>
          ))}
        </div>
      }>
      <div className="hc-feed" style={{ margin: -14 }}>
        {filtered.map((e, i) => <FeedItem key={i} event={e} />)}
      </div>
    </Panel>
  );
}

function UsagePage({ data }) {
  const week = data.usage.week || { cost: 0, daily: [] };
  const daily = week.daily || [];
  const maxCost = Math.max(...daily.map(d => d.cost), 1);

  const formatDay = (d) => {
    if (!d) return '';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  return (
    <div className="hc-flex-col" style={{ gap: 16 }}>
      <div className="hc-grid hc-grid-4">
        <Stat label="Tokens hoje" value={(data.usage.today.tokens/1000).toFixed(1) + 'k'} icon="zap" />
        <Stat label="Custo hoje" value={'$' + data.usage.today.cost.toFixed(2)} icon="usage" />
        <Stat label="Custo semana" value={'$' + (week.cost || 0).toFixed(2)} icon="trending" />
        <Stat label="Sessões hoje" value={data.usage.today.sessions} icon="sessions" />
      </div>

      <Panel title="Custo por dia (últimos 7 dias)" icon="trending" sub={`Total: $${(week.cost || 0).toFixed(2)}`}>
        <div className="hc-bar-chart">
          {daily.map((d, i) => (
            <div key={i} className="hc-bar-col">
              <div className="hc-bar-value">${d.cost.toFixed(2)}</div>
              <div className="hc-bar-fill" style={{ height: `${(d.cost / maxCost) * 100}%` }} />
              <div className="hc-bar-label">{formatDay(d.day)}</div>
            </div>
          ))}
          {daily.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', width: '100%' }}>
              Sem dados de uso semanal
            </div>
          )}
        </div>
      </Panel>

      <div className="hc-grid hc-grid-2">
        <Panel title="Tokens da sessão" icon="zap">
          <dl className="hc-kv">
            <dt>Input</dt><dd className="hc-mono">{(data.usage.session.input_tokens/1000).toFixed(1)}k</dd>
            <dt>Output</dt><dd className="hc-mono">{(data.usage.session.output_tokens/1000).toFixed(1)}k</dd>
            <dt>Cache read</dt><dd className="hc-mono">{(data.usage.session.cache_read/1000000).toFixed(2)}M</dd>
            <dt>Cache write</dt><dd className="hc-mono">{(data.usage.session.cache_creation/1000000).toFixed(2)}M</dd>
            <dt>Mensagens</dt><dd className="hc-mono">{data.usage.session.messages}</dd>
          </dl>
        </Panel>

        <Panel title="Consumo por agente" icon="agents">
          {data.usage.agents?.length > 0 ? (
            <table className="hc-tbl">
              <thead><tr><th>Agente</th><th className="col-r">Tokens</th><th className="col-r">Custo</th></tr></thead>
              <tbody>
                {data.usage.agents.map(a => (
                  <tr key={a.id}>
                    <td className="hc-text-primary">{a.id}</td>
                    <td className="mono col-r">{(a.tokens/1000).toFixed(1)}k</td>
                    <td className="mono col-r">${a.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
              Dados por agente não disponíveis
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function SatellitesPage({ data }) {
  const [selected, setSelected] = usP(null);
  const [message, setMessage] = usP('');
  const [sending, setSending] = usP(false);
  const [chatHistory, setChatHistory] = usP([]);

  const sendMessage = async () => {
    if (!selected || !message.trim() || sending) return;
    setSending(true);
    const text = message.trim();
    setMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);

    try {
      const res = await fetch('/api/satellite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satelliteId: selected.id, message: text }),
      });
      const result = await res.json();
      if (result.success) {
        setChatHistory(prev => [...prev, { role: 'system', text: `Mensagem enviada (ID: ${result.messageId})`, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'error', text: result.error || 'Erro ao enviar', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'error', text: 'Erro de conexão', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="hc-split">
      <Panel title="Satellites" icon="channels" sub="Bots Telegram" className="hc-split-list">
        <div style={{ margin: -14 }}>
          {data.satellites.map(s => (
            <div key={s.id} className={`hc-row ${selected?.id === s.id ? 'selected' : ''}`} onClick={() => { setSelected(s); setChatHistory([]); }} style={{ cursor: 'pointer' }}>
              <Icon name="channels" size={16} stroke={1.75} style={{ color: s.status === 'online' ? 'var(--success)' : 'var(--danger)' }} />
              <div className="hc-grow">
                <div className="hc-text-primary" style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                <div className="hc-meta-line">{s.bot} · {s.model}</div>
              </div>
              <Tag tone={s.status === 'online' ? 'ok' : 'err'}>{s.status}</Tag>
            </div>
          ))}
        </div>
      </Panel>

      {selected ? (
        <Panel title={`Chat com ${selected.name}`} icon="chat" sub={selected.bot} className="hc-split-detail">
          <div className="hc-satellite-chat">
            <div className="hc-chat-messages">
              {chatHistory.length === 0 && (
                <div className="hc-chat-empty">
                  <Icon name="chat" size={32} stroke={1} />
                  <div>Envie uma mensagem para {selected.name}</div>
                  <div className="hc-muted" style={{ fontSize: 11 }}>A mensagem será enviada via Telegram</div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`hc-chat-msg ${m.role}`}>
                  <span className="time">{m.time}</span>
                  <span className="text">{m.text}</span>
                </div>
              ))}
            </div>
            <div className="hc-chat-input">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Mensagem para ${selected.name}...`}
                disabled={sending || selected.status !== 'online'}
                rows={2}
              />
              <button className="hc-btn" onClick={sendMessage} disabled={sending || !message.trim() || selected.status !== 'online'}>
                {sending ? <Icon name="refresh" size={14} stroke={2} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon name="play" size={14} stroke={2} />}
              </button>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="Chat" icon="chat" sub="Selecione um satellite" className="hc-split-detail">
          <div className="hc-empty">
            <Icon name="channels" size={48} stroke={1} />
            <div className="msg">Selecione um satellite para iniciar conversa</div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function LitigationPage({ data }) {
  const [running, setRunning] = usP(false);
  const [result, setResult] = usP(null);
  const [selected, setSelected] = usP(null);

  const runMonitor = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'cd /home/danilo/claudeclaw && bun run src/jobs/monitor-processos.ts 2>&1 | tail -20' }),
      });
      const d = await res.json();
      setResult({ success: d.success, msg: d.success ? 'Monitor executado!' : (d.error || 'Erro'), duration: d.duration });
      if (d.success) window.CC_DATA.refresh();
    } catch (e) {
      setResult({ success: false, msg: 'Erro de conexão' });
    }
    setRunning(false);
  };

  const monitorState = data.monitorState || {};
  const lastCheck = monitorState.ultima_verificacao ? new Date(monitorState.ultima_verificacao).toLocaleString('pt-BR') : 'nunca';

  return (
    <div className="hc-flex-col" style={{ gap: 16 }}>
      <div className="hc-grid hc-grid-4">
        <Stat label="Processos" value={data.processos.length} icon="shield" />
        <Stat label="Ativos" value={data.processos.filter(p => p.status === 'ativo').length} icon="activity" />
        <Stat label="Novidades" value={data.processos.filter(p => p.novidades).length} icon="alert" />
        <Stat label="Última verificação" value={lastCheck.split(' ')[1] || '—'} icon="clock" />
      </div>

      <Panel title="Processos Monitorados" icon="shield" sub="BR-Litigation"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {result && <span style={{ fontSize: 11, color: result.success ? 'var(--success)' : 'var(--danger)' }}>{result.msg}</span>}
            <button className="hc-btn sm" onClick={runMonitor} disabled={running}>
              <Icon name={running ? 'refresh' : 'play'} size={12} stroke={2} style={running ? { animation: 'spin 1s linear infinite' } : {}} />
              {running ? 'Executando...' : 'Rodar Monitor'}
            </button>
          </div>
        }>
        <div className="hc-processo-list" style={{ margin: -14 }}>
          {data.processos.map(p => (
            <ProcessoRowExpanded key={p.numero} p={p} monitorState={monitorState} expanded={selected === p.numero} onToggle={() => setSelected(selected === p.numero ? null : p.numero)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ProcessoRowExpanded({ p, monitorState, expanded, onToggle }) {
  const statusTone = p.status === 'ativo' ? 'ok' : p.status === 'segredo' ? 'warn' : '';
  const procState = monitorState?.processos?.[p.numero] || {};
  const ultimaMov = p.ultimaMov || procState.ultima_mov || '—';
  const descMov = p.descricaoMov || procState.desc_mov || '—';

  return (
    <div className={`hc-processo-row ${expanded ? 'expanded' : ''}`}>
      <div className="hc-row" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} stroke={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div className="hc-grow">
          <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{p.numero}</div>
          <div className="hc-meta-line">{p.cliente} vs {p.adverso} · {p.tribunal}</div>
        </div>
        <span className="hc-mono hc-muted" style={{ fontSize: 11 }}>{ultimaMov}</span>
        <Tag tone={statusTone}>{p.status}</Tag>
        {p.novidades && <Tag tone="acc">NOVO</Tag>}
      </div>
      {expanded && (
        <div className="hc-processo-detail">
          <dl className="hc-kv">
            <dt>Fase</dt><dd>{p.fase}</dd>
            <dt>Polo</dt><dd>{p.polo}</dd>
            <dt>Tribunal</dt><dd>{p.tribunal}</dd>
            <dt>Última mov.</dt><dd>{ultimaMov}</dd>
            <dt>Descrição</dt><dd style={{ maxWidth: 400 }}>{descMov}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function AraticumPage({ data }) {
  const [filter, setFilter] = usP('all');
  const [selected, setSelected] = usP(null);

  const pncp = data.pncp || { licitacoes: [], ultima_atualizacao: null };
  const licitacoes = pncp.licitacoes || [];

  const filtered = umP(() => {
    let list = [...licitacoes];
    if (filter === 'alta') list = list.filter(l => l.relevancia >= 0.7);
    if (filter === 'limpeza') list = list.filter(l => l.tags?.some(t => ['limpeza', 'conservação', 'asseio'].includes(t.toLowerCase())));
    if (filter === 'df') list = list.filter(l => l.uf === 'DF');
    return list.sort((a, b) => b.relevancia - a.relevancia);
  }, [licitacoes, filter]);

  const stats = umP(() => {
    const total = licitacoes.length;
    const alta = licitacoes.filter(l => l.relevancia >= 0.7).length;
    const limpeza = licitacoes.filter(l => l.tags?.some(t => ['limpeza', 'conservação', 'asseio'].includes(t.toLowerCase()))).length;
    const valorTotal = licitacoes.reduce((acc, l) => acc + (l.valor_estimado || 0), 0);
    return { total, alta, limpeza, valorTotal };
  }, [licitacoes]);

  const formatValor = (v) => {
    if (!v) return '—';
    if (v >= 1000000) return `R$ ${(v/1000000).toFixed(1)}M`;
    if (v >= 1000) return `R$ ${(v/1000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const formatData = (d) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  const lastUpdate = pncp.ultima_atualizacao ? new Date(pncp.ultima_atualizacao).toLocaleString('pt-BR') : '—';

  return (
    <div className="hc-flex-col" style={{ gap: 16 }}>
      <div className="hc-grid hc-grid-4">
        <Stat label="Oportunidades" value={stats.total} icon="documents" />
        <Stat label="Alta relevância" value={stats.alta} icon="alert" />
        <Stat label="Limpeza/Conserv." value={stats.limpeza} icon="shield" />
        <Stat label="Valor total" value={formatValor(stats.valorTotal)} icon="usage" />
      </div>

      <Panel title="Oportunidades PNCP" icon="documents" sub={`Atualizado: ${lastUpdate}`}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`hc-btn sm ${filter === 'all' ? '' : 'ghost'}`} onClick={() => setFilter('all')}>Todas</button>
            <button className={`hc-btn sm ${filter === 'alta' ? '' : 'ghost'}`} onClick={() => setFilter('alta')}>Alta</button>
            <button className={`hc-btn sm ${filter === 'limpeza' ? '' : 'ghost'}`} onClick={() => setFilter('limpeza')}>Limpeza</button>
            <button className={`hc-btn sm ${filter === 'df' ? '' : 'ghost'}`} onClick={() => setFilter('df')}>DF</button>
          </div>
        }>
        <div className="hc-licitacao-list" style={{ margin: -14 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma oportunidade encontrada</div>
          )}
          {filtered.slice(0, 20).map(l => (
            <LicitacaoRow key={l.id} l={l} expanded={selected === l.id} onToggle={() => setSelected(selected === l.id ? null : l.id)} formatValor={formatValor} formatData={formatData} />
          ))}
          {filtered.length > 20 && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              +{filtered.length - 20} oportunidades não exibidas
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function LicitacaoRow({ l, expanded, onToggle, formatValor, formatData }) {
  const relevTone = l.relevancia >= 0.7 ? 'ok' : l.relevancia >= 0.5 ? 'warn' : '';
  const isUrgente = (() => {
    if (!l.data_abertura) return false;
    const abertura = new Date(l.data_abertura);
    const diff = (abertura.getTime() - Date.now()) / (1000 * 60 * 60);
    return diff < 48 && diff > 0;
  })();

  return (
    <div className={`hc-processo-row ${expanded ? 'expanded' : ''}`}>
      <div className="hc-row" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} stroke={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div className="hc-grow" style={{ minWidth: 0 }}>
          <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {l.objeto?.slice(0, 80)}{l.objeto?.length > 80 ? '...' : ''}
          </div>
          <div className="hc-meta-line">{l.orgao} · {l.uf} · {l.modalidade}</div>
        </div>
        <span className="hc-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{formatValor(l.valor_estimado)}</span>
        <span className="hc-mono hc-muted" style={{ fontSize: 10, flexShrink: 0 }}>{formatData(l.data_abertura)}</span>
        {isUrgente && <Tag tone="err">URGENTE</Tag>}
        <Tag tone={relevTone}>{Math.round(l.relevancia * 100)}%</Tag>
      </div>
      {expanded && (
        <div className="hc-processo-detail">
          <div style={{ marginBottom: 12, lineHeight: 1.5, color: 'var(--text-secondary)', fontSize: 13 }}>{l.objeto}</div>
          <dl className="hc-kv">
            <dt>Órgão</dt><dd>{l.orgao}</dd>
            <dt>UF</dt><dd>{l.uf}</dd>
            <dt>Modalidade</dt><dd>{l.modalidade}</dd>
            <dt>Valor estimado</dt><dd>{formatValor(l.valor_estimado)}</dd>
            <dt>Abertura</dt><dd>{l.data_abertura}</dd>
            <dt>Publicação</dt><dd>{l.data_publicacao}</dd>
            <dt>Tags</dt><dd>{l.tags?.join(', ') || '—'}</dd>
          </dl>
          <div style={{ marginTop: 12 }}>
            <a href={l.link} target="_blank" rel="noopener noreferrer" className="hc-btn sm">
              <Icon name="arrow_up_right" size={12} /> Ver no PNCP
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function CronPage({ data }) {
  return (
    <Panel title="Jobs Agendados" icon="cron" sub={`${data.cron.length} jobs`}>
      <table className="hc-tbl">
        <thead><tr><th>Job</th><th>Schedule</th><th>Próximo</th><th>Último</th><th>Duração</th><th>Status</th></tr></thead>
        <tbody>
          {data.cron.map(c => (
            <tr key={c.id}>
              <td className="hc-text-primary">{c.name}</td>
              <td className="mono">{c.schedule}</td>
              <td className="mono">{c.next}</td>
              <td><Tag tone={c.last === 'err' ? 'err' : c.last === 'warn' ? 'warn' : 'ok'}>{c.last}</Tag></td>
              <td className="mono">{c.duration}</td>
              <td><Tag tone={c.enabled ? 'ok' : ''}>{c.enabled ? 'ativo' : 'pausado'}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function MemoryPage({ data }) {
  return (
    <Panel title="Memory Scopes" icon="memory" sub={`${data.memory.length} scopes`}>
      <div style={{ margin: -14 }}>
        {data.memory.map(m => (
          <div key={m.scope} className="hc-row">
            <Icon name="memory" size={14} stroke={1.75} />
            <div className="hc-grow">
              <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{m.scope}</div>
              <div className="hc-meta-line">{m.preview}</div>
            </div>
            <span className="hc-mono hc-muted" style={{ fontSize: 11 }}>{m.updated}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DoctorPage({ data }) {
  return (
    <Panel title="Diagnóstico" icon="doctor" sub="health checks">
      <div style={{ margin: -14 }}>
        {data.doctor.map(d => (
          <div key={d.name} className="hc-row">
            <Icon name={d.status === 'ok' ? 'check' : d.status === 'warn' ? 'alert' : 'x'} size={14} stroke={2}
              style={{ color: d.status === 'ok' ? 'var(--success)' : d.status === 'warn' ? 'var(--warning)' : 'var(--danger)' }} />
            <div className="hc-grow">
              <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
              <div className="hc-meta-line">{d.detail}</div>
            </div>
            <Tag tone={d.status === 'ok' ? 'ok' : d.status === 'warn' ? 'warn' : 'err'}>{d.status}</Tag>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LogsPage({ data }) {
  return (
    <Panel title="Logs" icon="logs" sub={`${data.logs.length} entradas`}>
      <div className="hc-terminal" style={{ margin: -14, padding: 14 }}>
        {data.logs.map((l, i) => (
          <div key={i} className={`hc-log-line ${l.level}`}>
            <span className="time">{l.t}</span>
            <span className={`level ${l.level}`}>{l.level.toUpperCase()}</span>
            <span className="source">[{l.source}]</span>
            <span className="msg">{l.msg}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SessionsPage({ data }) {
  const [sel, setSel] = usP(data.sessions[0]);
  return (
    <div className="hc-split">
      <Panel title="Sessões" icon="sessions" sub={`${data.sessions.length} total`} className="hc-split-list">
        <div style={{ margin: -14 }}>
          {data.sessions.map(s => (
            <div key={s.id} className={`hc-row ${sel?.id === s.id ? 'selected' : ''}`} onClick={() => setSel(s)}>
              <div className="hc-agent-avatar"><Icon name="sessions" size={13} /><span className={`dot ${s.status === 'active' ? 'ok' : ''}`} /></div>
              <div className="hc-grow" style={{ minWidth: 0 }}>
                <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div className="hc-meta-line">{s.agent} · {s.platform}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="hc-mono" style={{ fontSize: 11 }}>{s.msgs} msgs</div>
                <div className="hc-mono hc-muted" style={{ fontSize: 10 }}>{s.started}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {sel && (
        <Panel title="Conversa" icon="chat" sub={sel.id}
          actions={<Tag tone={sel.status==='active'?'ok':''}>{sel.status}</Tag>}
          className="hc-split-detail">
          <div className="hc-chat">
            <div className="hc-chat-msgs">
              {data.transcript.map((m, i) => (
                <div key={i} className={`hc-msg ${m.role}`}>
                  <div className="hc-msg-avatar">{m.role === 'user' ? 'DA' : 'CC'}</div>
                  <div className="hc-msg-body">
                    <div className="hc-msg-head">
                      <span className="name">{m.name}</span>
                      <span className="time">{m.time}</span>
                    </div>
                    <div className="hc-msg-content">{m.content}</div>
                    {m.tool && (
                      <div className="hc-msg-tool"><span className="tk">{m.tool.name}</span> <span className="hc-muted">·</span> {m.tool.args}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function PlaceholderPage({ title, hint }) {
  return (
    <Panel title={title} icon="config">
      <div className="hc-empty">
        <Icon name="config" size={48} stroke={1} />
        <div className="msg">{hint || 'Em desenvolvimento...'}</div>
      </div>
    </Panel>
  );
}

function TerminalPage() {
  const [cmd, setCmd] = usP('');
  const [history, setHistory] = usP([]);
  const [loading, setLoading] = usP(false);
  const [histIdx, setHistIdx] = usP(-1);
  const [cmdHistory, setCmdHistory] = usP([]);
  const inputRef = urP(null);
  const outputRef = urP(null);

  const runCmd = async () => {
    if (!cmd.trim() || loading) return;
    const command = cmd.trim();
    setCmd('');
    setLoading(true);
    setCmdHistory(prev => [command, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setHistory(prev => [...prev, { type: 'cmd', text: command }]);

    try {
      const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();

      if (data.success) {
        setHistory(prev => [...prev, { type: 'out', text: data.output || '(sem output)', duration: data.duration }]);
      } else {
        setHistory(prev => [...prev, { type: 'err', text: data.error || data.output || 'Erro', duration: data.duration }]);
      }
    } catch (e) {
      setHistory(prev => [...prev, { type: 'err', text: 'Erro de conexão: ' + e.message }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      runCmd();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0 && histIdx < cmdHistory.length - 1) {
        const newIdx = histIdx + 1;
        setHistIdx(newIdx);
        setCmd(cmdHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) {
        const newIdx = histIdx - 1;
        setHistIdx(newIdx);
        setCmd(cmdHistory[newIdx]);
      } else if (histIdx === 0) {
        setHistIdx(-1);
        setCmd('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  ueP(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  ueP(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Panel title="Terminal" icon="terminal" sub="execute comandos no servidor"
      actions={<button className="hc-btn sm ghost" onClick={() => setHistory([])}>Limpar</button>}>
      <div className="hc-terminal">
        <div className="hc-term-output" ref={outputRef}>
          {history.length === 0 && (
            <div className="hc-term-welcome">
              <div>ClaudeClaw Terminal</div>
              <div className="hc-muted">cwd: /home/danilo/claudeclaw</div>
              <div className="hc-muted">↑↓ histórico · Ctrl+L limpar</div>
            </div>
          )}
          {history.map((h, i) => (
            <div key={i} className={`hc-term-line ${h.type}`}>
              {h.type === 'cmd' && <span className="prompt">$ </span>}
              <span className="text">{h.text}</span>
              {h.duration && <span className="duration">{h.duration}ms</span>}
            </div>
          ))}
          {loading && <div className="hc-term-line loading"><span className="prompt">$ </span><span className="spinner">⠋</span></div>}
        </div>
        <div className="hc-term-input">
          <span className="prompt">$</span>
          <input
            ref={inputRef}
            type="text"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={handleKey}
            placeholder="digite um comando..."
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </Panel>
  );
}

window.Dashboard = Dashboard;
window.AgentsPage = AgentsPage;
window.ActivityPage = ActivityPage;
window.UsagePage = UsagePage;
window.SatellitesPage = SatellitesPage;
window.LitigationPage = LitigationPage;
window.AraticumPage = AraticumPage;
window.CronPage = CronPage;
window.MemoryPage = MemoryPage;
window.DoctorPage = DoctorPage;
window.LogsPage = LogsPage;
window.SessionsPage = SessionsPage;
window.TerminalPage = TerminalPage;
window.PlaceholderPage = PlaceholderPage;
