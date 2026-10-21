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
4. [Installation (2 Steps)](#installation-2-steps) · [Updating](#updating)
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
| **Shortest Path Finder** | From the detail panel, pick another memory and click "Find path" to see how many relation-hops connect the two memories, then highlight that path on the graph (highlight persists across tab switches and 2D/3D toggles). Shows "No connected path" if there isn't one |
| **Time Travel** | Query memories that were "alive" on any past date |
| **Confidence Decay** | AI-extracted memories auto-decay with a 30-day half-life |
| **Security Filter** | API keys and passwords auto-removed before saving (`[REDACTED]`) |
| **Auto Backup + Backup card** | Automatic copies on server start and right before delete / merge / import (each kind kept separately). In the header ⬇ **Data** screen's Backup card: list (kind, date, memory count, "opened and verified"), "Create backup now" (.db), "Portable backup" (.json.gz, for moving to another PC), download; restore with `npm run restore` |
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
| **6 Export Formats** | In the header ⬇ **Data** screen, export to JSON, JSON Lines, CSV (Excel), Markdown, Text or HTML (print → PDF) — everything / current list / selection / one project, leave out folder paths (default), compression (.gz), download or save to a folder on this PC |
| **Import** | Drop a file in the formats above (JSON, JSONL, CSV, TSV, Markdown, TXT, also as .gz) → **preview** (new, duplicates, masked secrets, errors) → confirm → automatic backup → progress bar → undo within 30 minutes. Files from outside arrive as "needs review" and are not injected into new chats automatically |

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| OS | Windows 10 / 11 (64-bit) |
| Node.js | **26.7.x** (from [nodejs.org](https://nodejs.org)). This project is pinned to the 26.7 line by `engines` (`~26.7.0`) in `app/package.json` and `app/.nvmrc`. With a different Node version, saving memories can fail silently |
| Storage | 500 MB+ (includes ~90 MB embedding model) |
| RAM | 4 GB+ (8 GB+ recommended) |
| Browser | Chrome, Edge, Firefox, etc. |

> Claude Code is only required for MCP integration or plugin installation. The web dashboard works without it.

---

## How to Download

If you're reading this, the O-Brain files are already on your computer. Just locate the project folder (absolute path on this PC).

If using Git (for developers):

```bash
git clone https://github.com/sodam-ai/SoDam_O-Brain.git
cd SoDam_O-Brain
```

> The repository is public, so no special permission is needed to download it. (If it ever becomes private, access permission is required.)

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

### Updating

After you get a new version, follow these steps. Windows cannot replace files that are in use, so **shutting everything down first** matters.

1. In the terminal where the O-Brain server is running, press `Ctrl+C` to stop it, and **close every Claude Code window**.
2. Get the new version — `git pull` if you used git, or overwrite with the newly downloaded files if you used a zip. (Your memories inside `app/data/` are not touched.)
3. In a terminal, go to the `app` folder and run `npm ci` — it installs **exactly the verified versions** listed in the repository's `package-lock.json` (safer than `npm install`). It can take a few minutes.
4. Run `npm run selftest` (a long list of ✅ ending with 🎉 means it is healthy), then start the server with `npm start`.
5. If you use the Claude Code plugin, run `npm run plugin:pin` once, then update it with `/plugin` in a new Claude Code window.
6. If a browser tab with **an O-Brain screen opened earlier** is still around, it may show "The server seems to have restarted". Just press the **Reload page** button (or `F5`).

> Every time the server starts, the memory database is backed up automatically and its structure is brought up to date. If something looks wrong, `npm run restore` in "Troubleshooting" below takes you back.

---

## Claude Code Plugin (Optional)

If you use Claude Code, you can also install it as a plugin. **You must run this in two separate steps** (attempting both at once causes a "Marketplace not found" error):

```
/plugin marketplace add <folder where you downloaded the repo>\plugin
/plugin install o-brain@o-brain-local
```

> Example: `/plugin marketplace add C:\Tools\O-Brain\plugin`

> ⚠️ **Once, before installing or updating**: installing with `/plugin` **copies** the plugin files into Claude Code's cache folder, so the `app` folder is no longer next to them. **Before** installing or updating, open a terminal in the `app` folder and run `npm run plugin:pin` once to register where O-Brain lives (one line is saved in `.obrain/root` inside your user folder). If you skip this, a session start shows "could not find the app folder" — just run the same command then.

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

#### Screen Preview

> The screens below are filled with example (synthetic) data — not real personal memories.

**Graph view — 2D/3D knowledge graph** (red dashed = contradicts, green solid = supports)
![Graph view](assets/screenshots/graph-2d.png)

**Overview tab — stats/distribution**
![Overview tab](assets/screenshots/overview.png)

**List tab — card list + detail panel**
![List tab](assets/screenshots/list-detail.png)

**Timeline tab — chronological memory**
![Timeline tab](assets/screenshots/timeline.png)

**Settings tab — 5 adjustable controls**
![Settings tab](assets/screenshots/settings.png)

### Data screen — Export · Import · Backup

Open it with the **⬇ button** at the right of the header (or `Ctrl+K` → "Data management"). It has three cards, top to bottom: **Export · Import · Backup**.

**① Export** — take your memories out as a file (the originals stay where they are).

| What you want | Pick this format |
|---------------|------------------|
| View in Excel / Google Sheets | **CSV** (Korean text stays readable; relations are left out) |
| Move to another PC / keep a full copy | **JSON** (includes relations; can be imported again) |
| Obsidian, Notion and other note apps | **Markdown (.md)** |
| Read, print, make a PDF | **HTML** (open it, press `Ctrl+P` → "Save as PDF") |
| Developers / data analysis | **JSON Lines** (one memory per line) |
| Paste into Notepad or a chat app | **Text (.txt)** |

Choose the scope from *everything / what is loaded in the list now / what you selected in the list / one project*. **"Leave out folder paths" is on by default** (safe when you share the file; turn it off when moving to your own other PC). "Download" saves through the browser; "Save to this PC" writes into `app/data/export/` and tells you where. A compression (.gz) option is available too.

**② Import** — bring memories in from a file.

1. Drop a file or press "Choose file" — `JSON`, `JSON Lines`, `CSV`, `TSV`, `Markdown`, `Text`, or any of these compressed as `.gz` (up to 5 MB and 5,000 memories). For Excel `.xlsx`, use "Save as → CSV UTF-8" first. Korean-Windows CSV (CP949) is read as well.
2. **Preview** — shows how many memories are new, how many are skipped because they already exist, lines that could not be read, and memories where secrets were masked. Nothing is saved at this step.
3. Press "Import": your current memories are **backed up automatically** first, then saved (a progress bar is shown; if it stops midway, nothing is saved).
4. For **30 minutes afterwards, "Undo"** removes only what you just imported.

> ⚠️ A file from someone else could contain sentences that try to act like instructions to the AI, so by default imported memories arrive as **"needs review" (40% confidence)** and are **not injected automatically into new chats**. Open a memory, check it and save it, and it becomes a normal memory. If you made the file yourself (for example a JSON exported from this screen), tick "I trust this file" — the source and confidence written in the file are kept. Anything that looks like a password or API key is masked on import too.

**③ Backup** — copies for when something goes wrong.

- **Automatic**: made when the server starts and right before you delete, merge or import. Each kind is kept separately (7 server-start copies · 7 before-risky-action copies).
- **Manual**: "Create backup now" (`.db`, up to 10) and "Portable backup" (`.json.gz`, up to 10 — to move to another PC, upload it to the new PC's "Import"). Manual backups are never pushed out by automatic ones.
- The list shows kind, date, size, memory count and "opened and verified ✔"; **Download** lets you keep a copy elsewhere (USB, cloud).
- **Restoring** is done in a terminal, not on screen (overwriting a data file that is in use can corrupt it). Close the server and every Claude Code window, run `npm run restore` in the `app` folder → pick a number → type `yes`. Your current data is backed up first, and the original file is not deleted — it is kept next to the new one.

---

## Key Commands

```bash
# Run from the app/ folder
npm start          # Start server (port 7740)
npm run selftest   # Run self-diagnostics
npm run backup     # Manual backup (.db)
npm run backup -- --portable   # Portable backup (.json.gz, for moving to another PC)
npm run restore    # Restore from a backup (close the server and all Claude Code windows first)
npm run status     # View DB stats (incl. last auto-save result and semantic-search state)
npm run reindex    # Fill in missing search data for memories (after semantic search was down)
npm run plugin:pin # Register where O-Brain lives for the /plugin install (once, before installing/updating)
npm run seed       # Add sample data (for testing)
```

---

## File & Data Locations

| Item | Location |
|------|----------|
| Memory database | `app/data/obrain.db` |
| Backups | `app/data/backup/` (kept per kind: 7 server-start · 7 before-risky-action · 10 manual .db · 10 portable .json.gz) |
| Exported files | `app/data/export/` (when you choose "Save to this PC") |
| API token file | `app/data/.api-token` (regenerated each run) |
| Personal settings | `app/.env.local` (uses defaults if absent) |
| This document | Project root (`README.md`/`README.en.md` and each `.html`) |
| `app/web/graph.html` | **Intentionally kept early prototype file** (the current screen is `index.html`). It's dead code referenced nowhere, but kept as-is to preserve early development history rather than deleted |

> ⚠️ **Stop and check**: before you **delete, move or overwrite** the `app/data` folder (the memory DB), run `npm run backup` first. Deleted memories cannot be brought back. Do not keep the DB inside a cloud-sync folder such as OneDrive — it can get corrupted.

### Environment Variables (`app/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OBRAIN_PORT` | `7740` | Server port number |
| `OBRAIN_DATA_DIR` | `./data` | Data storage folder |
| `OBRAIN_CAPTURE_SDK` | (off) | Set to `1` to also auto-save conversations from sessions launched by programs (`claude -p`, Agent SDK, etc.). By default **only text a person typed** is saved |
| `OBRAIN_EMBED_DISABLE` | (off) | Set to `1` to turn off semantic search (the embedding model) and use keyword search only — for diagnosis or low-spec PCs. While it is on, new memories get no search data; turn it back on and run `npm run reindex` to fill it in |

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
- **API keys and passwords auto-removed** before saving (processed by redact.mjs) — this covers GitHub, Slack and Stripe tokens, JWTs, passwords inside database URLs, and Korean phrases like "the password is …". It does **not guarantee every password is caught** (an arbitrary string written without a keyword, or a password with no digits or symbols, can slip through) — the safest habit is to not type sensitive values into a chat at all
- The server only accepts requests addressed to an allowed host (`127.0.0.1` or `localhost` plus the server port) — this blocks "DNS rebinding", where a malicious web page tricks the browser into reading your local server (2026-10-20)
- If the semantic-search model cannot be used, a **warning banner** appears at the top of the page; memories are still saved and keyword search keeps working (it never silently returns misleading results)
- New **local API token** auto-generated each server start (crypto.randomBytes)
- `data/`, `.env.local`, `*.sqlite` are in `.gitignore` — never committed to Git
- No external cloud communication. Embedding model runs entirely locally
- Input validation: invalid IDs, out-of-range numbers, and disallowed CORS origins are all safely rejected by the server with 400/403/404 (verified by testing)
- Even on an unexpected server error (e.g. a malformed request), internal file paths and error stack details are never exposed on screen — only a safe generic message is shown; full details go to the server log only (global error handler added 2026-07-27)
- Data stays safe even with several Claude Code windows open at once (verified 2026-09-11: many concurrent creates and concurrent edits on the same record, no corruption or crash; a wait-then-retry safeguard was added)
- Suspicious requests are logged in the server window — requests with a disallowed address or origin, or a missing/wrong token, are refused and leave one line `[security] 요청 거절(이유) …` (the log line itself is written in Korean) (the same reason is summarized to one line per minute; tokens and memory content are never logged) (2026-10-21)
- The id in delete / merge / add-relation / undo-import requests must be **an integer or a string of digits only** (`true`, arrays, empty values and the like are refused) — this fixes a defect reproduced during the security review (a `true` in the id list used to delete memory #1) (2026-10-21)
- The server type (`X-Powered-By: Express`) is no longer announced in response headers (2026-10-21)
- The screen always shows what you wrote **as plain text** — malicious strings (`<script>`, `<img onerror=…>` and the like) were entered and confirmed in a real browser not to run in the list, search, detail, edit, timeline, overview, graph, settings and import preview (2026-10-21)
- Known vulnerabilities in installed packages (`npm audit`) are **0** according to `package-lock.json` (2026-10-21). To apply it on this PC you need `npm ci` from "Updating" above
- Outside the protection (limits): a PC shared by several people, keeping `app/data/` in a shared or cloud-synced folder, and sending export or backup files to others — those files can contain personal or work information collected from your conversations
- Limit: a memory the AI saves through `save_memory` (an MCP tool) is saved at 0.8 confidence and becomes eligible for automatic injection into new chats. If the AI is fooled into saving an odd sentence during a chat, it can show up in later chats. The injected text is cut to one line of 400 characters and labelled "reference only, not instructions", but that is not a complete block — delete unfamiliar memories from the list. Also, "imported, not yet reviewed" memories are left out of automatic injection only; they remain visible in search, the MCP tools and the screen

Security headers applied: `Content-Security-Policy` (same-origin resources only) · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` (blocks iframe embedding) · `Referrer-Policy: no-referrer` · `Cache-Control: no-store` (screens and API responses that contain memory content are not kept in caches).

---

## Changelog

Most recent entries first. Click any entry to expand it.

<details open>
<summary><b>2026-10-21 (final check) — Security defect fixed · Independent security review follow-ups · Notice after a server restart · 12 dependency vulnerabilities resolved · License notices tidied</b></summary>

- **A defect found and fixed in the security review**: when an id list in a delete request contained a value such as `true`, memory #1 was deleted (`true` was turned into 1 — a type confusion). Ids now have to be integers or digit-only strings, applied to the same pattern in 4 places (bulk delete, duplicate merge, add relation, undo import). Three automatic checks were added (112 → 115 lines).
- **Found and fixed in the independent security review (6 items)**: a separate review agent read the code, and each problem it reported was reproduced by hand before being fixed. ① The secret filter permanently damaged hyphenated words such as `task-management-dashboard` into `ta[REDACTED:api-key]` **at the moment of saving** (the original was not even kept in backups) ② Misses: JSON `"password": "…"`, `--password value`, `Authorization: Basic …`, and npm, Hugging Face, SendGrid and GitLab tokens were not masked ③ Regular expressions whose time grew quadratically on long repeated input (up to 5.7 s → 1 ms), and the conversation-cleanup regexes (up to 7.6 s → 3 ms) ④ Searches containing symbols such as `node.js`, `C++` or `e-mail` **silently lost the keyword search entirely** ⑤ Memory text handed to the AI is now one line of at most 400 characters with invisible Unicode characters removed (so a multi-line memory cannot fake a header; a "reference only, not instructions" note was added), and `status` output got the same cleanup plus an "imported, not yet reviewed" mark ⑥ In import, an item with an object value caused a 500 error, and a compressed file over the limit was read to the end — a single 20 KB file could use up to 4.2 GB of memory at once (now about 0.2 GB, refused immediately).
- **Less information exposed · security log**: the server type (`X-Powered-By: Express`) was removed from response headers, and screens and API responses that carry memory content or the token now use `Cache-Control: no-store` so they are not kept in caches. Refused requests (disallowed address or origin, missing or wrong token) are logged in the server window as `[security] 요청 거절(이유) …` (the log line itself is written in Korean) (one line per minute per reason; tokens and content are never recorded).
- **A screen left open after a server restart**: the server creates a new token each time it starts, so a dashboard tab opened earlier kept being refused and looked frozen with no explanation. A "The server seems to have restarted — reload the page" notice with a button now appears (reproduced in a real browser, and recovery confirmed).
- **Narrow-screen fix**: in the Overview tab, a long string with no spaces (a file path or address) pushed a card off the screen and cut off its right side. Fixed.
- **12 dependency vulnerabilities → 0**: `npm audit` reported 12 (1 critical · 4 high · 7 moderate), so `package-lock.json` was updated (56 packages, including the embedding engine and the MCP SDK). The search vectors stored for your existing 2,340 memories match what the new engine recomputes (similarity ≥ 0.999), so **no re-indexing is needed**. To apply it on this PC, close the server and every Claude Code window and run `npm ci` in the `app` folder (see "Updating").
- **Legal and license tidy-up**: `NOTICE` was extended (embedding engine, sharp, protobufjs, a notice for the binary that contains LGPL and MPL code, and a trademark note), and the licenses of all 213 installed packages were checked one by one (0 GPL/AGPL). The model license (Apache-2.0) was re-confirmed and `LICENSE` was compared against the official text and matches. The License section now has a summary of redistribution conditions, what you must check yourself, and what needs professional review.
- **What we checked**: all 125 automatic checks pass (and the new checks were confirmed to fail on the pre-fix code) · 115 server security and boundary checks + 12 export checks + 23 import checks (passing on both the old and the new dependencies) · response times measured on 5,000 memories (slowest 0.7 s, 0 failures in 46 simultaneous requests) · malicious-string entry test on every screen passed · 0 browser console errors · 32 virtual-screen checks. **What we could not check**: running export and import on the real database (2,340 memories) — only synthetic databases were used; operating systems other than Windows; a real touch device (checked only with a narrow window); actually installing the new versions into this PC's `node_modules` (tested in a copy only), and the memory-use improvement in import, which was confirmed by measurement rather than by an automatic check.
</details>

<details>
<summary><b>2026-10-21 — New Data screen: 6 export formats · Import (preview and undo) · Better backups (portable copy, restore command)</b></summary>

- **6 export formats (new Data screen)**: the header ⬇ button now opens a "Data" screen instead of a small menu. Export as JSON, JSON Lines, CSV (for Excel — a UTF-8 BOM keeps Korean readable, and cells starting with `=`, `+`, `-` or `@` get a leading `'` so they are never run as formulas), Markdown, Text, or HTML (no scripts, execution blocked, meant for print → PDF). Choose the scope (everything, the current list, a selection, one project), whether to leave out folder paths (on by default), compression (.gz), and download or save-to-folder. The old "visible items only (max 500, no relations)" menu is folded into the "loaded in the list" scope, and it now includes relations.
- **Import (new)**: reads JSON, JSON Lines, CSV, TSV, Markdown and Text (plus `.gz`). Upload safeguards: extension, MIME and content checks (renamed executables, archives, PDFs and databases are refused), limits of 5 MB, 5,000 memories and 5,000 characters each, protection against decompression bombs; Korean encodings (CP949, UTF-16), Excel-style semicolon CSV and a hint for `.xlsx` are supported. The flow is **preview (nothing saved yet) → confirm → automatic backup → progress bar → undo within 30 minutes**, and saving is all-or-nothing (0 saved if it fails midway).
- **Protection from outside files**: imported memories arrive as "needs review" (40% confidence) by default and are **excluded from automatic injection into new chats** (a safeguard against sentences in someone else's file acting like instructions to the AI). Open and save a memory to make it a normal memory; with "I trust this file" the source and confidence from the file are kept. Anything that looks like a password or API key is masked before saving on import as well.
- **Backup improvements + a defect fixed**: until now a backup you created yourself followed the same "latest 7" rule as the server-start backups, so it could be deleted automatically after a few days. Backups are now kept per kind (7 server-start · 7 before-risky-action · 10 manual `.db` · 10 portable `.json.gz`). Added: portable backup, kind / memory count / "opened and verified" / download in the backup list, `npm run backup -- --portable`, and a backup line in `npm run status`.
- **Restore command `npm run restore`**: it refuses to start while the server is running, opens the backup and checks its integrity, backs up the current data first, asks you to type `yes`, then swaps files by renaming — the original file is kept beside the new one, not deleted (if another program holds the file, nothing is changed and you get a message; if the restored file will not open, it rolls back). To undo a restore, restore the "before restore (automatic)" backup. The old manual "rename the file yourself" instructions are replaced by this command.
- **What we checked**: re-importing an exported file restores content, type, importance, project, relations and saved time exactly (JSON, JSONL, CSV, Markdown, gz); malicious input is refused (renamed binaries, decompression bombs, broken files, prototype-pollution attempts); importing 5,000 memories takes about 24 seconds (5,001 are refused); a failure midway saves 0; a real file-swap restore was tested in a separate folder (including Windows' open-file protection). All 112 automatic checks pass.
</details>

<details>
<summary><b>2026-10-20 (follow-up) — Stronger secret filter · semantic-search outage alert · server hardening · steadier plugin install · better graph links</b></summary>

- **Secret filter coverage**: we ran the filter on real examples and found it did not mask GitHub, Slack and Stripe tokens, JWTs, passwords inside database URLs (`postgres://user:password@host`) or Korean phrases like "the password is …" before saving — all fixed. Running the new rules over the 2,340 real memories changed none (no false alarms, and nothing had leaked), and explanatory sentences such as "passwords are hashed with bcrypt" are left untouched. The forms it cannot catch are stated honestly in the Security overview above.
- **Semantic-search outages are no longer hidden**: before, if the embedding model failed to load, memories kept being saved with meaningless values without any notice. Now the memory is saved and only the search data is skipped, with a warning banner, `npm run status` and an MCP notice. Recovery is `npm run reindex` (the 2,340 stored search vectors were all confirmed to match the current model, so nothing was polluted).
- **Server hardening**: any request whose `Host` is not allowed (`127.0.0.1` or `localhost` plus the server port) is refused for the first page, the API and static files (DNS-rebinding defence).
- **Steadier plugin**: installing or updating with `/plugin` copies the files into a cache, which could leave the hooks, MCP server and commands unable to find O-Brain. Fixed (run `npm run plugin:pin` once). The **last success/failure** of auto-save is shown by `npm run status`, and each session start tells you "N memories loaded". `/o-brain:open` no longer mistakes a running server for a stopped one.
- **Graph links**: with more than 1,500 memories the graph used to show only lines joining "the same kind" regardless of meaning; it now joins **pairs that are similar in meaning** among the nodes on screen (about 0.13 s for 600 nodes, checked on the real screen).
- The self-check (`npm run selftest`) grew from 20 to 35 items and all pass. **To apply it**, restart the running server once (the auto-save hook applies immediately).

</details>

<details>
<summary><b>2026-10-20 — Auto-save now remembers only what a person actually typed</b></summary>

- **What was wrong**: Analyzing 282 real conversation logs showed that about 71% of auto-save candidates were written by programs (conversations started by other tools via `claude -p` / the Agent SDK), and even inside sessions a person opened, about 23% were not typed by a person (sub-agent reports, notifications). That is how README sentences and code fragments ended up saved as "decisions" or "rules" (the candidates confirmed to be typed by a person were only ~3% of the total, and nearly all of them were fine).
- **What changed**: The conversation log already carries markers (entry point `entrypoint`, sender `origin`, `isMeta`). O-Brain now reads them and only treats text a person typed as memory candidates. Sessions launched by programs are skipped by default, and the reason and count of what was skipped are printed in the hook log. Older logs without markers, and marker kinds it does not recognize, are handled exactly as before (so memories never vanish silently).
- **How to turn it back on**: To also remember conversations started by programs, add `OBRAIN_CAPTURE_SDK=1` to `app/.env.local`.
- **Effect (measured on the same 283 logs)**: memory candidates dropped from 524 to 35 (−93%). What disappeared was program-written text, not human decisions, so the lower volume is expected. Memories already saved are not changed; cleanup stays human-confirmed as before.
- The self-check (`npm run selftest`) grew from 14 to 20 items and all pass.

</details>

<details>
<summary><b>2026-09-11 — Dependency security patches (3 newly discovered), live-tested concurrency and mobile rendering, hardened multi-session safety, added a mobile UI hint</b></summary>

- **Dependency vulnerabilities: 7 → 4**: During a routine check, besides the already-known adm-zip issue (GitHub issue #1, CVE-2026-39244), 3 newly disclosed vulnerabilities turned up — fast-uri (high) and hono/qs (moderate) — and were resolved safely via `npm audit fix`. adm-zip was pinned to the latest release (0.6.0), which fixed the "unbounded memory allocation" issue; the remaining "symlink-following" issue has no fix even in the latest release, so it stays open with its severity downgraded from high to moderate (waiting on an upstream fix; confirmed directly that it can't currently be avoided). The remaining 4 (sharp, onnxruntime-node, 2 issues via the AI embedding library, and the 1 residual symlink issue) were all directly confirmed to have no upstream fix yet.
- **Live-tested concurrent requests (race conditions)**: Simulated several Claude Code windows using O-Brain at the same moment by running 20 concurrent creates, 10 concurrent edits on the very same memory, and a mixed delete/read/create load against a real running server. Everything was handled correctly with no data corruption, no conflicts, and no server errors.
- **Hardened multi-session safety**: The test above didn't reproduce a failure, but a theoretical gap was found — if two windows write at the exact same instant, an operation could previously fail immediately — so a safeguard was added proactively: wait up to 5 seconds and retry instead of failing right away.
- **Live-tested the mobile layout**: Rendered the real page at 375px (a standard phone width) in an actual browser and confirmed everything displays correctly, with no horizontal scrolling and nothing cut off-screen.
- **Added a scroll hint to the mobile filter bar**: The filter row (sort, importance, date range, etc.) is deliberately horizontally scrollable on narrow screens, but had no visual hint — during live testing this looked like a bug (content cut off) rather than intended behavior. Added a subtle fade at the right edge (purely visual, no functional change).
- Re-ran the self-check (`npm run selftest`) after all the above — all 14 checks still pass.
</details>

<details>
<summary><b>2026-08-31~09-01 — Fixed a gap in the secret filter, fixed a search-ranking defect, hardened auto-save reliability, passed a pre-deployment full review</b></summary>

- **Fixed a gap in the secret filter**: The filter that's supposed to strip passwords/API keys before saving was missing environment-variable-style names with underscores, like `DATABASE_PASSWORD=xxx`. Fixed. Common key formats like `sk-...` and `AKIA...` were already being caught correctly.
- **Fixed occasional search-ranking mix-ups**: Even when a memory matched the search query exactly, a different, less-relevant memory with higher importance/confidence could sometimes outrank it. Fixed — an exact match is now always prioritized.
- **Fixed questions being mis-saved as "decisions"**: Sentences ending in a question ("Should we do it this way?") were sometimes auto-saved as decision memories even though nothing was actually decided. Fixed.
- **Fixed quoted lines starting with "AI:"/"GPT:" slipping past the noise filter**: Quoted lines like "AI:"/"GPT:" that show up in conversation summaries weren't being caught by the existing noise filter (which already caught "Claude:"/"User:" etc.). Added.
- **Improved auto-save so one failed item no longer blocks the rest**: When saving several memories at once after a session ends, if one item failed, the whole batch used to fail with it. Fixed — now the rest save normally even if one fails.
- **Pre-deployment full review**: Checked the normal flow, invalid inputs, boundary values, suspicious-looking search strings, unauthenticated access attempts, cross-site request blocking, and whether every single API route is protected by authentication — all against a real running server. Everything was handled safely. All items above were re-verified with no regressions in other features.
</details>

<details>
<summary><b>2026-08-20~21 — New shortest-path finder, 3 bug fixes (accessibility, undo, path highlight), passed a comprehensive security/input-validation test round</b></summary>

- **Shortest path finder (new feature)**: From a memory's detail panel, search for and pick another memory, then click "Find path" — it finds how many relation-hops connect the two ("step 1 → step 2 → step 3") and highlights that exact path on the graph with a bold connector. If they're not connected, it shows "No connected path." As a safety guard, once the relation count exceeds 5,000 the search is skipped to protect performance (verified directly against real data at the 5,000/5,001 boundary).
- **Bug fix 1 — closed panels stayed "open" for screen readers**: Closing the memory detail panel or the command palette (Ctrl+K) visually hid it, but screen readers (accessibility tools) still saw it as open. Fixed.
- **Bug fix 2 — the delete-undo notice could disappear early**: Deleting a memory shows a "10-second undo" notice, but if a background notification about new memories happened to appear at that exact moment, it would immediately overwrite and erase the undo notice. Now, background notifications no longer overwrite an active undo notice.
- **Bug fix 3 — the path-finder highlight disappeared when switching graph views**: If you found a path from the List or Overview tab and then switched to the Graph tab (or toggled 2D/3D), the highlight you just found would silently vanish. Fixed — the most recently found path now stays highlighted across tab switches and 2D/3D toggles.
- **Comprehensive security & input-validation testing**: Ran real tests with invalid values, empty values, boundary cases (e.g. finding a path from a memory to itself), unauthenticated requests, SQL-injection-style strings, and malicious scripts (`<script>` tags, etc.) — every case was either safely rejected with a clear error message (bad input) or rendered harmlessly as plain text (malicious scripts were neutralized across all three places content is shown: list cards, detail view, and graph hover tooltips). Also tried a 200KB oversized submission, which the existing 64KB request-size limit correctly and safely rejected.
</details>

<details>
<summary><b>2026-08-17 — Discovered and recovered a 6-day silent auto-save outage, hardened memory-save validation</b></summary>

- **Discovered and recovered a 6-day silent auto-save outage**: Between 2026-08-11 and 2026-08-17, a Node.js update on this PC broke compatibility with the internal storage module (better-sqlite3), but the failure was designed to fail silently instead of showing an error, so nobody noticed. Conversations during that window may not have been saved to O-Brain. It's fixed now — if this ever happens again, checking the last-save time on the dashboard or via `/o-brain:status` will reveal a silent outage.
- **Added an extra layer of validation on memory save**: The save function itself now always clamps importance/confidence values to their valid ranges (1-5, 0-1), not just the callers that invoke it. No bad value was ever actually saved because of this gap, but it was a shallow spot in the defenses that we closed proactively.
</details>

<details>
<summary><b>2026-08-09~10 — Context-matched memories on session resume, graph fallback-mode notice, fixed dropped "#"-prefixed memories, blocked local-command log leakage</b></summary>

- **Resuming a session now surfaces memories related to what you were discussing**: Previously, resuming a Claude Code session always pulled in memories by "most recent / most important" only. Now it also looks at what the prior conversation was about and prioritizes memories relevant to that topic (e.g., resuming a conversation about "button color" surfaces button-related decisions first). A brand-new session has no prior conversation to go on, so it still uses the same recency/importance ordering as before.
- **Graph fallback-mode notice**: Once memories pass 1,500, the graph automatically switches to a simpler "same-type only" connection mode to stay fast — but until now, nothing on screen told you this was happening. The graph view now shows a "connected by type (similarity skipped)" note at the bottom, explaining why and how cleaning up noise/duplicate memories can bring back the more precise similarity-based connections.
- **Fixed sentences starting with "#" being dropped entirely**: Previously, if you typed something like "# let's do this," the assistant would mistake it for a document heading and discard the whole sentence — even when it was a real, important instruction. Now only the "#" marker is stripped, and the rest of the sentence is judged for saving exactly as any other sentence would be.
- **Blocked local-command output from contaminating auto-save candidates**: Found and closed a gap where the text output of a locally-run command (not something you actually typed) could be reviewed as a save candidate. No memory was ever incorrectly saved because of this, but the safeguard was incomplete, so we closed it proactively.
</details>

<details>
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
| Accidentally deleted a memory | Click "Undo" on screen within 10 seconds. If it's too late, close the server and every Claude Code window, then run `npm run restore` in a terminal (app folder) and pick the automatic backup made right before the deletion |
| Changed a count in Settings but the graph didn't change | This is expected — the Graph tab uses a separate "node count" setting (different from the list page size) |
| Downloaded folder/file is blocked or won't open | This is often an antivirus or "downloaded from another PC" warning. Right-click the file (or the zip) → **Properties → check "Unblock" → OK**. If antivirus keeps blocking it, add this folder as an exception |
| "Windows protected your PC" (SmartScreen) appears | This warning can appear the first time you run an unsigned program. Click "More info → Run anyway" **only if you downloaded this project yourself and trust it**. If you are not sure where it came from, **stop and do not run it** |
| Setup or running asks for administrator rights | Administrator rights are not needed. Install inside your **own user folder** (for example `C:\Users\yourname\Tools\O-Brain`) |
| A "Semantic search is temporarily down" banner appears at the top | Your memories are safe and keyword search still works. In the `app` folder run `npm run status` to see the reason (internet connection, Node version). After fixing it, run `npm run reindex` to fill in the missing search data — the banner then disappears |
| At session start you see "O-Brain: could not find the app folder" | A `/plugin` install does not know where O-Brain lives. In O-Brain's `app` folder, run `npm run plugin:pin` once |
| `better-sqlite3`-related error during `npm install` | This usually resolves itself since a prebuilt binary is used. If it still fails, **reinstall Node.js 26.7.x** (see `app/.nvmrc`) and run `npm install` again |
| Memories suddenly stop being saved / the graph stops growing, with no visible error | If Windows auto-updates Node.js, the already-installed `better-sqlite3` binary can silently mismatch (no on-screen error — this is inherent to the auto-save feature). Run `cd app` then `npm rebuild better-sqlite3`, then confirm with `npm run status`. Checking `npm run status` occasionally is recommended |
| `/plugin install` gives a "Marketplace not found" error | You **must run it in two separate steps** — follow the [Claude Code Plugin](#claude-code-plugin-optional) order above again (`marketplace add` first, `install` second) |
| Errors when the install path has spaces or non-English characters | Some tools can't handle spaces or non-ASCII characters in the folder path. We recommend installing to a path with **no spaces and ASCII-only characters** (e.g. `C:\Tools\O-Brain`) |
| 3D graph doesn't show or keeps stuttering | Older PCs or some browsers render 3D (WebGL) slowly. **Switch to 2D** on the Graph tab, or lower "Graph node count" in ⚙ Settings |
| Search returns zero results | If you just started the server, the AI embedding model may still be downloading (1–3 minutes, first run only). If it's still empty, you may not have any memories saved yet — run `npm run seed` to check with sample data |
| Behavior looks wrong after updating to a new version | Restarting the server **automatically upgrades** the database structure to the latest version (auto-migration). If something still looks wrong, close the server and every Claude Code window, then run `npm run restore` to go back to the most recent backup (an automatic backup is made before every update) |
| After restarting the server, an open screen shows "The server seems to have restarted" | This is normal. The server creates a new access key (token) every time it starts, so a screen opened earlier cannot be used for a moment. Press **Reload page** (or `F5`) in the notice and you can continue right away — your memories are unchanged |
| `npm audit` shows vulnerabilities | The repository's `package-lock.json` is already updated to fixed versions. Close the server and every Claude Code window, then run `npm ci` in the `app` folder to install them (see "Updating" above) |
| In the Overview tab, text at the right edge of a card is cut off | That was a problem in an earlier version (a long path or address with no spaces made the card overflow). Update to the latest version |

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
| Commercial use | **Permitted** — modification, copying, forking, redistribution, resale, running it as a service, use in training materials, and delivery to a company/client are all allowed under Apache-2.0 terms (preserve copyright/license notices) |
| Prohibited | Using "Claude"/"Anthropic" trademarks or logos as if they were O-Brain's own, or implying official partnership/certification |
| Limitation of Liability | The copyright holder is not liable for any damages (including data loss) arising from use of this software |
| Warranty | **None (AS-IS, No Warranty)** — you are fully responsible for the outcomes of use |
| External services | Claude / Anthropic and other external services are governed by **their own terms of service**, separate from O-Brain (see below) |

- Every external package installed along with it — **all 213** (2026-10-21, the `license` field of each package checked one by one) — declares a license, and most are permissive (MIT 151 · ISC 27 · BSD 19 · Apache-2.0 7 and others). There are **0 GPL/AGPL packages**. The libraries used directly (better-sqlite3, sqlite-vec, @huggingface/transformers, force-graph, 3d-force-graph, express, @modelcontextprotocol/sdk) and the local AI model (all-MiniLM-L6-v2, Apache-2.0) are all permissive (MIT/Apache-2.0). However, the Windows binary of the image-processing tool (sharp) that is installed along with them (`@img/sharp-win32-x64`) bundles **several LGPL-3.0 libraries and MPL-1.1 (cairo)**, so weak-copyleft conditions apply to it. O-Brain does not use image processing, does not put this binary in the repository (npm downloads it at install time) and does not modify it, so personal and internal use is normally unaffected — but **if you redistribute `node_modules` or deliver it to a client, professional review is recommended** (this is not legal advice). The detailed list is in the `NOTICE` file.
- **Ownership of output generated via Claude Code/Anthropic API**: per the text of Anthropic's Commercial Terms of Service, outputs belong to **the user**, and conversation content is not used to train Anthropic's models (verified against anthropic.com/legal/commercial-terms, 2026-08-10). Specific plan details and usage policies can vary by account, so please check the terms directly for anything account-specific — that's set by Anthropic, not O-Brain.
- "Claude", "Anthropic", "Codex", and "OpenAI" are trademarks of their respective owners. O-Brain has **no official affiliation or certification** with them and does not use their logos or brand assets. (Saying "works with Claude Code" is fine; presenting O-Brain as an officially certified product is not.)
- The product name "O-Brain" is a personal-project working name. Whether it is formally trademarked elsewhere has not been confirmed — if you plan to register a trademark or use this name prominently in a commercial context, we recommend checking an official trademark database separately first.
- **AI-generated content — verify before use**: The code and documentation in this project (including design documents) were produced with AI assistance. Before deploying, redistributing, selling, or delivering this project to a company/client commercially, **please personally verify copyright attribution, provenance, commercial-use eligibility, and similarity to existing copyrighted works (code snippets in particular)** for any AI-generated code, documents, or images included — this project does not warrant that verification on your behalf.
- **What to do when you redistribute (Apache-2.0 summary)**: ① include a copy of `LICENSE` ② mark files you changed as changed ③ keep the original copyright, patent, trademark and attribution notices ④ keep the contents of `NOTICE`. This summary is only an aid to understanding — the `LICENSE` text itself is what counts.
- **What the license does not give you**: removing copyright or license notices, using the names "SoDam AI Studio" or "O-Brain" as if they implied affiliation or endorsement (Apache-2.0 grants no trademark rights), and using other people's trademarks or logos.
- **The part that needs the internet on first run**: the embedding model (`Xenova/all-MiniLM-L6-v2`, about 90 MB) is downloaded from Hugging Face **once** (Apache-2.0, confirmed from public information on 2026-10-21). After that, saving, searching and the screen work only inside your PC.
- **Export, backup and import files**: exported files and backups can contain **personal, client and work information exactly as collected** from your Claude Code conversations. Treat anything you upload to a messenger, email, cloud or repository as made public, and check the contents first (O-Brain never sends files anywhere automatically). Conversely, when you import a file made by someone else, the copyright and personal-data responsibility for its text lies with the person importing it.
- **What you must check yourself**: the pricing, usage policies and terms of AI services such as Claude and Anthropic (separate from O-Brain), model usage policies, other external-service terms, and the license of any font, image or icon you add. The screen currently uses only system fonts and hand-placed inline SVG, with no external fonts, images or CDN (searched in full on 2026-10-21). The screenshots in the documents contain only synthetic demo memories.
- **What needs legal or professional review**: ① redistributing or delivering `node_modules` that contains the LGPL/MPL binary ② the trademark status of the name "O-Brain" ③ copyright ownership and similarity to other works for AI-generated code and documents ④ the legal effect of the disclaimer and limitation-of-liability wording ⑤ whether the "competing products" clause in Anthropic's terms applies to your use.
- **This README/license section is not legal advice.** If you're planning an actual commercial deployment, contract, or redistribution, treat the above as reference only and consult a qualified professional (e.g. a lawyer) as needed.
- Full license text: `LICENSE` file · Full dependency notices: `NOTICE` file

---

*This document and README.en.html have identical content.*
*Korean version: [README.md](./README.md)*
