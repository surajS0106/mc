// How each tool tackles the same hard problems. Approaches are simplified,
// and the competing tools evolve quickly — edit any cell to match reality.
const COLS = [
  { key: 'mycode',  name: 'my-code',        tag: 'this project',        brand: true },
  { key: 'claude',  name: 'Claude Code',    tag: "Anthropic's CLI" },
  { key: 'copilot', name: 'GitHub Copilot', tag: 'IDE assistant' },
]

const ROWS = [
  { c: 'Runs where',
    mycode:  'Fully on your machine',
    claude:  'Anthropic cloud API',
    copilot: 'GitHub cloud service' },
  { c: 'Autonomy',
    mycode:  'Agentic loop + sub-agents / swarms',
    claude:  'Agentic loop + subagents',
    copilot: 'Agent mode (multi-file edits)' },
  { c: 'Memory',
    mycode:  'my-code.md + RAG retrieval over indexed memory',
    claude:  'CLAUDE.md + /memory files loaded into context',
    copilot: 'Repo index + custom-instructions file' },
  { c: 'Models',
    mycode:  'Local Ollama — any open model',
    claude:  'Claude · Opus / Sonnet / Haiku',
    copilot: 'GPT · Claude · Gemini (hosted)' },
  { c: 'Extending it',
    mycode:  'MCP · skills · subagents',
    claude:  'MCP · skills · subagents · hooks',
    copilot: 'MCP · Copilot Extensions' },
  { c: 'Long-context handling',
    mycode:  'KV-prefix cache + auto-compaction',
    claude:  'Prompt caching + auto-compact summaries',
    copilot: 'Retrieves only the relevant snippets' },
]

export default function Compare() {
  return (
    <section className="compare-section" id="compare">
      <div className="compare-inner">
        <header className="cmp-head">
          <p className="kicker" style={{ color: '#5b5be6' }}>How it compares</p>
          <h2 className="cmp-title">Same problems, different solutions</h2>
          <p className="cmp-sub">
            my-code, Claude Code and Copilot all pair-program with you — but each tackles memory,
            context and codebase understanding in its own way.
          </p>
        </header>

        <div className="table-scroll">
          <table className="cmp">
            <thead>
              <tr>
                <th className="rowhead" />
                {COLS.map((col) => (
                  <th key={col.key} className={col.brand ? 'col-mycode head' : 'head'}>
                    <span className="pname">
                      {col.brand && <span className="pdot" />}
                      {col.name}
                    </span>
                    <span className="ptag">{col.tag}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.c}>
                  <th scope="row" className="rowhead">{r.c}</th>
                  <td className="col-mycode"><span className="approach">{r.mycode}</span></td>
                  <td>{r.claude}</td>
                  <td>{r.copilot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="cmp-note">Approaches are simplified for clarity; these tools evolve quickly.</p>
      </div>
    </section>
  )
}
