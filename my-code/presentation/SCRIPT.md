# my-code — 10-Minute Client Walkthrough Script

**Audience:** client decision-makers (engineering + security + budget owners)
**Goal:** move them from "interesting" to "let's run a pilot."
**Delivery:** ~130 words/minute, unhurried. Pause after every bold line. Warm, certain, no jargon you don't explain. You are not selling a tool — you are handing them control.

| Time | Section | On screen |
|---|---|---|
| 0:00–1:00 | The hook | Intro |
| 1:00–2:00 | What my-code is | Intro |
| 2:00–3:00 | Make it real (the demo beat) | Intro / live terminal |
| 3:00–5:45 | The walkthrough | Feature map |
| 5:45–8:00 | How it compares | Comparison |
| 8:00–9:15 | Why it matters to the business | Comparison |
| 9:15–10:00 | The close & the ask | Intro |

---

## [0:00] The hook — *ON SCREEN: Intro*

*Open calm. Don't rush the first line.*

Good morning. Let me start with one question.

Your developers are already using AI to write code. The only real question is — **where is your code going when they do?**

Every time an engineer types into a cloud AI assistant, your source code — your intellectual property — leaves your building. And for a lot of teams, that is where the conversation ends. Not because the tools aren't good. They're excellent. But "excellent" doesn't matter if security, legal, and compliance can't sign off on it.

So we asked a simple question. What if you could have a state-of-the-art AI coding agent — the kind that plans, edits files, runs commands, the whole thing — **but it ran entirely on your own machines, on models you control, with code that never touches anyone else's cloud?**

That is my-code.

## [1:00] What my-code is — *ON SCREEN: Intro*

my-code is a terminal-native AI coding agent. It lives exactly where your engineers already work — the command line — and it drives your models, on your hardware.

Think of it not as autocomplete, but as **a teammate.** You give it a goal — "fix this bug," "add this feature," "refactor this module" — and it reasons about the problem, reads your codebase, makes the change, runs the tests, and comes back with a result. All locally. All private.

And here's the part that changes everything: **we built it, so we own every line of it.** It's not a subscription. It's an asset.

## [2:00] Make it real — *ON SCREEN: Intro (or live terminal, if demoing)*

*If you can live-demo, do it here. If not, narrate it — paint the picture.*

Let me make that concrete. Say an engineer needs to add rate-limiting to an API endpoint.

They type the request in plain English. my-code searches the codebase, finds the endpoint and the middleware, and proposes the change. It shows a diff. It asks permission before touching anything. It applies the change, runs the tests — and if a test fails, it **reads the error and fixes itself,** iterating until everything's green.

Start to finish, on their laptop, in a couple of minutes. No copy-pasting into a browser. No context-switching. **And not a single line of code left the room.**

## [3:00] The walkthrough — *ON SCREEN: Feature map*

Here's what's under the hood. At the center is my-code, and everything radiates out from one engine.

That engine — **Agent Core** — is the reasoning loop. It streams its thinking in real time, it plans before it acts, and when a task gets large, it compacts its own context so it never loses the thread.

To actually get work done, it has **Tools** — around thirty of them. It reads and edits files, runs shell commands, searches the codebase, browses the web, manages Git worktrees. These are its hands.

Now here's what matters most for *you*. my-code is built to **extend.** Through MCP — the open Model Context Protocol — it plugs into your internal systems: your tickets, your databases, your docs. Your team writes **Skills** — reusable commands in plain Markdown — and **Plugins** to teach it your workflows. It isn't a fixed product. It's a platform you shape.

It **remembers.** Like a good teammate, it carries context. It reads a `my-code.md` file for your project's rules, and it uses RAG — retrieval over an indexed memory — to recall what matters, when it matters.

It's **fast**, because it caches aggressively — reusing a stable prompt prefix instead of paying to re-read the same thing every single turn.

It's **safe.** Nothing destructive happens without permission. There's a permission engine — allow, deny, or ask — directory trust, and hooks so you can enforce your own guardrails.

And it **scales.** It can spin up sub-agents — swarms — to divide and conquer a big job, run tasks in the background, and even schedule work on a timer.

That is a complete agent. Local. Private. Yours.

## [5:45] How it compares — *ON SCREEN: Comparison*

Now — you know the big names here. Claude Code. GitHub Copilot. Excellent products. So let's be honest about how we stack up.

Start with the row that matters most: **where it runs.** Claude Code runs on Anthropic's cloud. Copilot runs on GitHub's cloud. my-code runs fully on your machine. **Your code stays home.**

**Autonomy** — all three can now act on multi-step tasks. We're in the same league: an agentic loop, with sub-agents.

**Memory** — Copilot indexes your repo; Claude Code uses its CLAUDE.md files. We do both patterns — a `my-code.md` for rules, and RAG retrieval for recall.

**Models** — and this one's big. Claude Code gives you Claude. Copilot gives you a hosted menu. my-code gives you **any open model you can run on Ollama.** When a better open model ships next month, you just switch. No contract to renegotiate.

**Extending it** — MCP, skills, sub-agents — we're right there with the best of them.

So the pattern is clear. On raw capability, we're competitive. On **control, privacy, and cost — we're in a different category entirely.** Because those are products you rent. **my-code is an asset you own.**

## [8:00] Why it matters to the business — *ON SCREEN: Comparison*

So what does that actually mean for the business? Three things.

**One — compliance and IP.** Your code never leaves your perimeter. That turns a "no" from security into a "yes." You can put AI in the hands of teams that legally could not touch a cloud tool.

**Two — cost.** Cloud assistants are per-seat, per-month, forever — and the bill grows with every hire. my-code runs on hardware you already own. The marginal cost of the next developer is essentially zero.

**Three — no lock-in.** You're not betting your workflow on one vendor's roadmap or one vendor's pricing. The models are swappable. The code is yours. The direction is yours.

## [9:15] The close & the ask — *ON SCREEN: Intro*

*Slow down. This is the landing.*

Here's the bottom line.

The question was never *whether* your teams will use AI to build software. They already are. The real question is whether they'll do it on **someone else's terms — or on yours.**

my-code gives you the same power the whole market is excited about — the agent, the tools, the autonomy — but private, owned, and built to fit you.

Here's what I'd like to do. Give us **one real repository and one team, for a two-week pilot.** Let the results speak for themselves. If it earns its place, we scale it. If it doesn't, you've risked two weeks.

Let's pick the team to start with.

*Thank you. — pause, invite questions.*

---

## Anticipated questions (prep — not part of the 10 minutes)

**"Is a local open model really good enough versus GPT or Claude?"**
For the majority of day-to-day engineering — the bug fixes, the refactors, the boilerplate — yes. And because models are swappable, you ride the open-model curve, which is closing the gap fast. Run the largest model your hardware supports; scale the hardware when it pays for itself. For sensitive code, "good and private" beats "best and exposed."

**"How is this different from just running Ollama ourselves?"**
Ollama is the engine. my-code is the entire agent built around it — the tools, the memory, the permissions, the workflow integrations. Ollama answers a question; my-code does the job.

**"Isn't there setup and maintenance overhead?"**
It's a single CLI. It runs on the dev machines you already have, or a shared GPU box. And because we own the code, we maintain and evolve it on your priorities — not a vendor's.

**"It runs shell commands — how do we keep that safe?"**
Nothing runs without passing the permission engine — allow, deny, or ask — plus directory trust and hooks for your own policies. Every session is transcribed, so there's a full audit trail.

**"Build-and-own versus just buying seats — what's the real ROI?"**
Per-seat SaaS is a cost that compounds forever and scales with headcount. my-code is a one-time asset with near-zero marginal cost per developer — and it removes a compliance blocker that a cloud tool can't. The bigger your team, the wider the gap.
