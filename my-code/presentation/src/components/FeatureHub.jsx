import { useEffect, useMemo, useRef, useState } from 'react'

const W = 1160, H = 720, CX = 580, CY = 360, RX = 442, RY = 250

const ICONS = {
  core: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  tools: '<line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.3" fill="var(--card)"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.3" fill="var(--card)"/>',
  ext: '<rect x="3.5" y="3.5" width="8" height="8" rx="1.6"/><rect x="12.5" y="12.5" width="8" height="8" rx="1.6"/><path d="M11.5 7.5h4a1 1 0 0 1 1 1v4"/>',
  memory: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  cache: '<polygon points="13 2 4 13.5 11 13.5 10 22 20 9.5 13 9.5 13 2" fill="currentColor" stroke="none"/>',
  safety: '<path d="M12 2.5l8 3v5.5c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10V5.5z"/><path d="M8.6 12l2.3 2.3 4.5-4.6" stroke-width="1.8"/>',
  sub: '<circle cx="12" cy="4.5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M11 6.6 6.2 15.6M13 6.6l4.8 9M7.4 18h9.2"/>',
  ui: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M6.5 9.5l3 2.5-3 2.5M12 15h5" stroke-width="1.8"/>',
}

const NODES = [
  { k: 'core',   ac: '#e0871c', t: 'Agent Core',             d: 'agentic loop · streaming · compaction · plan mode · prompt builder · multi-provider' },
  { k: 'ext',    ac: '#3b6fd4', t: 'Extensibility',          d: 'MCP (+ resources) · Skills · Commands · Plugins' },
  { k: 'tools',  ac: '#7c5cd6', t: 'Tools',                  d: '~30 built-ins: file · shell · search · web · notebook · worktrees · tool search' },
  { k: 'cache',  ac: '#0ea3c4', t: 'Caching',                d: 'KV prefix · file-state · quota · section memo' },
  { k: 'memory', ac: '#12a673', t: 'Memory & Knowledge',     d: 'long-term · AutoDream · session resume · LSP diagnostics' },
  { k: 'safety', ac: '#e11d6b', t: 'Safety & Control',       d: 'permissions · directory trust · hooks · accounts' },
  { k: 'ui',     ac: '#5b5be6', t: 'Interfaces & Sessions',  d: 'dual TUI · IDE bridge · sessions · git · undo · cost / usage' },
  { k: 'sub',    ac: '#64748b', t: 'Sub-agents & Automation', d: 'swarms · background tasks · cron schedules · delegate' },
]

export default function FeatureHub() {
  const wrapRef = useRef(null)
  const [focus, setFocus] = useState(null)
  const [scale, setScale] = useState(1)
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const layout = useMemo(() =>
    NODES.map((nd, i) => {
      const ang = (-90 + i * (360 / NODES.length)) * Math.PI / 180
      const x = CX + RX * Math.cos(ang)
      const y = CY + RY * Math.sin(ang)
      let dx = x - CX, dy = y - CY
      const len = Math.hypot(dx, dy)
      return { ...nd, x, y, dx: dx / len, dy: dy / len }
    }), [])

  useEffect(() => {
    function fit() {
      const wrap = wrapRef.current
      if (!wrap) return
      const s = Math.min(wrap.clientWidth * 0.95 / W, wrap.clientHeight * 0.86 / H, 1.15)
      setScale(s)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <section className="map-section" id="map" ref={wrapRef}>
      <div className="map-cap">my-code · feature map</div>

      <div
        className={'board' + (focus !== null ? ' focus' : '')}
        style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})` }}
      >
        <svg className="links" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {layout.map((nd, i) => (
            <g key={i} className={'lg' + (focus === i ? ' hot' : '')}>
              <line className="link halo" x1={CX} y1={CY} x2={nd.x} y2={nd.y}
                    stroke={nd.ac} strokeWidth="7" strokeLinecap="round" />
              <line className="link core-line" x1={CX} y1={CY} x2={nd.x} y2={nd.y}
                    stroke={nd.ac} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              <circle cx={CX + nd.dx * 100} cy={CY + nd.dy * 100} r="3.4" fill={nd.ac} />
              <circle cx={nd.x - nd.dx * 116} cy={nd.y - nd.dy * 116} r="3.4" fill={nd.ac} />
            </g>
          ))}
        </svg>

        {!reduce && layout.map((nd, i) => (
          <span
            key={'f' + i}
            className="flow-dot"
            style={{
              background: nd.ac,
              offsetPath: `path('M ${nd.x} ${nd.y} L ${CX} ${CY}')`,
              animationDuration: `${3.4 + i * 0.35}s`,
            }}
          />
        ))}

        {layout.map((nd, i) => (
          <div
            key={'n' + i}
            className={'node' + (focus === i ? ' hotn' : '')}
            style={{ left: nd.x, top: nd.y, ['--ac']: nd.ac }}
            onMouseEnter={() => setFocus(i)}
            onMouseLeave={() => setFocus(null)}
          >
            <div className="nh">
              <span
                className="ic"
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[nd.k]}</svg>`,
                }}
              />
              <span className="nt">{nd.t}</span>
            </div>
            <div className="nd">{nd.d}</div>
          </div>
        ))}

        <div className="hub" style={{ left: CX, top: CY }}>
          <div>
            <div className="logo">mc</div>
            <h2>my-code</h2>
            <p>coding agent</p>
          </div>
        </div>
      </div>
    </section>
  )
}
