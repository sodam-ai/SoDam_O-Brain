<!-- 한국어: [README.md](./README.md) · English: this file -->

# O-Brain — Your AI's Memory Notebook 🧠

> A **100% local** tool that **automatically remembers** the important decisions, rules, and preferences from your Claude Code conversations, and shows them as a **knowledge graph & timeline**.

**In one line:** AI is smart but forgets everything once a chat ends — like a *brilliant friend with amnesia*. O-Brain is the **auto-notepad** you keep next to that friend: it writes down what matters and reminds the AI next time.

---

## What does it do?
- **Auto-save**: when a Claude Code session ends, it automatically records **decisions, promises, constraints** (e.g., "use port 7740 for this project") — no manual work.
- **Auto-redaction (security)**: passwords / API keys are **automatically masked** before saving (`[REDACTED]`).
- **See it as a graph**: browse memories as **dots & lines** (2D/3D graph), a **list**, and a **timeline**.
- **100% local**: everything stays on your PC. Nothing leaves over the internet.

---

## 1. Prerequisites
- Windows PC
- **Node.js** (LTS) — if missing, install from [nodejs.org](https://nodejs.org) and **open a new window**
- **Claude Code**
- Internet (only for installing)

## 2. Install (just 2 steps)
> Type both into the **Claude Code input box**.

**① Register the marketplace**
```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\plugin
```
**② Install**
```
/plugin install o-brain@o-brain-local
```
→ Then **restart Claude Code**. Done.

> `o-brain` = plugin name, `o-brain-local` = marketplace name.
> If ① is blocked because it's "not a git repo", run `git init && git add -A && git commit -m init` in that folder and retry.

## 3. Check it installed
In the Claude Code input box:
- `/o-brain:status` → see memories & status
- `/o-brain:selftest` → one-shot brain check (save / security / search). ✅✅✅ means OK.

---

## 4. How to use (easiest part)
1. Chat as usual; to make it remember something, say a **clear decision sentence**.
   e.g., `Let's set this project's test port to 7740`
   *(Plain commands like `cd` or small talk are NOT saved — only "decide / use / forbid"-type sentences.)*
2. **End the chat**: type `/clear` (or close the window). → saved at this moment.
3. Verify: `/o-brain:status` → the **memory count grows** and your sentence appears.

## 5. See the dashboard
1. In the input box: `! cd D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app; npm start`
   *(or just tell Claude "open the screen")*
2. In your browser address bar:
   ```
   http://127.0.0.1:7740/
   ```
3. Switch tabs: **List · Graph · Timeline**, search at the top, click an item for details.

## 6. Backup & restore (protect your memories)
- **Backup**: `/o-brain:backup` (or `npm run backup`). Also auto-runs when the server starts.
  - Location: `D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app\data\backup\` (keeps the latest 7)
- **Restore**: copy the most recent `obrain-....db` from `backup\` over `app\data\obrain.db`. (Copy the current file elsewhere first.)

---

## 7. Commands at a glance
| What | Where | Command |
|------|-------|---------|
| Install ① | Claude Code | `/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\plugin` |
| Install ② | Claude Code | `/plugin install o-brain@o-brain-local` |
| Status | Claude Code | `/o-brain:status` |
| Self-test | Claude Code | `/o-brain:selftest` |
| Backup | Claude Code | `/o-brain:backup` |
| Open screen | Terminal | `cd D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app` → `npm start` |
| Screen URL | Browser | `http://127.0.0.1:7740/` |

## 8. File & data locations (absolute paths)
- Memory DB: `D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app\data\obrain.db`
- Backups: `...\app\data\backup\`
- Settings: `...\app\.env.local` (sample: `.env.local.example`)

---

## 9. Troubleshooting (things we actually hit)
| Symptom | Cause | Fix |
|---------|-------|-----|
| `Marketplace not found` | Tried to install in one step | Use the **2 steps** (register → install) |
| Nothing gets saved | No "decision" sentence / session not ended | Say a clear decision sentence, then **`/clear`** |
| Screen (URL) won't open | Server not running / port in use | Run `npm start` again, or change `OBRAIN_PORT` in `.env.local` |
| Wrong port answer in a new chat | **Conflict with other memory tools** (see limits) | Known limit — use `search_memory` directly |
| `'node' is not recognized` | Node.js not installed | Install LTS from nodejs.org → **new window** |
| 3D graph won't show | No WebGL / low-spec | Switch to **2D** |
| Install refused (not a git repo) | Local folder | In `plugin` folder: `git init && git add -A && git commit -m init` |

---

## 10. Safety & privacy
- Runs **entirely on your PC**. Memories never leave over the internet.
- Secrets (passwords/keys) are **auto-masked** before being stored.
- Data lives only in the folder above — **back it up yourself** (avoid cloud-synced folders).

## 11. License & warranty
- License: **[to be decided]** (recommended: Apache-2.0 © SoDam AI Studio). Fine for personal local use; **decide before publishing/distributing**.
- **No warranty (AS-IS)**: provided as is; you are responsible for outcomes.
- If O-Brain uses Claude for extraction, **Anthropic's terms apply separately**.

## 12. Honest limitations (current v0.1)
- **Read-back conflict**: other memory tools on the same PC (memory-bank plugin · persona MEMORY.md) may mix in old/conflicting facts, so O-Brain's latest memory can get buried. (improvement planned)
- **Rule-based extraction**: catches clear decision sentences well, but may miss subtle context. (AI/Haiku mode is next)
- **Graph polish**: node size / spacing can be refined.

---

*Written from verified, working values (not guesses). If something breaks, share the exact screen and we'll fix it together.*
