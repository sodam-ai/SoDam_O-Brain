<!-- English: this file · 한국어: README.md · Full guide: GUIDE.en.md · (This document and README.en.html have identical content) -->

# SoDam O-Brain — AI Memory System

> **A 100% local memory tool that automatically saves important decisions and notes from your AI conversations, and visualizes them as a knowledge graph.**

**In one line:** AI is brilliant but forgets everything the moment a chat ends.
O-Brain is the **auto-notepad** you keep next to that AI — it writes down what matters and brings it back whenever you need it.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Prerequisites](#prerequisites)
3. [How to Download](#how-to-download)
4. [Installation (2 Steps)](#installation-2-steps)
5. [Claude Code Plugin (Optional)](#claude-code-plugin-optional)
6. [MCP Tool Integration (Claude Code)](#mcp-tool-integration-claude-code)
7. [Quick Start](#quick-start)
8. [Running · Usage](#running--usage)
9. [Key Commands](#key-commands)
10. [File & Data Locations](#file--data-locations)
11. [Workflow](#workflow)
12. [Architecture Summary](#architecture-summary)
13. [Security Overview · Data Flow](#security-overview--data-flow)
14. [Changelog](#changelog)
15. [Troubleshooting Quick Reference](#troubleshooting-quick-reference)
16. [FAQ](#faq-frequently-asked-questions)
17. [License · Copyright · Commercial Use](#license--copyright--commercial-use)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **100% Local** | All memories stay on your PC only. No external server or cloud transfer |
| **Hybrid Search** | Keyword (FTS5) + semantic similarity (vector search) simultaneously |
| **Knowledge Graph** | Visualize memories as 2D/3D dots and lines |
| **Time Travel** | Query memories that were "alive" on any past date |
| **Confidence Decay** | AI-extracted memories auto-decay with a 30-day half-life |
| **Security Filter** | API keys and passwords auto-removed before saving (`[REDACTED]`) |
| **Auto Backup** | Snapshot created automatically on server start and before bulk delete |
| **MCP Integration** | 7 tools for saving/searching/linking memories directly from Claude Code |
| **Orphan Node Visual** | Memories with no user-defined relations shown with a dashed ring |
| **Multi-select & Bulk Delete** | Select multiple memories and delete at once + 10-second undo |
| **⚙ Settings Page** | Adjust list page size, graph node count, auto-refresh, theme, and intro banner directly in the app — saved to your browser so it persists |
| **Duplicate Cleanup** | Auto-detects similar memory pairs and lets you review, merge, or delete (backed up + 10-second undo) |
| **API Token Verification** | Every API request is checked against a local token; missing or wrong tokens are rejected |
| **Performance Guard** | Auto-simplifies graph computation once memories exceed 1,500 to prevent freezing |

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| OS | Windows 10 / 11 (64-bit) |
| Node.js | 20.x LTS or higher (free from [nodejs.org](https://nodejs.org)) |
| Storage | 500 MB+ (includes ~90 MB embedding model) |
| RAM | 4 GB+ (8 GB+ recommended) |
| Browser | Chrome, Edge, Firefox, etc. |

> Claude Code is only required for MCP integration or plugin installation. The web dashboard works without it.

---

## How to Download

If you're reading this, the O-Brain files are already on your computer. Just locate the project folder (absolute path on this PC).

If using Git (for developers):

```bash
git clone [repository URL]
cd [folder name]
```

> Access permission is required if the repository is private.

---

## Installation (2 Steps)

**Step 1: Install dependencies (in a terminal)**

```bash
cd D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app
npm install
```

**Step 2: Start the server**

```bash
npm start
```

→ When you see `O-Brain Local Server ▶ http://127.0.0.1:7740`, it's running.

**Open in browser:**

```
http://127.0.0.1:7740
```

> **First run:** automatically downloads the AI embedding model (~90 MB). Takes 1–3 minutes. All subsequent runs start instantly.

---

## Claude Code Plugin (Optional)

If you use Claude Code, you can also install it as a plugin. **You must run this in two separate steps** (attempting both at once causes a "Marketplace not found" error):

```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\plugin
/plugin install o-brain@o-brain-local
```

Restart Claude Code after installation → slash commands become available:

| Command | What it does |
|---------|---------------|
| `/o-brain:status` | View current memory count and status |
| `/o-brain:selftest` | Run save/search/security checks (✅✅✅ = OK) |
| `/o-brain:remember` | Extract and save decisions from current chat |
| `/o-brain:link` | Link memories with a relation |
| `/o-brain:backup` | Create a manual backup |
| `/o-brain:open` | Open the dashboard in your browser (auto-starts the server if it's off) |

---

## MCP Tool Integration (Claude Code)

Register in Claude Code's `settings.json` to save/search memories mid-conversation:

```json
{
  "mcpServers": {
    "o-brain": {
      "command": "node",
      "args": ["C:/absolute/path/to/app/src/mcp-server.mjs"]
    }
  }
}
```

> Use an **absolute path** with forward slashes (`/`) — backslashes (`\`) may cause problems.

Available MCP tools: `save_memory`, `search_memory`, `get_memory`, `get_related`, `get_timeline`, `add_relation`, `list_categories`

---

## Quick Start

1. `npm install` (once) → `npm start`
2. Open `http://127.0.0.1:7740` in your browser
3. (Claude Code users) Speak a clear decision during a normal conversation, then run `/clear` → it's saved automatically
4. Use **⚙ Settings** in the top right to adjust list size, graph node count, and more to your taste

Full step-by-step guide: **[GUIDE.en.md](./GUIDE.en.md)**

---

## Running · Usage

### Running

```bash
# Run from the app/ folder
npm start                              # Start server (default port 7740)
$env:OBRAIN_PORT=7741; npm start       # Start on a different port (PowerShell)
```

Stop the server: `Ctrl + C` in the terminal.

### Usage — Web Dashboard (5 tabs)

| Tab | Description |
|-----|-------------|
| **Graph** | Knowledge map showing memories as dots and lines. Home screen. |
| **Overview** | Total memory count, distribution by type/category, most-connected memories |
| **List** | Memories as cards. Select mode allows bulk delete |
| **Timeline** | Memories in chronological order |
| **⚙ Settings** | Adjust page size for List/Timeline/Overview, graph node count, auto-refresh on/off and interval, theme, and intro banner visibility — 5 controls in one page. Values are saved to your browser (localStorage) and persist across visits |

For detailed usage (graph interaction, linking relations, search, time travel, bulk delete, etc.), see **[GUIDE.en.md](./GUIDE.en.md)** Section 7.

---

## Key Commands

```bash
# Run from the app/ folder
npm start          # Start server (port 7740)
npm run selftest   # Run self-diagnostics
npm run backup     # Manual backup
npm run status     # View DB stats
npm run seed       # Add sample data (for testing)
```

Full HTTP API endpoint list and MCP tool input/output table: **[GUIDE.en.md Section 10](./GUIDE.en.md#10-complete-command-reference)**.

---

## File & Data Locations

| Item | Location |
|------|----------|
| Memory database | `app/data/obrain.db` |
| Auto backups | `app/data/backup/` (keeps latest 7) |
| API token file | `app/data/.api-token` (regenerated each run) |
| Personal settings | `app/.env.local` (uses defaults if absent) |
| These documents | Project root (`README.md`/`GUIDE.md`, English variants, and each `.html`) |

### Environment Variables (`app/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OBRAIN_PORT` | `7740` | Server port number |
| `OBRAIN_DATA_DIR` | `./data` | Data storage folder |

---

## Workflow

**General user (web UI focused):** Start with `npm start` in the morning → review yesterday's memories → add important decisions directly during work → link related memories and clean up in the evening.

**Claude Code user (MCP/plugin):** Speak decisions during chat, end the session with `/clear` → auto-saved → occasionally open the dashboard with `/o-brain:open` → back up regularly with `/o-brain:backup`.

Full workflow details: **[GUIDE.en.md Section 11](./GUIDE.en.md#11-workflow-typical-daily-usage)**.

---

## Architecture Summary

```
[Claude Code / Browser]
        ↓
[Express Server 127.0.0.1:7740]
        ↓
[Security Filter] → [Embedding (local AI)] → [SQLite DB]
                                               ├── FTS5 (keyword search)
                                               └── sqlite-vec (vector search)
```

Tech stack: Node.js ES Modules · Express.js v5 · SQLite (better-sqlite3) · sqlite-vec · @huggingface/transformers (all-MiniLM-L6-v2) · force-graph / 3d-force-graph · @modelcontextprotocol/sdk

---

## Security Overview · Data Flow

- Server binds **only to 127.0.0.1 (your PC)** — not reachable from external devices
- **API keys and passwords auto-removed** before saving (processed by redact.mjs)
- New **local API token** auto-generated each server start (crypto.randomBytes)
- `data/`, `.env.local`, `*.sqlite` are in `.gitignore` — never committed to Git
- No external cloud communication. Embedding model runs entirely locally
- Input validation: invalid IDs, out-of-range numbers, and disallowed CORS origins are all safely rejected by the server with 400/403/404 (verified by testing)

Full data flow diagram and security header list: **[GUIDE.en.md Section 12](./GUIDE.en.md#12-security--data-flow)**.

---

## Changelog

Most recent entries first. Click any entry to expand it.

<details>
<summary><b>2026-07-11 — 300x graph performance improvement, duplicate memory cleanup, security hardening, full functional verification</b></summary>

- **Graph performance**: Graph generation took 9.8s at 5,000 memories; added an auto-simplify guard past 1,500 memories, cutting this to 8ms (~300x).
- **Duplicate memory cleanup**: New Overview-tab feature that auto-detects similar memory pairs for review, then lets you "Keep A / Keep B / Combine both" (backed up + 10-second undo).
- **Security hardening**: The local API token was issued but never actually checked — now every request is verified. Fixed a gap where saving a memory via the API could accept out-of-range importance/confidence values.
- **Full functional verification**: Directly executed all 19 HTTP API routes, all 7 MCP tools, both session hooks (run against a real conversation transcript), and the live web browser (2D/3D graph, search, script-injection defense) — 90+ test cases total.
</details>

<details>
<summary><b>2026-07-06 — New ⚙ Settings page + 2 bugs found and fixed during real-world testing</b></summary>

- List/Timeline/Overview page size is now adjustable (50/100/200/500/custom, 1–500), saved to your browser so it persists across visits.
- The header ⚙ button now opens a **real 5th tab (a full settings page)**. Added graph node count (50–2000), auto-refresh on/off and interval (10–300s), theme (light/dark), and intro banner visibility — 5 controls total.
- **Bug fix 1**: Entering a decimal (e.g. 500.7) for graph node count caused a server 500 error and an unhandled exception on screen — fixed by forcing integers on both server and client.
- **Bug fix 2**: The bulk-delete confirmation said "undo within 10 seconds" but the actual undo button disappeared after 5.5 seconds — unified to 10 seconds.
</details>

<details>
<summary><b>2026-07-06 — Session-source display, search truncation transparency, confidence decay bug fix</b></summary>

- Added a "Saved in session · N hours ago" tag to memory detail view (helps when running multiple Claude Code windows at once).
- Fixed search results silently truncating — now shows "N more related memories" when results are cut off by `limit`.
- Fixed a bug where confidence decay dropped existing memories to the floor immediately on first run.
</details>

<details>
<summary><b>2026-07-05 — Bulk-delete verified end-to-end + display bug fix, full MCP tool verification</b></summary>

- Verified the full multi-select → bulk delete → confirmation modal → undo toast flow live in the browser.
- Found and fixed a bug where the delete/cancel toolbar didn't appear when entering select mode.
- Verified all 7 MCP tools (save_memory, search_memory, get_memory, get_related, get_timeline, list_categories, add_relation) via the actual protocol.
</details>

<details>
<summary><b>2026-06-28 to 2026-06-29 — Convenience features (M3) · Noise cleanup (M4) · scope filter</b></summary>

- Duplicate-save prevention (near-identical memories are skipped, with a reason returned).
- MCP `add_relation` tool, `/o-brain:link` command (suggests candidates → human confirms the relation type).
- Dashboard multi-select bulk delete (confirmation + undo), touch-target accessibility fixes.
- scope (global/project) filter, formal Apache-2.0 license adoption, removed paid Haiku API dependency (replaced with reusing the host LLM).
</details>

<details>
<summary><b>2026-06-20 to 2026-06-23 — Initial implementation (M1·M2) · Security hardening</b></summary>

- save_memory MCP tool, `/o-brain:remember`, rule-based input sanitization ("memory quality" work).
- Dashboard mobile readability and touch targets ≥44px.
- Dashboard XSS protection, CSP/security headers added.
</details>

The complete milestone-by-milestone history is in the project's `CHECKPOINT.md` (a development reference document).

---

## Troubleshooting Quick Reference

| Symptom | Fix |
|---------|-----|
| `'node' is not recognized` | Install LTS from [nodejs.org](https://nodejs.org) → **open a new terminal** |
| `EADDRINUSE :::7740` | Add `OBRAIN_PORT=7741` to `.env.local` and restart |
| Graph is empty | Run `npm run seed` to add sample data |
| Browser won't connect | Confirm `npm start` is running → check address is `http://127.0.0.1:7740` |
| Embedding download fails | Check internet connection · allow Node.js through firewall |
| Accidentally deleted a memory | Click "Undo" on screen within 10 seconds. If it's too late, restore from the latest `.db` file in `app/data/backup/` |
| Changed a count in Settings but the graph didn't change | This is expected — the Graph tab uses a separate "node count" setting (different from the list page size) |

More symptom-specific fixes: **[GUIDE.en.md Section 15](./GUIDE.en.md#15-troubleshooting)**.

---

## FAQ (Frequently Asked Questions)

**Q. Where is my data stored?**
A. Only in `app/data/obrain.db` (an SQLite file). Nothing is sent externally.

**Q. Does it cost anything?**
A. O-Brain itself is free. If you use Claude Code or the Anthropic API, those services' fees may apply separately.

**Q. Are the graph node count and the list page size the same setting?**
A. No. In the ⚙ Settings page, "page size" applies only to List/Timeline/Overview, while "graph node count" applies only to the Graph tab.

More FAQs: **[GUIDE.en.md Section 16](./GUIDE.en.md#16-faq-frequently-asked-questions)**.

---

## License · Copyright · Commercial Use

**Apache License 2.0 © SoDam AI Studio, 2026**

| Item | Details |
|------|---------|
| Personal use | Free to use |
| Modification · copying | Permitted (must preserve copyright notices) |
| Commercial use | Permitted under Apache-2.0 terms |
| Warranty | **None (AS-IS)** — you are responsible for outcomes |
| External services | Claude / Anthropic and other service terms apply separately |

- Bundled open-source libraries (better-sqlite3, sqlite-vec, @huggingface/transformers, force-graph, etc.) are under **their own licenses** (MIT/Apache-2.0)
- "Claude" and "Anthropic" are trademarks of their respective owners. O-Brain has no official affiliation with them
- Full license text: `LICENSE` file · Full dependency notices: `NOTICE` file
- For the detailed legal/copyright/commercial terms (permitted uses, obligations, liability limits, trademarks, privacy, and more — 12 subsections), see **[GUIDE.en.md Section 17](./GUIDE.en.md#17-legal--copyright--license--commercial-use)**

---

*This document and README.en.html have identical content.*
*Full guide: [GUIDE.en.md](./GUIDE.en.md) (English) · [GUIDE.md](./GUIDE.md) (Korean)*
