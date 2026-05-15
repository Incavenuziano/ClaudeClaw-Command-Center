/* ClaudeClaw Command Center — Reusable primitives */
const { useState: useStateP, useEffect: useEffectP, useMemo: useMemoP } = React;

function Stat({ label, value, delta, deltaDir, icon, spark }) {
  return (
    <div className="hc-stat">
      <div className="hc-stat-head">
        <span>{label}</span>
        {icon && <Icon name={icon} size={14} stroke={1.75} />}
      </div>
      <div className="hc-stat-val">{value}</div>
      {delta && (
        <div className="hc-stat-meta">
          <span className={deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : ''}>{delta}</span>
          <span className="hc-muted">vs ontem</span>
        </div>
      )}
      {spark && <Sparkline className="hc-stat-spark" values={spark} />}
    </div>
  );
}

function Sparkline({ values, className, strokeOnly }) {
  const w = 120, h = 40, pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const fill = path + ` L${w - pad} ${h - pad} L${pad} ${h - pad} Z`;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cc-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {!strokeOnly && <path d={fill} fill="url(#cc-spark-grad)" />}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function Panel({ title, icon, sub, children, actions, foot, className, style }) {
  return (
    <section className={`hc-panel ${className || ''}`} style={style}>
      {(title || actions) && (
        <header className="hc-panel-head">
          <h2>
            {icon && <Icon name={icon} size={14} stroke={1.75} />}
            {title}
            {sub && <span className="sub">{'·'} {sub}</span>}
          </h2>
          {actions && <div className="hc-flex">{actions}</div>}
        </header>
      )}
      <div className="hc-panel-body">{children}</div>
      {foot && <footer className="hc-panel-foot">{foot}</footer>}
    </section>
  );
}

function Tag({ children, tone }) { return <span className={`hc-tag ${tone || ''}`}>{children}</span>; }

function Bar({ value, max = 100, tone }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="hc-bar"><div className={`hc-bar-fill ${tone || ''}`} style={{ width: pct + '%' }} /></div>
  );
}

function FeedItem({ event, isNew }) {
  return (
    <div className={`hc-feed-item ${event.tone || ''} ${isNew ? 'new' : ''}`}>
      <div className="hc-feed-time">{event.t}</div>
      <div className="hc-feed-rail"><span className="node" /></div>
      <div className="hc-feed-content">
        <div className="title">{event.title}</div>
        <div className="desc">
          <span className="mono">{event.kind}</span>
          {event.detail && <span> {'·'} {event.detail}</span>}
        </div>
      </div>
      <div className="hc-feed-side">{event.source}</div>
    </div>
  );
}

function agentStatusTone(s) {
  return s === 'active' ? 'ok' : s === 'idle' ? '' : s === 'degraded' ? 'warn' : s === 'paused' ? 'warn' : s === 'completed' ? '' : '';
}

function ProcessoRow({ p }) {
  const statusTone = p.status === 'ativo' ? 'ok' : p.status === 'segredo' ? 'warn' : '';
  return (
    <div className="hc-row">
      <div className="hc-grow">
        <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{p.numero}</div>
        <div className="hc-meta-line">{p.cliente} · {p.fase}</div>
      </div>
      <Tag tone={statusTone}>{p.status}</Tag>
      {p.novidades && <Tag tone="acc">NOVO</Tag>}
    </div>
  );
}

function SatelliteRow({ s }) {
  const statusTone = s.status === 'online' ? 'ok' : 'err';
  return (
    <div className="hc-row">
      <Icon name="channels" size={14} stroke={1.75} style={{ color: s.status === 'online' ? 'var(--success)' : 'var(--danger)' }} />
      <div className="hc-grow">
        <div className="hc-text-primary" style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
        <div className="hc-meta-line">última msg {s.lastMsg} · {s.msgs24h} msgs/24h</div>
      </div>
      <Tag tone={statusTone}>{s.status}</Tag>
    </div>
  );
}

window.Stat = Stat;
window.Sparkline = Sparkline;
window.Panel = Panel;
window.Tag = Tag;
window.Bar = Bar;
window.FeedItem = FeedItem;
window.agentStatusTone = agentStatusTone;
window.ProcessoRow = ProcessoRow;
window.SatelliteRow = SatelliteRow;
