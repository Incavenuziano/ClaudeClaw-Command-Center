/* ClaudeClaw Command Center — Pages */
const { useState: usP, useEffect: ueP, useMemo: umP, useRef: urP } = React;
const { formatSaoPauloTime } = window.CC_TIME;

/* Health Score Gauge — visual circular indicator */
function HealthGauge({ score, size = 100 }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  const bgColor = score >= 80 ? 'var(--success-bg)' : score >= 60 ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const label = score >= 80 ? 'Saudável' : score >= 60 ? 'Atenção' : 'Crítico';

  return (
    <div className="hc-health-gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="hc-health-gauge-inner">
        <span className="hc-health-gauge-value" style={{ color }}>{score}</span>
        <span className="hc-health-gauge-label">{label}</span>
      </div>
    </div>
  );
}

function calculateHealthScore(data) {
  let score = 0;
  let factors = [];

  // Satellites online (peso 30) — fonte principal de status
  const satsOnline = data.satellites.filter(s => s.status === 'online').length;
  const satsTotal = data.satellites.length || 1;
  const satScore = (satsOnline / satsTotal) * 30;
  score += satScore;
  if (satScore < 25) factors.push('Satellites offline');

  // Crons sem erro (peso 30)
  const cronsOk = data.cron.filter(c => c.lastStatus !== 'err' && c.last !== 'err').length;
  const cronsTotal = data.cron.length || 1;
  const cronScore = (cronsOk / cronsTotal) * 30;
  score += cronScore;
  if (cronScore < 25) factors.push('Crons com erro');

  // Custo dentro do limite (peso 20) - assume $50/dia como limite
  const dailyCost = data.usage?.today?.cost || 0;
  const costScore = dailyCost <= 50 ? 20 : dailyCost <= 100 ? 12 : 5;
  score += costScore;
  if (costScore < 20) factors.push('Custo elevado');

  // Sistema respondendo (peso 20)
  const systemOk = data.systemHealth?.version ? 20 : 0;
  score += systemOk;
  if (!systemOk) factors.push('Sistema sem resposta');

  return { score: Math.round(score), factors };
}

function Dashboard({ data, setActive }) {
  const health = umP(() => calculateHealthScore(data), [data]);

  return (
    <div className="hc-flex-col" style={{ gap: 16 }}>
      <div className="hc-grid hc-grid-5">
        <div className="hc-health-card">
          <HealthGauge score={health.score} size={90} />
          <div className="hc-health-info">
            <span className="hc-health-title">Health Score</span>
            {health.factors.length > 0 && (
              <span className="hc-health-factors">{health.factors.slice(0, 2).join(' · ')}</span>
            )}
          </div>
        </div>
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

function AgentSlideout({ agent, onClose, data }) {
  const [tab, setTab] = usP('info');

  // Encontra satellite correspondente
  const satellite = data.satellites.find(s => s.id === agent.id || agent.id.includes(s.id));

  // Logs recentes do agente (filtra por nome)
  const agentLogs = data.logs.filter(l =>
    l.source?.toLowerCase().includes(agent.id.toLowerCase()) ||
    l.message?.toLowerCase().includes(agent.id.toLowerCase())
  ).slice(0, 10);

  // Sessões do agente
  const agentSessions = data.sessions.filter(s => s.agent === agent.id);

  return (
    <div className="hc-slideout-backdrop" onClick={onClose}>
      <div className="hc-slideout" onClick={e => e.stopPropagation()}>
        <div className="hc-slideout-header">
          <div className="hc-slideout-title">
            <div className="hc-agent-avatar lg">{agent.avatar}<span className={`dot ${agentStatusTone(agent.status)}`} /></div>
            <div>
              <h2>{agent.id}</h2>
              <span className="hc-text-sec">{agent.role} · {agent.model}</span>
            </div>
          </div>
          <button className="hc-btn sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="hc-slideout-tabs">
          {['info', 'logs', 'sessões'].map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="hc-slideout-body">
          {tab === 'info' && (
            <>
              <div className="hc-grid hc-grid-2" style={{ marginBottom: 16 }}>
                <div className="hc-stat-card">
                  <span className="hc-stat-value">{(agent.tokens24h/1000).toFixed(1)}k</span>
                  <span className="hc-stat-label">Tokens 24h</span>
                </div>
                <div className="hc-stat-card">
                  <span className="hc-stat-value">${agent.cost24h.toFixed(2)}</span>
                  <span className="hc-stat-label">Custo 24h</span>
                </div>
              </div>

              <dl className="hc-kv">
                <dt>Status</dt><dd><Tag tone={agentStatusTone(agent.status)}>{agent.status}</Tag></dd>
                <dt>Modelo</dt><dd className="hc-mono">{agent.model}</dd>
                <dt>Tipo</dt><dd>{agent.role}</dd>
                <dt>Sessões ativas</dt><dd className="hc-mono">{agent.sessions}</dd>
                <dt>Última atividade</dt><dd className="hc-mono">{agent.lastSeen}</dd>
                {satellite && <>
                  <dt>Bot Telegram</dt><dd className="hc-mono">{satellite.bot}</dd>
                </>}
              </dl>

              <div className="hc-divider" />
              <h4 style={{ marginBottom: 8 }}>Descrição</h4>
              <p className="hc-text-sec" style={{ fontSize: 13, lineHeight: 1.5 }}>{agent.description}</p>
            </>
          )}

          {tab === 'logs' && (
            <div className="hc-slideout-logs">
              {agentLogs.length === 0 ? (
                <div className="hc-empty">
                  <Icon name="logs" size={24} />
                  <span>Sem logs recentes</span>
                </div>
              ) : (
                agentLogs.map((l, i) => (
                  <div key={i} className="hc-log-row">
                    <span className="hc-log-time">{l.time}</span>
                    <Tag tone={l.level === 'error' ? 'err' : l.level === 'warn' ? 'warn' : 'ok'} style={{ fontSize: 10 }}>{l.level}</Tag>
                    <span className="hc-log-msg">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'sessões' && (
            <div className="hc-slideout-sessions">
              {agentSessions.length === 0 ? (
                <div className="hc-empty">
                  <Icon name="sessions" size={24} />
                  <span>Sem sessões ativas</span>
                </div>
              ) : (
                agentSessions.map(s => (
                  <div key={s.id} className="hc-row">
                    <Icon name="chat" size={14} />
                    <div className="hc-grow">
                      <div className="hc-text-primary" style={{ fontSize: 13 }}>{s.title || s.id}</div>
                      <div className="hc-meta-line">{s.platform} · {s.started}</div>
                    </div>
                    <Tag tone={s.status === 'active' ? 'ok' : 'muted'}>{s.status}</Tag>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentsPage({ data }) {
  const [sel, setSel] = usP(null);
  const [slideout, setSlideout] = usP(null);

  return (
    <div className="hc-agents-grid">
      {data.agents.map(a => (
        <div
          key={a.id}
          className={`hc-agent-card ${sel?.id === a.id ? 'selected' : ''}`}
          onClick={() => setSel(a)}
          onDoubleClick={() => setSlideout(a)}
        >
          <div className="hc-agent-card-header">
            <div className="hc-agent-avatar lg">{a.avatar}<span className={`dot ${agentStatusTone(a.status)}`} /></div>
            <Tag tone={agentStatusTone(a.status)}>{a.status}</Tag>
          </div>
          <div className="hc-agent-card-body">
            <h3>{a.id}</h3>
            <span className="hc-text-sec">{a.role}</span>
            <p className="hc-agent-desc">{a.description}</p>
          </div>
          <div className="hc-agent-card-footer">
            <div className="hc-agent-stat">
              <Icon name="zap" size={12} />
              <span>{(a.tokens24h/1000).toFixed(1)}k</span>
            </div>
            <div className="hc-agent-stat">
              <Icon name="usage" size={12} />
              <span>${a.cost24h.toFixed(2)}</span>
            </div>
            <button className="hc-btn xs ghost" onClick={(e) => { e.stopPropagation(); setSlideout(a); }}>
              <Icon name="arrow_up_right" size={12} /> Detalhes
            </button>
          </div>
        </div>
      ))}

      {slideout && <AgentSlideout agent={slideout} onClose={() => setSlideout(null)} data={data} />}
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

function CostBreakdownChart({ agents, satellites }) {
  // Combina agents e satellites com custo
  const items = [
    ...agents.map(a => ({ id: a.id, label: a.id, cost: a.cost24h || 0, tokens: a.tokens24h || 0, type: 'agent', avatar: a.avatar })),
    ...satellites.map(s => ({ id: s.id, label: s.name || s.id, cost: 0, tokens: 0, type: 'satellite', avatar: s.id.substring(0, 2).toUpperCase() })),
  ].filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx); // dedupe

  const totalCost = items.reduce((sum, i) => sum + i.cost, 0) || 1;
  const maxCost = Math.max(...items.map(i => i.cost), 1);

  // Cores por tipo
  const colors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'oklch(0.70 0.15 320)', 'oklch(0.70 0.15 50)'];

  return (
    <div className="hc-cost-breakdown">
      <div className="hc-cost-donut">
        <svg viewBox="0 0 100 100">
          {(() => {
            let offset = 0;
            return items.filter(i => i.cost > 0).map((item, idx) => {
              const pct = (item.cost / totalCost) * 100;
              const dashArray = `${pct} ${100 - pct}`;
              const rotation = offset;
              offset += pct;
              return (
                <circle
                  key={item.id}
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke={colors[idx % colors.length]}
                  strokeWidth="12"
                  strokeDasharray={dashArray}
                  strokeDashoffset={25 - rotation}
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              );
            });
          })()}
          <circle cx="50" cy="50" r="30" fill="var(--bg-panel)" />
        </svg>
        <div className="hc-cost-donut-center">
          <span className="value">${totalCost.toFixed(2)}</span>
          <span className="label">Total 24h</span>
        </div>
      </div>

      <div className="hc-cost-bars">
        {items.map((item, idx) => (
          <div key={item.id} className="hc-cost-bar-row">
            <div className="hc-cost-bar-label">
              <span className="hc-cost-dot" style={{ background: colors[idx % colors.length] }} />
              <span className="name">{item.label}</span>
              <Tag tone={item.type === 'agent' ? 'accent' : 'ok'} style={{ fontSize: 9 }}>{item.type}</Tag>
            </div>
            <div className="hc-cost-bar-track">
              <div
                className="hc-cost-bar-fill"
                style={{ width: `${(item.cost / maxCost) * 100}%`, background: colors[idx % colors.length] }}
              />
            </div>
            <div className="hc-cost-bar-value">
              <span className="cost">${item.cost.toFixed(2)}</span>
              <span className="tokens">{(item.tokens/1000).toFixed(1)}k</span>
            </div>
          </div>
        ))}
      </div>
    </div>
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

      <div className="hc-grid hc-grid-2">
        <Panel title="Custo por dia" icon="trending" sub="últimos 7 dias">
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

        <Panel title="Breakdown por Agente" icon="agents" sub="custo 24h">
          <CostBreakdownChart agents={data.agents} satellites={data.satellites} />
        </Panel>
      </div>

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

        <Panel title="Consumo detalhado" icon="database">
          <table className="hc-tbl">
            <thead><tr><th>Agente</th><th className="col-r">Tokens</th><th className="col-r">Custo</th><th className="col-r">%</th></tr></thead>
            <tbody>
              {data.agents.filter(a => a.cost24h > 0 || a.tokens24h > 0).map(a => {
                const totalCost = data.agents.reduce((sum, ag) => sum + (ag.cost24h || 0), 0) || 1;
                return (
                  <tr key={a.id}>
                    <td className="hc-text-primary">{a.id}</td>
                    <td className="mono col-r">{(a.tokens24h/1000).toFixed(1)}k</td>
                    <td className="mono col-r">${a.cost24h.toFixed(2)}</td>
                    <td className="mono col-r">{((a.cost24h / totalCost) * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
              {data.agents.filter(a => a.cost24h > 0 || a.tokens24h > 0).length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Sem consumo registrado</td></tr>
              )}
            </tbody>
          </table>
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
  const [sessions, setSessions] = usP([]);
  const [sel, setSel] = usP(null);
  const [transcript, setTranscript] = usP([]);
  const [loading, setLoading] = usP(true);
  const [loadingChat, setLoadingChat] = usP(false);
  const chatEndRef = urP(null);

  // Carrega sessões da API
  ueP(() => {
    setLoading(true);
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Carrega transcript quando seleciona sessão
  ueP(() => {
    if (!sel) {
      setTranscript([]);
      return;
    }
    setLoadingChat(true);
    fetch(`/api/sessions/${sel.id}/transcript?limit=100`)
      .then(r => r.json())
      .then(msgs => {
        setTranscript(msgs);
        setLoadingChat(false);
        // Scroll to bottom
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(() => setLoadingChat(false));
  }, [sel?.id]);

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'agora';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
      return d.toLocaleDateString('pt-BR');
    } catch { return ''; }
  };

  const agentAvatars = { adv: 'AD', araticum: 'AR', designer: 'DS', claudeclaw: 'CC' };

  return (
    <div className="hc-split">
      <Panel title="Sessões" icon="sessions" sub={`${sessions.length} sessões`} className="hc-split-list"
        actions={
          <button className="hc-btn sm ghost" onClick={() => {
            setLoading(true);
            fetch('/api/sessions').then(r => r.json()).then(d => { setSessions(d); setLoading(false); });
          }}>
            <Icon name="refresh" size={12} />
          </button>
        }>
        <div style={{ margin: -14 }}>
          {loading ? (
            <div className="hc-empty"><Icon name="refresh" size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : sessions.length === 0 ? (
            <div className="hc-empty"><Icon name="sessions" size={24} /><span>Nenhuma sessão</span></div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className={`hc-row ${sel?.id === s.id ? 'selected' : ''}`} onClick={() => setSel(s)}>
                <div className="hc-agent-avatar">{agentAvatars[s.agent] || s.agent?.substring(0, 2).toUpperCase()}<span className="dot ok" /></div>
                <div className="hc-grow" style={{ minWidth: 0 }}>
                  <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.threadId || s.id.substring(0, 8)}
                  </div>
                  <div className="hc-meta-line">{s.agent} · {s.turnCount || 0} turnos</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="hc-mono hc-muted" style={{ fontSize: 10 }}>{formatDate(s.lastActivity)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel
        title={sel ? (sel.threadId || 'Conversa') : 'Conversa'}
        icon="chat"
        sub={sel ? `${sel.agent} · ${sel.id.substring(0, 8)}` : 'Selecione uma sessão'}
        actions={sel && <Tag tone="accent">{sel.agent}</Tag>}
        className="hc-split-detail"
      >
        <div className="hc-chat-view">
          {!sel ? (
            <div className="hc-empty">
              <Icon name="chat" size={32} />
              <span>Selecione uma sessão para ver o histórico</span>
            </div>
          ) : loadingChat ? (
            <div className="hc-empty"><Icon name="refresh" size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : transcript.length === 0 ? (
            <div className="hc-empty">
              <Icon name="chat" size={32} />
              <span>Sem mensagens nesta sessão</span>
              <span className="hc-muted" style={{ fontSize: 11 }}>O transcript pode não estar disponível</span>
            </div>
          ) : (
            <div className="hc-chat-scroll">
              {transcript.map((m, i) => {
                // Parse content que pode ser JSON array
                let text = m.content;
                try {
                  const parsed = JSON.parse(m.content);
                  if (Array.isArray(parsed)) {
                    text = parsed.filter(p => p.type === 'text').map(p => p.text).join('\n');
                  } else if (parsed.text) {
                    text = parsed.text;
                  }
                } catch {}
                if (!text || text === '[]') return null;

                return (
                  <div key={i} className={`hc-chat-bubble ${m.role}`}>
                    <div className="hc-chat-bubble-avatar">
                      {m.role === 'user' ? 'DA' : agentAvatars[sel.agent] || 'AI'}
                    </div>
                    <div className="hc-chat-bubble-content">
                      <div className="hc-chat-bubble-header">
                        <span className="name">{m.role === 'user' ? 'Danilo' : sel.agent}</span>
                        {m.timestamp && <span className="time">{formatTime(m.timestamp)}</span>}
                      </div>
                      <div className="hc-chat-bubble-text">{text}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </Panel>
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

// Live Execution — Streaming de comandos em tempo real
function LiveExecutionPage({ data }) {
  const [executions, setExecutions] = usP([]);
  const [connected, setConnected] = usP(false);
  const [filter, setFilter] = usP('all');
  const wsRef = urP(null);
  const containerRef = urP(null);

  ueP(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history') {
          setExecutions(msg.data || []);
        } else if (msg.type === 'execution') {
          setExecutions(prev => {
            const existing = prev.findIndex(e => e.id === msg.data.id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = msg.data;
              return updated;
            }
            return [msg.data, ...prev].slice(0, 50);
          });
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    // Ping para manter conexão
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, []);

  // Auto-scroll quando novas execuções chegam
  ueP(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [executions.length]);

  const filtered = filter === 'all'
    ? executions
    : executions.filter(e => e.status === filter);

  const statusIcon = (status) => {
    switch (status) {
      case 'running': return '⟳';
      case 'completed': return '✓';
      case 'error': return '✗';
      default: return '•';
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'running': return 'var(--info)';
      case 'completed': return 'var(--success)';
      case 'error': return 'var(--danger)';
      default: return 'var(--muted)';
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Panel
      title="Live Execution"
      icon="terminal"
      sub={connected ? 'streaming ativo' : 'desconectado'}
      actions={
        <div className="hc-flex" style={{ gap: 8 }}>
          <span className={`hc-dot ${connected ? 'ok' : 'err'}`} style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: connected ? 'var(--success)' : 'var(--danger)',
            animation: connected ? 'pulse 2s infinite' : 'none'
          }} />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="hc-select sm"
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            <option value="all">Todos</option>
            <option value="running">Em execução</option>
            <option value="completed">Concluídos</option>
            <option value="error">Erros</option>
          </select>
        </div>
      }
    >
      <div
        ref={containerRef}
        className="hc-live-exec-container"
        style={{
          margin: -14,
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          fontFamily: 'var(--mono)'
        }}
      >
        {filtered.length === 0 ? (
          <div className="hc-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            {connected ? 'Aguardando execuções...' : 'Conectando ao servidor...'}
          </div>
        ) : (
          filtered.map((exec, i) => (
            <div
              key={exec.id}
              className="hc-exec-item"
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                backgroundColor: exec.status === 'running' ? 'var(--surface-hover)' : 'transparent',
                transition: 'background-color 0.2s'
              }}
            >
              <div className="hc-flex" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="hc-flex" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{
                    color: statusColor(exec.status),
                    fontSize: 14,
                    animation: exec.status === 'running' ? 'spin 1s linear infinite' : 'none'
                  }}>
                    {statusIcon(exec.status)}
                  </span>
                  <span className="hc-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {formatTime(exec.timestamp)}
                  </span>
                  {exec.exitCode !== undefined && exec.exitCode !== 0 && (
                    <Tag tone="err" style={{ fontSize: 10 }}>exit {exec.exitCode}</Tag>
                  )}
                </div>
                <span className="hc-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                  #{exec.id.slice(-6)}
                </span>
              </div>
              <div
                className="hc-exec-cmd"
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface)',
                  borderRadius: 4,
                  marginBottom: exec.output ? 8 : 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                <span style={{ color: 'var(--success)', marginRight: 8 }}>$</span>
                {exec.command}
              </div>
              {exec.output && (
                <pre
                  className="hc-exec-output"
                  style={{
                    fontSize: 11,
                    color: exec.status === 'error' ? 'var(--danger)' : 'var(--text-sec)',
                    margin: 0,
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg)',
                    borderRadius: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {exec.output.slice(0, 2000)}
                  {exec.output.length > 2000 && '\n... (truncado)'}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Panel>
  );
}

/* ============================================================
   KANBAN BOARD — Visualização de status de agentes/sessões
   ============================================================ */

const KANBAN_COLUMNS = {
  agents: [
    { key: 'working', label: 'Trabalhando', statuses: ['active', 'online', 'working'], icon: 'zap' },
    { key: 'waiting', label: 'Aguardando', statuses: ['waiting', 'idle', 'paused'], icon: 'clock' },
    { key: 'completed', label: 'Concluído', statuses: ['completed', 'done', 'finished'], icon: 'check' },
    { key: 'error', label: 'Erro', statuses: ['error', 'failed', 'crashed'], icon: 'alert' },
    { key: 'offline', label: 'Offline', statuses: ['offline', 'stopped', 'inactive'], icon: 'radio' },
  ],
  sessions: [
    { key: 'working', label: 'Ativas', statuses: ['active', 'running'], icon: 'zap' },
    { key: 'waiting', label: 'Aguardando', statuses: ['waiting', 'paused'], icon: 'clock' },
    { key: 'completed', label: 'Finalizadas', statuses: ['completed', 'done'], icon: 'check' },
    { key: 'error', label: 'Com Erro', statuses: ['error', 'failed'], icon: 'alert' },
  ],
};

function KanbanCard({ item, type }) {
  const isAgent = type === 'agents';
  const avatar = isAgent ? (item.avatar || item.id?.slice(0, 2).toUpperCase()) : '💬';
  const name = isAgent ? item.id : (item.name || item.id?.slice(0, 8));
  const role = isAgent ? item.role : item.cwd?.split('/').pop() || 'session';
  const description = isAgent ? item.description : item.lastMessage?.slice(0, 80);
  const model = item.model || 'claude';
  const cost = item.cost24h ?? item.cost ?? 0;
  const currentTool = item.currentTool || item.lastTool;

  return (
    <div className="hc-kanban-card">
      <div className="hc-kanban-card-head">
        <div className="hc-kanban-card-avatar">{avatar}</div>
        <div className="hc-kanban-card-title">
          <div className="name">{name}</div>
          <div className="role">{role}</div>
        </div>
      </div>
      {description && (
        <div className="hc-kanban-card-body">{description}</div>
      )}
      <div className="hc-kanban-card-meta">
        <span className="model">{model.replace('claude-', '').split('-')[0]}</span>
        <span className="cost">${cost.toFixed(2)}</span>
      </div>
      {currentTool && (
        <div className="hc-kanban-card-tool">
          <Icon name="terminal" size={12} stroke={1.75} />
          <span className="tool-name">{currentTool.name || currentTool}</span>
          {currentTool.args && (
            <span className="tool-args">{typeof currentTool.args === 'string' ? currentTool.args : JSON.stringify(currentTool.args).slice(0, 30)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, items, type }) {
  return (
    <div className={`hc-kanban-col ${column.key}`}>
      <div className="hc-kanban-header">
        <h3>
          <Icon name={column.icon} size={14} stroke={1.75} />
          {column.label}
        </h3>
        <span className="count">{items.length}</span>
      </div>
      <div className="hc-kanban-cards">
        {items.length === 0 ? (
          <div className="hc-kanban-empty">
            <Icon name={column.icon} size={24} stroke={1.5} />
            <span>Nenhum {type === 'agents' ? 'agente' : 'sessão'}</span>
          </div>
        ) : (
          items.map((item, i) => (
            <KanbanCard key={item.id || i} item={item} type={type} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanPage({ data }) {
  const [view, setView] = usP('agents');
  const columns = KANBAN_COLUMNS[view];

  // Agrupa itens por coluna baseado no status
  const items = view === 'agents' ? data.agents : data.sessions;

  const groupedItems = umP(() => {
    const groups = {};
    columns.forEach(col => {
      groups[col.key] = items.filter(item => {
        const status = (item.status || 'offline').toLowerCase();
        return col.statuses.some(s => status.includes(s));
      });
    });

    // Itens que não se encaixaram em nenhuma coluna vão para a última
    const assigned = new Set(Object.values(groups).flat().map(i => i.id));
    const unassigned = items.filter(i => !assigned.has(i.id));
    if (unassigned.length > 0) {
      const lastCol = columns[columns.length - 1].key;
      groups[lastCol] = [...groups[lastCol], ...unassigned];
    }

    return groups;
  }, [items, columns, view]);

  const totalActive = (groupedItems['working']?.length || 0) + (groupedItems['waiting']?.length || 0);

  return (
    <div className="hc-flex-col" style={{ gap: 16, height: '100%' }}>
      <div className="hc-flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hc-flex" style={{ gap: 12, alignItems: 'center' }}>
          <div className="hc-kanban-toggle">
            <button
              className={view === 'agents' ? 'active' : ''}
              onClick={() => setView('agents')}
            >
              <Icon name="agents" size={12} stroke={1.75} /> Agentes
            </button>
            <button
              className={view === 'sessions' ? 'active' : ''}
              onClick={() => setView('sessions')}
            >
              <Icon name="sessions" size={12} stroke={1.75} /> Sessões
            </button>
          </div>
          <span className="hc-muted" style={{ fontSize: 12 }}>
            {totalActive} {view === 'agents' ? 'ativos' : 'ativas'} de {items.length}
          </span>
        </div>
        <Tag tone="accent">
          <Icon name="dot" size={8} /> Live
        </Tag>
      </div>

      <div className="hc-kanban">
        {columns.map(col => (
          <KanbanColumn
            key={col.key}
            column={col}
            items={groupedItems[col.key] || []}
            type={view}
          />
        ))}
      </div>
    </div>
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
window.LiveExecutionPage = LiveExecutionPage;
window.KanbanPage = KanbanPage;
window.PlaceholderPage = PlaceholderPage;
