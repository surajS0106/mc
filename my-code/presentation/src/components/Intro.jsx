const HIGHLIGHTS = [
  { t: 'Runs locally', d: 'Ollama-first — your code stays on your machine.' },
  { t: 'Agentic', d: 'Plans, calls tools, and iterates to complete tasks.' },
  { t: 'Extensible', d: 'MCP servers, skills, and plugins add capabilities.' },
]

const PILLS = ['Ollama-first', 'MCP-enabled', '~30 tools', 'TypeScript · Bun', 'Dual TUI', 'Sub-agents']

export default function Intro() {
  return (
    <section className="intro">
      <div className="intro-inner">
        <p className="kicker">Terminal coding agent</p>
        <h1 className="intro-title">my&#8209;code</h1>
        <p className="lede">
          An Ollama-first coding agent that lives in your terminal — an agentic tool-use loop with
          MCP, skills, plugins, memory and caching built in.
        </p>

        <div className="pills">
          {PILLS.map((p) => (
            <span className="pill" key={p}>{p}</span>
          ))}
        </div>

        <div className="highlights">
          {HIGHLIGHTS.map((h) => (
            <div className="hl" key={h.t}>
              <div className="hl-t">{h.t}</div>
              <div className="hl-d">{h.d}</div>
            </div>
          ))}
        </div>

        <a className="scroll-cue" href="#map">
          Explore the feature map
          <span className="arrow" aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  )
}
