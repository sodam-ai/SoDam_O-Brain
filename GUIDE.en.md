<!-- English Complete Guide · 한국어: GUIDE.md · (This document and GUIDE.en.html have identical content) -->

# SoDam O-Brain — Complete Guide 🧠

> **Even if AI, computers, or software are completely new to you, just follow this guide.**
> Every technical term includes a plain-language explanation.
> This document and GUIDE.en.html have identical content.

---

## Table of Contents

1. [What Is O-Brain?](#1-what-is-o-brain)
2. [Prerequisites · Required Programs](#2-prerequisites--required-programs)
3. [How to Download](#3-how-to-download)
4. [Installation (Step by Step)](#4-installation-step-by-step)
5. [Quick Start](#5-quick-start)
6. [How to Run](#6-how-to-run)
7. [How to Use — Web Dashboard](#7-how-to-use--web-dashboard)
8. [How to Use — MCP Tools · Claude Code Plugin](#8-how-to-use--mcp-tools--claude-code-plugin)
9. [How It Works (Internal Structure)](#9-how-it-works-internal-structure)
10. [Complete Command Reference](#10-complete-command-reference)
11. [Workflow (Typical Daily Usage)](#11-workflow-typical-daily-usage)
12. [Security · Data Flow](#12-security--data-flow)
13. [Architecture (Technical Structure)](#13-architecture-technical-structure)
14. [File · Document Locations](#14-file--document-locations)
15. [Troubleshooting](#15-troubleshooting)
16. [FAQ (Frequently Asked Questions)](#16-faq-frequently-asked-questions)
17. [Legal · Copyright · License · Commercial Use](#17-legal--copyright--license--commercial-use)
18. [Changelog](#18-changelog)
19. [Honest Limitations](#19-honest-limitations)

---

## 1. What Is O-Brain?

**O-Brain** is a **completely local** memory system that automatically extracts and saves important content from conversations with AI (like Claude Code), and makes it retrievable anytime.

### Simple Analogy

> AI is incredibly smart, but it forgets everything the moment a conversation ends.
> It's like talking to a genius friend with amnesia.
>
> **O-Brain is the automatic notepad you keep next to that friend.**
> It records things like "let's use port 7740" or "never put API keys in code,"
> and brings them back up next time.

### Key Features

| Feature | Description |
|---------|-------------|
| **100% Local** | All memories are stored only in your PC (SQLite database). Nothing is sent to external servers or cloud. |
| **Hybrid Search** | Uses keyword search (FTS5) and semantic similarity search (vector search) simultaneously. Finds "similar content" too. |
| **Knowledge Graph** | Visualizes connections between memories as a 2D/3D graph (dots and lines). |
| **Time Travel** | Select a date to see only memories that were "alive" at that point in time. |
| **Confidence Decay** | AI-extracted memories automatically lose confidence over time (30-day half-life). |
| **Security Filter** | API keys and passwords are automatically removed before saving (replaced with REDACTED). |
| **Auto Backup** | Snapshots saved automatically on server start and before bulk delete. |
| **MCP Integration** | 7 tools for saving, searching, and managing memory relations directly from Claude Code. |
| **Orphan Node Visual** | Memories with no user-defined relations are shown with a dashed ring border. |
| **Multi-select & Bulk Delete** | Select multiple memories, delete them at once, and undo within 10 seconds. |
| **⚙ Settings Page** | Adjust list page size, graph node count, auto-refresh, theme, and intro banner directly in the app. Values are saved to this browser and persist across visits. |

---

## 2. Prerequisites · Required Programs

### Required

| Item | Requirement | Notes |
|------|-------------|-------|
| **Operating System** | Windows 10 / 11 (64-bit) | macOS/Linux may work but require additional troubleshooting |
| **Node.js** | 20.x LTS or higher | The "engine" that runs programs. Free download from [nodejs.org](https://nodejs.org) |
| **npm** | Included with Node.js | Installed automatically with Node.js |
| **Storage** | 500 MB+ | AI embedding model (~90 MB) + data storage |
| **RAM** | 4 GB+ recommended | 8 GB+ for a smoother experience |
| **Web Browser** | Chrome, Edge, Firefox, etc. | Needed to view the dashboard |

### Optional (Required for MCP Integration / Plugin)

| Item | Notes |
|------|-------|
| **Claude Code** | Anthropic's AI coding tool. Required only for MCP tool or plugin integration. |
| **Internet** | Only needed for initial installation and first download of the embedding model. Works fully offline afterward. |

### Not Required

- No API key needed (for basic operation)
- No paid subscription needed
- No account registration needed
- No cloud service needed

---

## 3. How to Download

### If You Already Have the Files

If you're reading this guide, the O-Brain files are already on your computer.
Check the project folder location:

```
D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\
```

Or find the folder where you received the files.

### If Using Git (For Developers)

```bash
git clone [repository URL]
cd [folder name]
```

> Access permission is required if the repository is private.

---

## 4. Installation (Step by Step)

There are two ways to use O-Brain. **If you'll only use the web dashboard, do 4-A.** **If you also want automatic memory capture and slash commands in Claude Code, do both 4-A and 4-B.**

### 4-A. Install the Local Server (Required, the foundation of the web dashboard)

#### Step 4-A-1: Install Node.js (One-Time Only)

**Node.js** is the "engine" that runs JavaScript programs.
O-Brain is built with JavaScript, so this engine is required.

1. Open a browser and go to **[https://nodejs.org](https://nodejs.org)**
2. Click the green **"LTS"** button (LTS = Long-Term Support, stable version)
3. Download the installer and run it
4. Click "Next" → "Next" → "Install" → "Finish" (use all defaults)
5. After installation, **open a new terminal**

   > **How to open a terminal**: Windows key + R → type `cmd` → Enter
   > Or: Windows key → search "PowerShell" → click

6. Verify the installation:

   ```
   node --version
   ```

   `v20.x.x` or higher = success.

   ```
   npm --version
   ```

   Any number (e.g., `10.x.x`) = success.

#### Step 4-A-2: Install Dependencies

"Dependencies" are external tools that O-Brain needs to operate.
They are downloaded automatically from the internet.

1. In the terminal, navigate to the `app` folder:

   ```bash
   cd D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app
   ```

   > **Tip**: Copy and paste the path to save time.
   > Avoid Korean characters in the path — they may cause errors.

2. Run the dependency installation:

   ```bash
   npm install
   ```

3. Wait 1–5 minutes (depends on internet speed)

4. When the prompt returns without error messages, the installation is complete.

   > **If you see errors**: See [Section 15: Troubleshooting](#15-troubleshooting).

### 4-B. Install the Claude Code Plugin (Optional, needed for MCP / slash commands)

> Type the two lines below into **Claude Code's input box** (the prompt), not into Windows Explorer.

**① Register the marketplace** — tells Claude Code where the plugin folder is.
```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\plugin
```

**② Install** — installs O-Brain from that marketplace.
```
/plugin install o-brain@o-brain-local
```

**③ Restart Claude Code** → installation complete.

> - `o-brain` = plugin name, `o-brain-local` = marketplace name.
> - Running `/plugin install <folder path>` in one step causes a **"Marketplace not found"** error. You must do it in **two steps**.
> - If blocked by "not a git repository," run `git init && git add -A && git commit -m init` inside that `plugin` folder, then retry step ①.

**Verify it installed correctly:** In Claude Code's input box, try `/o-brain:status` (check memory count/status) or `/o-brain:selftest` (✅✅✅ = OK).

---

## 5. Quick Start

### 5-A. Web Dashboard Only

**1. Start the server from the terminal:**

```bash
cd D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app
npm start
```

**2. You'll see something like this:**

```
O-Brain Local Server ▶ http://127.0.0.1:7740  (embedding: local)
[backup] Snapshot saved: ...
```

> **First run only**: automatically downloads the AI embedding model (~90 MB).
> Takes 1–3 minutes the first time. All subsequent runs start instantly.

**3. Open the dashboard in your browser:**

Type this in your browser's address bar and press Enter:

```
http://127.0.0.1:7740
```

If the O-Brain dashboard opens, you're all set.

### 5-B. With the Claude Code Plugin (3-minute summary)

1. Finish the plugin installation from 4-B above.
2. Speak a clear **decision sentence** during a normal conversation. Example: "let's use port 7740 for this project."
3. **End the conversation** (type `/clear`). → It's saved automatically at that moment.
4. To view it, type `/o-brain:open` in Claude Code → your memory map opens in the browser (auto-starts the server if it's off).

---

## 6. How to Run

### Basic Start

```bash
# Run from the app/ folder
cd D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app
npm start
```

### Change Port (If Port 7740 Is Already in Use)

```bash
# Windows PowerShell
$env:OBRAIN_PORT=7741; npm start

# Or add to .env.local file:
# OBRAIN_PORT=7741
```

### Stop the Server

Press `Ctrl + C` in the terminal.

### Auto-Start on Boot (Optional)

Use Windows Task Scheduler to start automatically when Windows boots.
(Windows key → search "Task Scheduler")

---

## 7. How to Use — Web Dashboard

Open `http://127.0.0.1:7740` in your browser to see the dashboard.
(If you installed the Claude Code plugin, you can also use `/o-brain:open`.)

### 7-1. Screen Layout (Top Tabs)

| Tab | Description |
|-----|-------------|
| **Graph** | Knowledge map showing memories as dots and lines. This is the home screen. |
| **Overview** | Summary: total memory count, distribution by type/category, most-connected memories |
| **List** | Memories displayed as cards, scrollable. Select mode allows bulk delete |
| **Timeline** | Memories in chronological order |
| **⚙ Settings** | Adjust 5 setting groups (List, Graph, Refresh, Screen, Banner) — see Section 7-12 |

> **Quick search/navigate:** Press **⌘K (Mac) / Ctrl+K (Windows)** anywhere to open a small search box that finds *commands (switch views, theme, export) and memories* at once and jumps right to them.

### 7-2. Using the Graph Tab

**What is the graph?** Each memory appears as a dot (node). Memories that are similar or related are connected by lines (edges).

- **Hover over a dot**: Highlights its connected memories
- **Click a dot**: Opens details on the right side
- **Search box**: Searching brightens matching dots
- **2D/3D toggle**: Switch using the "2D"/"3D" button at the top
- **Zoom**: Mouse wheel or buttons at the bottom right
- **Dashed border**: Shown on "orphan memories" with no user-defined relations
- **As memories grow**: the graph shows *the most important ones first* and tells you "**top M of N total**" (to avoid slowing down). You can adjust how many are shown in ⚙ Settings (Section 7-12).

**Color meaning:**
- Dot size = importance + connection count (larger = more important)
- "Category color" button: switch between coloring by type or category

### 7-3. Viewing Memory Details

Click a memory in the list or graph — a detail panel opens on the right:

- **Content**: The stored memory text
- **Type**: Knowledge / Decision / Promise / Constraint, etc.
- **Importance**: ★ rating (1–5)
- **Confidence**: 0.1–1.0 (AI-extracted memories automatically decay over time)
- **Category**: Auto-classified topic
- **Created**: Date the memory was saved
- **Saved session**: Which conversation session it came from (useful when running multiple Claude Code windows at once)
- **View count**: How many times this memory has been opened (more views = brighter glow in graph)

### 7-4. Editing and Deleting Memories

From the detail panel:

- **Edit (✏️)**: Modify content, type, or importance. Secrets are auto-removed again on save.
- **Delete**: Permanently removes the memory. Recommend backing up first.
- **Copy**: Copies content to clipboard

### 7-5. Adding a Memory (Directly in UI)

Use the "+" button at the top or use the API to add memories directly:

- Enter content
- Select type (Knowledge / Decision / Promise, etc.)
- Choose importance (1–5)
- Click Save → semantic analysis and embedding are created automatically

### 7-6. Linking Memory Relations

In the detail panel's "Relations" section:

1. Click "Add Relation"
2. Enter the ID of the memory to link — **candidate memories are suggested automatically**, so you don't need to search manually
3. Choose relation type: SUPERSEDES, SUPPORTS, INFLUENCES, CONTRADICTS — **the type is always chosen by a human**, never auto-detected
4. Save

> **When choosing SUPERSEDES**: the target memory's expiry date (`valid_until`) is automatically set to today.
> (Meaning the target memory has been "invalidated" by this newer one)

### 7-7. Search

In the top search box:

- **Hybrid search**: searches by keyword AND semantic similarity simultaneously
- **Example**: Search "port setting" → shows both memories containing "port" and semantically similar content
- If results are truncated by the server-side limit, you'll see "N more related memories" so results never silently disappear.

### 7-8. Filters · Sorting

In the top filter bar:

- **Scope**: All (global) / Project specific (project)
- **Sort**: Newest first / Oldest first / By importance
- **Importance · date range · project filters**: projects are shown by most recent activity

> **Automatic project classification:** Memories are automatically classified into **the project whose files were actually edited in that session**. No matter where you launched Claude Code from, it goes into whichever project you worked on most.

### 7-9. Time Travel Feature

Select a past date in the date input field:

- Shows only memories that were "alive" at that date
- Memories invalidated by SUPERSEDES are hidden after their invalidation date
- Useful for tracking how your knowledge or decisions have evolved

**Example**: Select 2026-06-01 to see only memories that were valid up to that date.

### 7-10. Export

Top-right "Export" button:

- **JSON format**: Machine-readable data format
- **Markdown format**: Easy to read in a text editor

### 7-11. Bulk Delete

In the List tab, click the "Select" button to select and delete multiple memories at once.

1. Click "Select" → switches to checkbox mode
2. Select the memories to delete → a toolbar shows "N selected" and a "Delete" button
3. Click "Delete" → confirm again in the dialog (a backup is created automatically first)
4. Right after deletion, a toast appears at the bottom: "N deleted · Undo". **Click "Undo" within 10 seconds to restore them** (note: restored memories get a new ID, and previously linked relations are restored on a best-effort basis, not guaranteed)

> **Note**: The undo button disappears after 10 seconds. After that, restore from the latest backup file in `app/data/backups/`.

### 7-12. ⚙ Settings Page

Click the gear (⚙) icon in the header to open the dedicated settings page — a full 5th screen alongside Graph/Overview/List/Timeline. There are 5 adjustable groups, all **saved to this browser** so they persist across visits.

| Group | Setting | Description |
|-------|---------|--------------|
| **List** | Page size | How many memories to load at once for List/Timeline/Overview (50/100/200/500/custom 1–500). **Does not apply to the Graph tab.** |
| **Graph** | Node count | Node cap shown in the Graph tab (300/600/1000/2000/custom 50–2000). Separate from the list page size. |
| **Refresh** | Auto-refresh on | When on, periodically (default 45s, adjustable 10–300s) quietly checks for new memories and updates the screen. |
| **Screen** | Theme | Light/dark toggle. Shares state with the sun/moon icon button in the header. |
| **Banner** | Intro banner visible | Show or hide the "auto-collected from your Claude Code conversations" banner at the top. |

Selecting "Custom…" in any dropdown reveals a number input. Out-of-range values (e.g. 99999 for graph nodes) or decimals are automatically clamped to a safe value on both the client and server.

---

## 8. How to Use — MCP Tools · Claude Code Plugin

### 8-1. Register the MCP Server (settings.json method)

**MCP (Model Context Protocol)** is a standard that lets Claude Code use external tools.
Add the following to Claude Code's settings file (`~/.claude/settings.json`):

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

> Use **forward slashes** (`/`) instead of backslashes (`\`) in the path.

Restart Claude Code after registering.

### 8-2. MCP Tool List

| Tool Name | What It Does | Example |
|-----------|-------------|---------|
| `save_memory` | Save a memory | "Remember this decision" |
| `search_memory` | Search by keyword/meaning | "Find memories about port settings" |
| `get_memory` | Retrieve a specific memory by ID | Fetch detailed info by memory ID |
| `get_related` | List related memories | Find memories related to this one |
| `get_timeline` | List memories in chronological order | View recent memories |
| `add_relation` | Add a relation between two memories | "Link A as superseding B" |
| `list_categories` | Show memory count by category | See which topics have the most |

### 8-3. Example Usage in Claude Code

```
Me: "We just decided to use port 7740. Remember that."
Claude: (runs save_memory tool) "I've saved the port 7740 decision to memory."

Me: "What port decision did we make earlier?"
Claude: (runs search_memory tool) "Found a memory about port: ..."
```

### 8-4. Claude Code Plugin Slash Commands (if installed via 4-B)

| Command | What it does |
|---------|---------------|
| `/o-brain:status` | Shows memory count, recent memories, and status |
| `/o-brain:selftest` | Runs a full check (save/security-redaction/search). ✅✅✅ = OK |
| `/o-brain:remember` | Extracts and saves only the decisions from this conversation (handled directly by your installed Claude Code/Codex — **no separate API key or cost**) |
| `/o-brain:link` | Suggests related memories → you confirm the relation type |
| `/o-brain:backup` | Creates a manual backup |
| `/o-brain:open` | Opens the dashboard in your browser (auto-starts the server if it's off) |

> **How it works in one line:** When you end a conversation (`/clear`), O-Brain scans it and automatically saves only "decision/promise/constraint" sentences. Casual chat or simple commands (like `cd folder`) are not captured.

---

## 9. How It Works (Internal Structure)

This section explains the internal mechanics for those who are curious.
Feel free to skip if you're not interested in technical details.

### 9-1. Memory Storage Process

1. **Input**: Text entered via MCP tool or web UI
2. **Security filter**: Sensitive information (API keys, passwords) is automatically removed
3. **Deduplication**: Compared against existing memories; skipped if duplicate
4. **Embedding**: Text is converted to a 384-dimension numeric vector (all-MiniLM-L6-v2, runs locally)
5. **Storage**: Saved to SQLite database (text + vector + metadata)
6. **Category classification**: Topic is automatically classified using rule-based logic

### 9-2. Search Process (Hybrid Search)

1. **Keyword search (FTS5)**: Exact word matching
2. **Vector search**: Finding content that is semantically similar
3. **RRF merge**: Both results are combined and ranked (using C=60 constant)
4. **Results returned**: Top results ordered by relevance. If truncated by the server limit, a "more available" note is included

### 9-3. Confidence Decay

AI-extracted memories automatically lose confidence over time:

- **Formula**: `new_confidence = old_confidence × 0.5^(days_elapsed/30)`
- **Meaning**: After 30 days, confidence halves; after 60 days, it drops to 1/4
- **Exceptions**: Memories directly entered by users (`source='user'`) and those with confidence ≥ 0.99 are exempt
- **Minimum**: Will not drop below 0.1
- **Frequency**: Applies on server start if more than 12 hours have passed since last application (on the very first run, it only records the timestamp and skips decay — an earlier version lacked this and immediately dropped existing memories to the floor on first run; this has been fixed)

### 9-4. Graph Construction

- **Nodes**: Each memory is one dot
- **Edges (automatic)**: Memories with similar embeddings are automatically connected (sqlite-vec KNN)
- **Edges (manual)**: User-added relations (SUPERSEDES/SUPPORTS, etc.) — shown as colored lines
- **Size**: Proportional to importance + connection count
- **Performance limit**: 600 nodes by default (highest importance first). Adjustable from 50–2000 in ⚙ Settings (Section 7-12)

### 9-5. Local API Token

A new random token is generated each time the server starts:

- Automatically injected into the browser and sent with API requests
- Also saved to `data/.api-token` (for the MCP server to read)
- New token issued on each server restart (enhanced security)

### 9-6. How ⚙ Settings Values Are Stored

The values in the ⚙ Settings page (page size, graph node count, auto-refresh, theme, banner) are stored in **this browser's localStorage**, not on the server. This means:

- Opening on a different computer or browser starts fresh with defaults (100 items / 600 nodes / 45s / dark / banner shown)
- Clearing your browser data (cookies/site data) resets these settings too
- They are never sent to the server or shared with anyone else (purely a personal UI preference)

---

## 10. Complete Command Reference

### 10-1. npm Scripts

Run from the `app/` folder:

| Command | What It Does |
|---------|-------------|
| `npm start` | Start local server (default port 7740) |
| `npm run selftest` | Self-diagnostics (save/search/security tests) |
| `npm run backup` | Create a manual backup |
| `npm run status` | View DB stats and statistics |
| `npm run seed` | Add sample data (for initial testing) |
| `npm run search` | Search demo (terminal-based) |

### 10-2. Claude Code Plugin Slash Commands

| Command | What It Does |
|---------|---------------|
| `/plugin marketplace add <plugin folder path>` | (Install step 1) Register the plugin marketplace |
| `/plugin install o-brain@o-brain-local` | (Install step 2) Install the plugin |
| `/o-brain:status` | View status |
| `/o-brain:selftest` | Run self-check |
| `/o-brain:remember` | Extract and save decisions |
| `/o-brain:link` | Suggest relations |
| `/o-brain:backup` | Manual backup |
| `/o-brain:open` | Open the dashboard |

### 10-3. MCP Tools (Used in Claude Code)

| Tool | Input | Output |
|------|-------|--------|
| `save_memory` | content, type, importance, source, scope | Saved memory ID |
| `search_memory` | query, limit | List of search results |
| `get_memory` | id | Memory details |
| `get_related` | id, limit | List of related memories |
| `get_timeline` | limit, offset | Chronological memory list |
| `add_relation` | from_id, to_id, type | Relation creation result |
| `list_categories` | — | Memory count by category |

### 10-4. HTTP API Endpoints

Accessible at `http://127.0.0.1:7740` while the server is running:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Check server status |
| GET | `/api/memories` | List memories (paginated, `limit`/`offset`) |
| POST | `/api/memory` | Add a memory |
| GET | `/api/memory/:id` | Get a single memory |
| PATCH | `/api/memory/:id` | Update a memory |
| DELETE | `/api/memory/:id` | Delete a memory |
| POST | `/api/memory/batch-delete` | Bulk delete |
| GET | `/api/search` | Search |
| GET | `/api/graph` | Graph data (`limit` controls the node cap, 50–2000) |
| GET | `/api/stats` | Statistics |
| GET | `/api/categories` | Category list |
| GET | `/api/relations` | Relation list |
| POST | `/api/relation` | Add a relation |
| DELETE | `/api/relation/:id` | Delete a relation |
| GET | `/api/session/:id` | Get session (conversation) info |

> All numeric parameters (`limit`/`offset`) are automatically clamped to a safe value by the server, even with out-of-range, decimal, or non-numeric input (verified by testing). Requests from disallowed origins (CORS) are rejected with 403.

### 10-5. Environment Variables (`.env.local`)

Create an `.env.local` file in the `app/` folder to configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `OBRAIN_PORT` | `7740` | Server port number |
| `OBRAIN_DATA_DIR` | `./data` | Data storage folder path |

---

## 11. Workflow (Typical Daily Usage)

### General User (Web UI Focused)

```
Morning: Start server with `npm start`
         → Open http://127.0.0.1:7740
         → Review yesterday's saved memories

During work: Enter new memories directly in the web UI
             Record important decisions as they happen

Evening: Review today's additions
          Link related memories (SUPPORTS, INFLUENCES, etc.)
          Clean up/delete unnecessary memories (bulk delete available)

Weekly: Confirm backups with `npm run backup`
         Review confidence status of older memories
```

### Claude Code User (MCP · Plugin Integration)

```
Starting work: Launching Claude Code automatically brings up some past
               memories as context for the AI (memory recall)

During chat: Important decision → speak clearly, it's auto-captured
             "Remember this decision" → handled instantly via save_memory

Ending work: Run /clear to end the session → that chat's decisions are saved

Occasionally: Open the dashboard with /o-brain:open to review memories,
              link relations, or delete what's no longer needed

Periodically: Back up with /o-brain:backup (also happens automatically
              when the server starts)
```

### Memory Cleanup Workflow

1. Check the overall picture in the web UI's **Overview** tab
2. In the **Graph** tab, identify memories with dashed borders (orphan nodes)
3. Link important but unconnected memories with relations
4. In the **List** tab, delete old or unnecessary memories (bulk delete available)
5. Use **Time Travel** to review past memory states
6. If needed, increase the list/graph counts in **⚙ Settings** to see a wider view

---

## 12. Security · Data Flow

### 12-1. Core Security Principles

O-Brain follows **"Secure by Design"** principles:
Safety before features; the default configuration is the most secure state.

### 12-2. Network Security

| Item | Description |
|------|-------------|
| **Binding address** | `127.0.0.1` (your PC only). Never opens to `0.0.0.0` (all devices). |
| **CORS policy** | Only accepts requests from `localhost` or `127.0.0.1`. Rejects requests from other sites (403). |
| **HTTPS** | HTTP only since it's local. No external exposure. |

### 12-3. Security Headers

The server automatically applies these HTTP security headers:

| Header | Value | Meaning |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'` | Only same-origin resources allowed |
| `X-Content-Type-Options` | `nosniff` | Prevents content type spoofing |
| `X-Frame-Options` | `DENY` | Blocks iframe embedding |
| `Referrer-Policy` | `no-referrer` | Does not send referrer URLs |

### 12-4. Data Security

| Item | How It's Handled |
|------|-----------------|
| **API key detection** | Patterns like `sk-`, `AKIA`, `Bearer ` → auto-replaced with `[REDACTED]` |
| **Passwords** | Patterns like `password=`, `secret=` → auto-removed |
| **Pre-save check** | All `content` fields processed through `redact.mjs` before saving |
| **Re-check on edit** | Content is automatically re-filtered when edited |

### 12-5. Input Validation (Verified by Testing)

| Input Attempted | Server Response |
|------------------|------------------|
| Negative limit/offset | Auto-clamped to the minimum (1 or 0) |
| Non-numeric limit (`abc`) | Auto-replaced with the default |
| Out-of-range large values | Clamped to the maximum (e.g. 2000 for graph, 500 for list) |
| Decimal values (e.g. 500.7) | Rounded to an integer (previously caused a server error — now fixed) |
| Non-existent memory ID | Returns 404 |
| Malformed ID (e.g. letters) | Returns 400 |
| Request from a disallowed origin | Returns 403 |
| Search query with SQL special characters | Safely handled via parameter binding, returns normal (possibly empty) results |

### 12-6. File System Security

| Item | Description |
|------|-------------|
| `data/` folder | In `.gitignore` → never committed to Git |
| `.env.local` | In `.gitignore` → private settings file protected |
| `*.sqlite` | In `.gitignore` → database files protected |
| API token file | `data/.api-token`, permissions 0600 (owner read-only) |

### 12-7. Data Flow Diagram

```
[User / Claude Code]
       ↓ input
[Security Filter redact.mjs]
       ↓ filtered
[Embedding embed.mjs] ← all-MiniLM-L6-v2 (local, no external transmission)
       ↓
[SQLite DB]
  ├── memory table (memory text + metadata)
  ├── memory_fts (FTS5 full-text search index)
  ├── memory_vec (vector search index, 384 dimensions)
  ├── relation table (relations between memories)
  ├── session table (conversation session records)
  └── app_settings table (server settings storage)
       ↓
[search.mjs] → FTS5 + vector hybrid search
       ↓
[server.mjs] → HTTP API (127.0.0.1:7740 only)
       ↓
[Browser / MCP Client]

※ ⚙ Settings page values (page size, theme, etc.) are stored separately in browser
   localStorage only — they never pass through this server/DB flow.
```

### 12-8. Local API Token Flow

```
Server starts → randomBytes(16) generated → API_TOKEN
    ↓                                            ↓
Injected into index.html              Saved to data/.api-token
(browser sends automatically)         (MCP server reads it)
```

### 12-9. Cloud Sync Warning

Do NOT place the `data/` folder in a cloud-synced location (Dropbox, OneDrive, Google Drive, etc.):
- Memory data could be uploaded to the cloud
- SQLite file sync conflicts can occur

---

## 13. Architecture (Technical Structure)

### 13-1. Overall Structure

```
O-Brain
├── Backend (Server)
│   └── Node.js + Express.js v5
│       ├── PORT: 7740
│       ├── HOST: 127.0.0.1 (external blocked)
│       └── ES Modules (type: "module")
├── Database
│   └── SQLite (better-sqlite3)
│       ├── FTS5 (full-text search)
│       └── sqlite-vec (vector search, 384 dimensions)
├── AI Embedding
│   └── @huggingface/transformers
│       └── all-MiniLM-L6-v2 (fully local, downloaded once)
├── Graph Visualization
│   ├── force-graph (2D)
│   └── 3d-force-graph (3D)
│       ※ Both libraries served locally from /vendor/ (no CDN)
├── Web Dashboard
│   └── web/index.html (vanilla JS, 5 tabs: Graph, Overview, List, Timeline, Settings)
└── MCP Server · Claude Code Plugin
    └── @modelcontextprotocol/sdk
        └── 7 tools + 6 slash commands provided
```

### 13-2. Source File Roles

| File | Role |
|------|------|
| `src/server.mjs` | HTTP API server. Handles all API endpoints |
| `src/db.mjs` | SQLite database initialization and migration |
| `src/store.mjs` | Memory CRUD, search, relation management, confidence decay |
| `src/embed.mjs` | Text → vector conversion (embedding) |
| `src/search.mjs` | Hybrid search (FTS5 + vector + RRF) |
| `src/graph.mjs` | Graph data generation (nodes, edges, orphan detection) |
| `src/redact.mjs` | Sensitive information filtering |
| `src/backup.mjs` | Automatic and manual backup |
| `src/mcp-server.mjs` | MCP server (Claude Code integration) |
| `src/classify.mjs` | Memory category auto-classification |
| `src/extract.mjs` | Memory extraction from text |
| `web/index.html` | Web dashboard UI (vanilla JS, single file) |

### 13-3. Database Schema

**memory table (core)**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Unique memory ID |
| `content` | TEXT | Memory text (secrets removed) |
| `type` | TEXT | Type (knowledge/decision/promise/constraint, etc.) |
| `importance` | INTEGER | Importance (1–5) |
| `confidence` | REAL | Confidence (0.1–1.0) |
| `source` | TEXT | Source (ai/user/mcp) |
| `project` | TEXT | Project name |
| `scope` | TEXT | Scope (global/project) |
| `category` | TEXT | Auto-classified category |
| `valid_from` | TEXT | Validity start date |
| `valid_until` | TEXT | Validity end date (auto-set when SUPERSEDED) |
| `invalidated_by` | INTEGER | ID of the memory that invalidated this one |
| `access_count` | INTEGER | Number of times viewed |
| `session_id` | INTEGER | Reference to the saving session |
| `created_at` | TEXT | Creation timestamp |

**relation table**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Unique relation ID |
| `from_id` | INTEGER | Source memory ID |
| `to_id` | INTEGER | Target memory ID |
| `type` | TEXT | Relation type (SUPERSEDES, etc.) |
| `created_at` | TEXT | Creation timestamp |

---

## 14. File · Document Locations

### 14-1. Complete Folder Structure

```
Project Root/
├── .PRD/                     Product Requirements Documents (12 files, for developers)
│   ├── 01_PRD.md
│   ├── 02_DATA_MODEL.md
│   ├── 03_PHASES.md
│   ├── 04_PROJECT_SPEC.md
│   ├── 05_SPEC_DETAIL.md
│   ├── 06_UI_WIREFRAMES.md
│   ├── 07_AGENT_INTEGRATION.md
│   ├── 08_SECURITY.md
│   ├── 09_LICENSE_LEGAL.md
│   ├── 10_DEPLOYMENT_INSTALL.md
│   ├── 11_RESEARCH_SOURCES.md
│   └── 12_USER_DOCS_GUIDE.md
│
├── plugin/                   Claude Code plugin (optional install)
│   ├── commands/               Slash command definitions (status, selftest, remember, link, backup, open)
│   └── hooks/                  SessionStart/SessionEnd hooks
│
├── app/                       Local server app (core)
│   ├── src/                  Source code
│   │   ├── server.mjs        HTTP server
│   │   ├── db.mjs            Database
│   │   ├── store.mjs         Memory management
│   │   ├── embed.mjs         Embedding
│   │   ├── search.mjs        Search
│   │   ├── graph.mjs         Graph
│   │   ├── redact.mjs        Security filter
│   │   ├── backup.mjs        Backup
│   │   ├── mcp-server.mjs    MCP server
│   │   └── classify.mjs      Category classification
│   │
│   ├── web/
│   │   └── index.html        Web dashboard UI (Graph, Overview, List, Timeline, Settings)
│   │
│   ├── data/                 ← Personal data (not committed to Git)
│   │   ├── obrain.db         SQLite database (memory storage)
│   │   ├── backups/          Automatic backup files
│   │   └── .api-token        Local API token (regenerated each run)
│   │
│   ├── node_modules/         Installed packages (created by npm install)
│   ├── package.json          Project configuration
│   └── .env.local            Environment variables (create manually, not committed)
│
├── README.md                 Korean overview
├── README.html                Same content as README.md (HTML)
├── README.en.md               English overview (this pair's source)
├── README.en.html             Same content as README.en.md (HTML)
├── GUIDE.md                   Korean complete guide
├── GUIDE.html                 Same content as GUIDE.md (HTML)
├── GUIDE.en.md                 English complete guide (this file)
├── GUIDE.en.html               Same content as GUIDE.en.md (HTML)
├── LICENSE                    Apache License 2.0 full text
├── NOTICE                     Dependency license notices
└── CHECKPOINT.md              Development progress history (dev reference)
```

### 14-2. Key File Locations Summary

| File | Role |
|------|------|
| `app/data/obrain.db` | **Most important**: All memories stored here |
| `app/data/backups/` | Auto backup files (latest 10 kept) |
| `app/data/.api-token` | Server session token (regenerated on restart) |
| `app/.env.local` | Personal settings (uses defaults if absent) |
| `app/package.json` | npm scripts and dependency list |

### 14-3. Data Backup and Restore

**Auto backup**: Runs automatically on server start and before bulk delete

**Manual backup**:
```bash
cd app
npm run backup
```

**Restore procedure**:
1. Find the desired `.db` file in `app/data/backups/`
2. Copy `app/data/obrain.db` somewhere else (preserve current version)
3. Copy the backup file to `app/data/obrain.db`

---

## 15. Troubleshooting

### 15-1. Installation Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `'node' is not recognized` | Node.js not installed or terminal not reopened | Install LTS from [nodejs.org](https://nodejs.org), then **open a new terminal** |
| Errors during `npm install` | Network issue or wrong Node.js version | Check internet connection. Verify `node --version` is v20+ |
| `better-sqlite3` build failure | Node.js version mismatch | `npm install --force` or reinstall Node.js v20 LTS |
| `ERR_MODULE_NOT_FOUND` | Dependencies not installed | Run `npm install` |

### 15-2. Server Start Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EADDRINUSE: address already in use :::7740` | Port 7740 already in use | Use a different port: `$env:OBRAIN_PORT=7741; npm start` |
| Server won't start | Various causes | Read the full error message. Run `npm run selftest` |
| Server starts but browser can't connect | Firewall issue | Allow Node.js in Windows Firewall. Verify address is `http://127.0.0.1:7740` |

### 15-3. Dashboard Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Graph is empty | No memories saved | Add sample data with `npm run seed` or add a memory directly |
| 3D graph won't show | WebGL (graphics acceleration) not supported | Switch to 2D mode. Or use latest Chrome/Edge |
| New memory not visible | Screen needs refresh | Click the refresh (↻) button at top right, or check auto-refresh in ⚙ Settings |
| White screen | Server not running | Run `npm start`, then refresh |
| Changed a count in ⚙ Settings but the graph didn't change | Expected behavior | "Page size" (for list) and "graph node count" (for graph) are separate settings (Section 7-12) |
| Settings reset on another computer/browser | Expected behavior | ⚙ Settings values are stored only in this browser (Section 9-6) |

### 15-4. Search Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| No search results | No memories exist or embedding not generated | Add a memory and search again. Run `npm run selftest` |
| Irrelevant results | Search term too short or generic | Use more specific words |
| Search is slow | Embedding model initializing | Wait briefly after first launch, then search |

### 15-5. Embedding Model Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| First run is very slow | Downloading embedding model (~90 MB) | Wait 1–3 minutes. Subsequent runs are fast |
| Embedding model download fails | Internet blocked | Check internet connection. Allow Node.js through firewall |

### 15-6. MCP · Plugin Integration Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Marketplace not found` | Tried installing in one step | Do it in **two steps** (register marketplace → install), in order |
| "Not a git repository" error | The plugin folder isn't a git repo | Run `git init && git add -A && git commit -m init` in that folder, then retry |
| MCP tools not visible in Claude Code | settings.json configuration error | Verify path is an **absolute path**. Use forward slashes (`/`) |
| MCP tool calls fail | Server not running | Start the server with `npm start` first |
| Path error | Using backslashes | Change `C:\...` to `C:/...` |
| Nothing gets saved | No clear decision sentence spoken, or session not ended | Speak a clear decision sentence and run `/clear` |

### 15-7. Data Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| I want to undo a memory I just deleted | Within 10 seconds of deletion | Click "Undo" in the toast at the bottom (disappears after 10 seconds) |
| Undo button is gone (past 10 seconds) | Auto-undo window expired | Restore from the latest file in `app/data/backups/` |
| Database file corrupted | Abnormal shutdown | Restore from backup. Use normal shutdown (Ctrl+C) in future |
| API key still visible in memory | Non-standard format missed by filter | Delete or edit that memory immediately → regenerate (rotate) the exposed key |

---

## 16. FAQ (Frequently Asked Questions)

**Q. Where is my data stored?**

A. All memories are stored in `app/data/obrain.db` (an SQLite file).
This file only exists on your computer and is never sent anywhere external.

---

**Q. Do I need internet access?**

A. Only for initial installation (`npm install`) and the first embedding model download.
After that, it works completely offline.

---

**Q. Can I use it without Claude Code?**

A. Yes. The web dashboard (`http://127.0.0.1:7740`) supports all features — adding, searching, and managing memory relations.
Claude Code is only needed for MCP tool or plugin integration.

---

**Q. Does it cost anything?**

A. O-Brain itself is free. If you use Claude Code or the Anthropic API, those services' fees may apply. AI extraction (`/o-brain:remember`) also reuses your installed host LLM directly, so there's no separate API key or charge.

---

**Q. I accidentally deleted a memory. Can I recover it?**

A. If it was a bulk delete, click "Undo" on screen **within 10 seconds** (a backup is also created automatically before deletion). If time has passed, restore from the latest `.db` file in `app/data/backups/`.
(Note: no auto backup before single-item deletion — use `npm run backup` regularly for important memories)

---

**Q. Can I change the port?**

A. Yes. Add `OBRAIN_PORT=7741` to `app/.env.local` and restart the server.

---

**Q. Can I manage memories across multiple projects?**

A. Yes. Set `scope=project` and specify a `project` name when saving memories. Memories saved via Claude Code are automatically classified by the project whose files were actually edited in that session.
Use the `scope` filter when searching or listing to see only that project's memories.

---

**Q. Does it work on Mac or Linux?**

A. Developed for Windows. Basic functionality works on macOS/Linux, but the `better-sqlite3` native module may fail to build.
Try `npm install --force` or reinstalling Node.js LTS if you encounter errors.

---

**Q. Why does confidence keep getting lower?**

A. Confidence decay only applies to AI-extracted memories.
Directly entered memories (`source=user`) and those with confidence ≥ 0.99 are exempt.
You can edit important memories in the web UI to review their content or manually adjust confidence.

---

**Q. What is an "orphan memory" (dashed border)?**

A. A memory that has no user-added relations (SUPERSEDES, SUPPORTS, etc.).
It may have auto-calculated similarity edges, but no explicit user-defined relation.
Adding relations to dashed-border memories enriches your knowledge graph.

---

**Q. How do I use the Time Travel feature?**

A. Select a date in the date input field at the top of the web dashboard.
Only memories that were "alive" at that date will be displayed.
Memories invalidated by SUPERSEDES won't appear after their invalidation date.
Clear the date field to return to the current view (default).

---

**Q. Are the graph node count and the list page size the same setting?**

A. No. In ⚙ Settings, "page size" applies only to List/Timeline/Overview, while "node count" applies only to the Graph tab. Changing one does not affect the other.

---

**Q. Where are ⚙ Settings values stored? Are they shared with anyone?**

A. Only in this browser's localStorage. They are never sent to the server or shared with any other computer or browser.

---

## 17. Legal · Copyright · License · Commercial Use

> ⚠️ **Important Notice**: This section is for general informational purposes.
> It does not constitute legal advice. For specific legal questions, please consult a qualified professional.

### 17-1. License

**Apache License 2.0** © SoDam AI Studio, 2026

This software is distributed under the **Apache License 2.0**.
The full license text is in the `LICENSE` file at the project root.

### 17-2. Copyright Holder

**Copyright Holder**: SoDam AI Studio
**Year**: 2026

### 17-3. Permitted Uses (Under Apache-2.0)

Apache License 2.0 permits the following (when the obligations below are met):

| Permitted | Description |
|-----------|-------------|
| **Personal use** | Free to use for personal purposes |
| **Modification** | Modify the source code and use it |
| **Copying** | Make copies |
| **Redistribution** | Redistribute with or without modifications |
| **Commercial use** | Use, sell, or deliver commercially |
| **Patent use** | Includes grant of contributor patents |

### 17-4. Obligations (You Must Comply)

When redistributing or using commercially, you **must**:

1. **Preserve copyright notice**: Keep the `© SoDam AI Studio, 2026` notice
2. **Preserve license notice**: Include the Apache-2.0 license notice
3. **State changes**: If you modified the original, state that changes were made
4. **Include NOTICE file**: Include the `NOTICE` file (if present) in distributions

### 17-5. No Warranty (AS IS)

**This software is provided without any warranty of any kind.**

- No warranty of functionality
- No warranty of fitness for a particular purpose
- No warranty of error-free operation
- No liability for data loss

**All outcomes and risks from use are entirely the user's responsibility.**

### 17-6. Limitation of Liability

The copyright holder and contributors are not liable for:

- Direct or indirect damages
- Data loss or corruption
- Business losses
- Loss of profits
- Any other consequential damages

### 17-7. External Service Terms Apply Separately

External services used with O-Brain have **their own separate terms**:

| Service | Terms | Relation to O-Brain |
|---------|-------|---------------------|
| **Anthropic/Claude** | Anthropic Terms of Service | Independent. Unrelated to O-Brain license |
| **Claude Code** | Anthropic Terms of Service | Independent. Unrelated to O-Brain license |

> Even though O-Brain is Apache-2.0, using Anthropic's API means **Anthropic's terms, fees, and policies apply separately**.
> Always check the latest terms directly for each service you use.

### 17-8. Dependency Licenses

O-Brain uses the following open-source libraries (full text in the `NOTICE` file). Include each library's license notice when redistributing:

| Library | License | Notes |
|---------|---------|-------|
| `better-sqlite3` | MIT | Confirmed in `NOTICE` |
| `sqlite-vec` | Apache-2.0 | Confirmed in `NOTICE` |
| `@huggingface/transformers` | Apache-2.0 | Confirmed in `NOTICE` |
| `express` | MIT | Confirmed in `NOTICE` |
| `force-graph` | MIT | Confirmed in `NOTICE` |
| `3d-force-graph` | MIT | Confirmed in `NOTICE` |
| `@modelcontextprotocol/sdk` | MIT | Confirmed in `NOTICE` |
| `all-MiniLM-L6-v2` (AI model) | Apache-2.0 | Check the model card directly |

> ⚠️ Before official distribution or commercial delivery, re-verify each package's current official license (licenses can change across versions).

### 17-9. Trademark Notice

- **"Claude"** and **"Anthropic"** are trademarks of their respective companies
- O-Brain is not affiliated with them and has not received official endorsement
- Compatibility statements like "works with Claude Code" are acceptable, but do not imply official partnership or certification

### 17-10. AI-Generated Content

Some code and documentation in this project was created with AI (Claude) assistance.

- Per Anthropic's terms, copyright of AI outputs typically belongs to the user
- Verify Anthropic's current terms directly before commercial publication

### 17-11. Privacy and Data Protection

- Memories (data) stored in O-Brain are **entirely the user's responsibility**
- Avoid storing personal information (name, address, account details, etc.) in memories
- Stored data must be **backed up, protected, and deleted by the user**
- O-Brain developers (SoDam AI Studio) cannot access user data and do not do so
- ⚙ Settings page values are stored only in browser localStorage and never sent to the server

### 17-12. The "O-Brain" Product Name

"O-Brain" is a product name of SoDam AI Studio.
No major competing brand under this exact name has been identified, but a formal trademark search is recommended before public release or commercial distribution.

---

## 18. Changelog

Most recent entries first. Click any entry to expand it.

<details>
<summary><b>2026-07-06 — New ⚙ Settings page + 2 bugs found and fixed during real-world testing</b></summary>

- List/Timeline/Overview page size is now adjustable (50/100/200/500/custom, 1–500), saved to this browser so it persists across visits.
- This feature started as a small dropdown in the filter bar, moved to a header popup after feedback that it was "hard to find," then expanded further into a **real 5th tab (a full settings page)** after feedback that "settings should be its own page."
- Added graph node count (50–2000), auto-refresh on/off and interval (10–300s), theme (light/dark), and intro banner visibility — 5 controls total.
- **Bug fix 1**: Entering a decimal (e.g. 500.7) for graph node count caused `better-sqlite3` to reject it (SQL LIMIT only accepts integers), producing a server 500 error, which the client then mistook for graph data and threw an unhandled exception. Fixed by forcing integers on both server and client; confirmed not reproducible afterward.
- **Bug fix 2**: The bulk-delete confirmation said "undo within 10 seconds," but the actual undo button disappeared (and stopped responding to clicks) after 5.5 seconds. Unified to 10 seconds and re-verified end-to-end (delete → undo → restored under a new ID).
- Also fixed an accessibility warning in the bulk-delete confirmation dialog itself (focus wasn't moved when closing it).
</details>

<details>
<summary><b>2026-07-06 — Session-source display, search truncation transparency, confidence decay first-run bug fix</b></summary>

- Added a "Saved in session · N hours ago" tag to memory detail view (helps distinguish which conversation a memory came from when running multiple Claude Code windows at once).
- Fixed search results silently truncating — now shows "N more related memories" when results are cut off by `limit`.
- Fixed a bug where, on its very first run, confidence decay computed elapsed time from 1970 (since `last_decay_at` didn't exist yet) and immediately dropped existing memories to the floor.
</details>

<details>
<summary><b>2026-07-05 — Bulk-delete verified end-to-end + display bug fix, full MCP tool verification</b></summary>

- Verified the full multi-select → bulk delete → confirmation modal → undo toast flow live in the browser.
- Found and fixed a bug (a CSS rule conflict) where the delete/cancel/count toolbar didn't appear when entering select mode.
- Verified all 7 MCP tools (save_memory, search_memory, get_memory, get_related, get_timeline, list_categories, add_relation) via the actual MCP protocol.
</details>

<details>
<summary><b>2026-06-28 to 2026-06-29 — Convenience features (M3) · Noise cleanup (M4) · scope filter · formal licensing</b></summary>

- Duplicate-save prevention (near-identical memories are skipped, with a reason returned — not a silent failure).
- MCP `add_relation` tool, `/o-brain:link` command (auto-suggests candidates → human confirms the relation type).
- Dashboard multi-select bulk delete (confirmation + undo toast), touch-target accessibility fixes (≥44px).
- Added scope (global/project) filter, formally adopted the Apache-2.0 license, removed the paid Haiku API dependency (replaced by reusing the installed host LLM, at no cost).
</details>

<details>
<summary><b>2026-06-20 to 2026-06-23 — Initial implementation (M1·M2) · Security hardening</b></summary>

- save_memory MCP tool, `/o-brain:remember`, rule-based input sanitization ("memory quality" work).
- Dashboard mobile readability and touch targets ≥44px.
- Dashboard XSS protection, CSP/security headers added.
</details>

The complete milestone-by-milestone history (including risks and mitigations) is in the project's `CHECKPOINT.md` (a development reference document).

---

## 19. Honest Limitations

- **Only clearly stated decisions are reliably captured.** Vague statements may be missed.
- **Topic classification is automatic but occasionally off** (rule-based). For linking relations, **candidate targets are suggested automatically**, but **the type (supersedes/supports/influences/contradicts) must be chosen by a human** — auto-detecting the type can be wrong, so this was deliberately left to human judgment.
- For smarter extraction, **the host LLM (`/o-brain:remember`) handles it at no cost** — no separate API key or charge (uses your already-installed Claude Code/Codex).
- This is currently a **single-user, single-PC** tool (moving or sharing it across PCs requires updating a few config files that have hardcoded absolute paths).
- There is no formal lint/typecheck/build pipeline in this project (plain JS, no bundler). Quality is instead verified via `npm run selftest` (a combined save/security-redaction/search test) and live browser testing.
- This is not a finished, guaranteed product — it's **being refined through real use**. If you hit a snag, share the exact screen or error message and we'll work through it together.

---

**All content in this guide is based on functionality verified to work as of July 2026.**

---

> Korean version: **[GUIDE.md](./GUIDE.md)**
> Overview: **[README.en.md](./README.en.md)** (English) · **[README.md](./README.md)** (Korean)
