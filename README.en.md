<!-- English: this file · 한국어: README.md · (This document and README.en.html have identical content) -->

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
| **Bulk Exact-Duplicate Cleanup** | When multiple memory pairs have fully identical content, clean them all at once with a single "Clean all exact duplicates" button (separate from the pair-by-pair flow above, same backup + 10-second undo) |
| **API Token Verification** | Every API request is checked against a local token; missing or wrong tokens are rejected |
| **Performance Guard** | Auto-simplifies graph computation once memories exceed 1,500 to prevent freezing |
| **Trustworthy Search Ranking** | Blends relevance, importance, recency, and confidence so human-verified memories rank above auto-extracted noise |
| **Graph Reliability & Keyboard Access** | Shows an error message with a retry button if the graph fails to load; every memory in the graph can be navigated and opened using only Tab/Enter, no mouse required |
| **Low-Confidence Filter** | On the List tab, filter to show only memories with low auto-extraction confidence (below 50%) for review |
| **Noise Memory Filter** | On the List tab, filter out memories that look like conversation summaries or quotes accidentally saved as memories, then bulk-clean them with "Select All" |
| **Relation Suggestion Queue** | On the Overview tab, review memories with no relations one at a time and decide whether to link them to a similar memory (never auto-linked) |
| **Full Backup Export** | From the header's export menu, save your entire memory set (including relations) to a JSON or Markdown file — separate from the existing "visible items only" export |

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
cd <folder where you downloaded the repo>\app
npm install
```

> Example: if you downloaded the repo to `C:\Tools\O-Brain`, run `cd C:\Tools\O-Brain\app`

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
/plugin marketplace add <folder where you downloaded the repo>\plugin
/plugin install o-brain@o-brain-local
```

> Example: `/plugin marketplace add C:\Tools\O-Brain\plugin`

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

---

## File & Data Locations

| Item | Location |
|------|----------|
| Memory database | `app/data/obrain.db` |
| Auto backups | `app/data/backup/` (keeps latest 7) |
| API token file | `app/data/.api-token` (regenerated each run) |
| Personal settings | `app/.env.local` (uses defaults if absent) |
| This document | Project root (`README.md`/`README.en.md` and each `.html`) |

### Environment Variables (`app/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OBRAIN_PORT` | `7740` | Server port number |
| `OBRAIN_DATA_DIR` | `./data` | Data storage folder |

---

## Workflow

**General user (web UI focused):** Start with `npm start` in the morning → review yesterday's memories → add important decisions directly during work → link related memories and clean up in the evening.

**Claude Code user (MCP/plugin):** Speak decisions during chat, end the session with `/clear` → auto-saved → occasionally open the dashboard with `/o-brain:open` → back up regularly with `/o-brain:backup`.

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
- Even on an unexpected server error (e.g. a malformed request), internal file paths and error stack details are never exposed on screen — only a safe generic message is shown; full details go to the server log only (global error handler added 2026-07-27)

Security headers applied: `Content-Security-Policy` (same-origin resources only) · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` (blocks iframe embedding) · `Referrer-Policy: no-referrer`.

---

## Changelog

Most recent entries first. Click any entry to expand it.

<details open>
<summary><b>2026-08-04 — Added bulk "clean all exact duplicates" button, prevented large-session crash, closed error-message information leaks, re-audited dependencies</b></summary>

- **Bulk exact-duplicate memory cleanup**: On the Overview tab's duplicate-cleanup screen, added a "Clean all exact duplicates" button that removes every memory pair with fully identical content in one click, instead of confirming each pair individually (this is in addition to the existing pair-by-pair review/merge flow, which is still available). Same safety net as other bulk actions: automatic backup before deletion + 10-second undo.
- **Prevented large-transcript crash**: Found and fixed an edge case where an extremely large Claude Code session log (roughly 900MB+) could freeze the entire auto-save process — it now reads only the most recent 20MB. This has no effect on normal use, since almost all session logs are far smaller than that.
- **Error-message information-leak review**: Reproduced a rare backup-failure scenario and found 3 spots (in the duplicate-cleanup and bulk-delete screens) where the error response could leak the server's internal absolute folder path — closed immediately. Users now always see a safe generic message in this situation.
- **Dependency security re-audit**: Re-ran a vulnerability scan (`npm audit`) on external libraries and safely auto-fixed 3 newly-disclosed high-severity findings (`ip-address`). The remaining 4 high-severity findings (`sharp`/`adm-zip`, via the AI embedding library) have no upstream fix yet — we confirmed by reading the code that O-Brain only processes text and never exercises the image-handling code path these vulnerabilities affect, so real-world risk is low.
- **Expanded automated test battery**: Wrote a new 23-case automated test covering normal flow, invalid input, boundary values, failed authentication, and malicious requests — all 23 passed.
</details>

<details>
<summary><b>2026-07-27 — Backup selection screen improvement + security review (error-exposure fix, dependency vulnerabilities reduced)</b></summary>

- **Pick the backup you want from the list**: In the ⚙ Settings tab's backup list, clicking a backup now selects it — the manual restore steps below fill in with that exact backup's file name, and a "Copy file name" button appears, cutting down the risk of mistyping the name across several manual steps. (A one-click automatic restore was deliberately not built, for data-safety reasons — replacing the file still follows the manual steps.)
- **Error message security review**: While testing a rare edge case — sending the server a malformed request (e.g. corrupted data) — we found a spot where the response could leak internal file paths or error details, and closed it immediately. Now, even in this situation, users only see a safe generic message; the detailed diagnostic record stays in the server log only.
- **Dependency security review**: Ran a vulnerability scan (`npm audit`) on the external libraries this project uses and fixed 3 of 9 findings (high severity 5→4, moderate 4→2; auto-updated only within versions compatible with the existing code). We confirmed by directly reading the code that the remaining 6 (4 high, 2 moderate) sit in code paths this project doesn't actually use. Also re-verified the SQL handling used for search/save and the on-screen script-injection defenses.
</details>

<details>
<summary><b>2026-07-26 — Noise memory cleanup tools, full backup export, scope filter defect fix</b></summary>

- **Noise memory filter + bulk cleanup**: Added a List-tab filter to catch cases where a Claude Code session summary or conversation quote (e.g. "Claude:", tables, headers) was accidentally saved as a memory. A "Select All" button lets you select every filtered result at once for cleanup (never auto-deleted — you confirm before deleting, with a 10-second undo).
- **Save/inject defenses**: Tightened the extraction rules so future saves pick up less of this noise, and added a defense so noise already saved before this fix doesn't get pulled back into the memories auto-loaded at the start of your next conversation.
- **Relation suggestion queue**: On the Overview tab, memories with no relations are shown one at a time with a similar-memory suggestion — you decide whether to link or skip (the AI never guesses the relation type on its own).
- **Full backup export**: Added "Full JSON Backup" / "Full Markdown Backup" to the header's export menu. Unlike the existing export (visible items only, up to 500), this saves your entire memory set — including relations — to a file.
- **Scope (global/project) filter defect fix**: Found and fixed a bug where the "global"/"project" scope filter didn't actually work anywhere — List, Search, or Graph — so "global" showed project memories mixed in, and "project" often showed nothing at all.
</details>

<details>
<summary><b>2026-07-18 — Backup screen completed, low-confidence filter, plugin install path portability fix</b></summary>

- **Backup list + manual restore guide**: The ⚙ Settings page now shows the accumulated backups (date/size), a "Create backup now" button, and step-by-step manual restore instructions.
- **Low-confidence memory filter**: Added a filter on the List tab to show only memories with low auto-extraction confidence (below 50%) for review.
- **`save_memory` category parameter**: Claude Code can now specify a category directly when saving a memory via the MCP tool (omit it to keep the existing auto-classification behavior).
- **Plugin install path fix**: Earlier versions had the developer's own folder path hardcoded into the plugin config, so installing on any other computer broke the MCP tools and slash commands. Fixed so the plugin finds its own location automatically wherever it's installed.
- **Error message cleanup**: Unexpected server errors now show a friendly message instead of internal details (full details are still recorded in the local server log for debugging).
</details>

<details>
<summary><b>2026-07-15~16 — Confidence-aware search ranking, dashboard reliability & keyboard accessibility</b></summary>

- **Search ranking improved**: Search and MCP `search_memory` results now blend relevance (70%), importance (15%), recency (10%), and confidence (5%) instead of relevance alone. Human-verified memories no longer get buried by auto-extracted noise of similar relevance (an exact keyword match still always ranks first — relevance keeps the dominant weight).
- **Graph load-failure display**: If the server connection fails, the graph tab now shows an error message with a "Retry" button instead of silently staying blank.
- **Single delete now supports undo too**: Deleting a single memory now uses the same confirm dialog + 10-second undo as bulk delete (previously it used a plain, non-undoable browser confirm).
- **Disabled-button reasons**: Hovering a currently-disabled button (e.g. the delete button with nothing selected) now shows why it's disabled.
- **Search loading indicator**: A small spinner now appears during the brief moment while search results are loading.
- **Graph keyboard accessibility**: Every memory shown in the graph can now be tabbed to and opened with Enter, with no mouse required.
</details>

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

---

## FAQ (Frequently Asked Questions)

**Q. Where is my data stored?**
A. Only in `app/data/obrain.db` (an SQLite file). Nothing is sent externally.

**Q. Does it cost anything?**
A. O-Brain itself is free. If you use Claude Code or the Anthropic API, those services' fees may apply separately.

**Q. Are the graph node count and the list page size the same setting?**
A. No. In the ⚙ Settings page, "page size" applies only to List/Timeline/Overview, while "graph node count" applies only to the Graph tab.

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

---

*This document and README.en.html have identical content.*
*Korean version: [README.md](./README.md)*
