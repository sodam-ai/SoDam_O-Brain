<!-- English: this file · 한국어: README.md · Full guide: GUIDE.en.md · (This document and README.en.pdf have identical content) -->

# SoDam O-Brain — AI Memory System

> **A 100% local memory tool that automatically saves important decisions and notes from your AI conversations, and visualizes them as a knowledge graph.**

**In one line:** AI is brilliant but forgets everything the moment a chat ends.
O-Brain is the **auto-notepad** you keep next to that AI — it writes down what matters and brings it back whenever you need it.

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

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| OS | Windows 10 / 11 (64-bit) |
| Node.js | 20.x LTS or higher (free from [nodejs.org](https://nodejs.org)) |
| Storage | 500 MB+ (includes ~90 MB embedding model) |
| RAM | 4 GB+ (8 GB+ recommended) |
| Browser | Chrome, Edge, Firefox, etc. |

> Claude Code is only required for MCP integration. The web dashboard works without it.

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

If you use Claude Code, you can also install it as a plugin:

```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\plugin
/plugin install o-brain@o-brain-local
```

Restart Claude Code after installation → slash commands become available:

| Command | What it does |
|---------|-------------|
| `/o-brain:status` | View current memory count and status |
| `/o-brain:selftest` | Run save/search/security checks (✅✅✅ = OK) |
| `/o-brain:remember` | Extract and save decisions from current chat |
| `/o-brain:link` | Link memories with a relation |
| `/o-brain:backup` | Create a manual backup |
| `/o-brain:open` | Open the dashboard in your browser |

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

Available MCP tools: `save_memory`, `search_memory`, `get_memory`, `get_related`, `get_timeline`, `add_relation`, `list_categories`

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
| Auto backups | `app/data/backups/` (keeps latest 10) |
| API token file | `app/data/.api-token` (regenerated each run) |
| Personal settings | `app/.env.local` (uses defaults if absent) |

### Environment Variables (`app/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OBRAIN_PORT` | `7740` | Server port number |
| `OBRAIN_DATA_DIR` | `./data` | Data storage folder |

---

## Security Overview

- Server binds **only to 127.0.0.1 (your PC)** — not reachable from external devices
- **API keys and passwords auto-removed** before saving (processed by redact.mjs)
- New **local API token** auto-generated each server start (crypto.randomBytes)
- `data/`, `.env.local`, `*.sqlite` are in `.gitignore` — never committed to Git
- No external cloud communication. Embedding model runs entirely locally

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

## Troubleshooting Quick Reference

| Symptom | Fix |
|---------|-----|
| `'node' is not recognized` | Install LTS from [nodejs.org](https://nodejs.org) → **open a new terminal** |
| `EADDRINUSE :::7740` | Add `OBRAIN_PORT=7741` to `.env.local` and restart |
| Graph is empty | Run `npm run seed` to add sample data |
| Browser won't connect | Confirm `npm start` is running → check address is `http://127.0.0.1:7740` |
| Embedding download fails | Check internet connection · allow Node.js through firewall |
| Accidentally deleted a memory | Restore from `app/data/backups/` latest `.db` file |

Full guide: **[GUIDE.en.md](./GUIDE.en.md)** (English) · **[GUIDE.md](./GUIDE.md)** (Korean)

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
- Full license text: `LICENSE` file

---

*This document and README.en.pdf have identical content.*
*Full guide: [GUIDE.en.md](./GUIDE.en.md) (English) · [GUIDE.md](./GUIDE.md) (Korean)*
