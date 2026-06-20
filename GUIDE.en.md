<!-- English guide · 한국어: GUIDE.ko.md · (This document and GUIDE.en.pdf have identical content) -->

# O-Brain — Complete Beginner Guide 🧠

> **Even if computers / AI / software are brand new to you, just follow along.** Hard words are explained in ( ).

---

## 0. What is O-Brain? (1-minute intro)

AI (Claude Code) is smart, but **the moment you close the chat it forgets everything** you just said — like a *brilliant friend with bad amnesia*.

**O-Brain is the "auto-notepad" you keep next to that friend.**
- It automatically writes down important **decisions, promises, and rules** from your chats,
- reminds the AI next time,
- and shows your memories as a **list, a map (graph), and a timeline**.
- It runs **100% on your own PC** (nothing leaves over the internet).

> Terms: **Claude Code** = an AI tool you use in a terminal. **Plugin** = an add-on you install into Claude Code. **Local** = inside your own PC.

---

## 1. Quick Start (3-minute summary)

In a hurry? Just do this. Details from section 3 onward.

1. **Install Node.js** (only if missing) → the **LTS** version at [nodejs.org](https://nodejs.org) → after installing, **open a new window**.
2. In the **Claude Code input box**, type these two lines one by one:
   ```
   /plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\plugin
   /plugin install o-brain@o-brain-local
   ```
3. **Restart Claude Code.** → Installation done.
4. Chat as usual, then say a clear **decision sentence**. e.g., `Let's set this project's port to 7740`
5. **End the chat** (type `/clear`). → Saved at this moment.
6. To see the screen, type `/o-brain:open` in Claude Code → your memory map opens in the browser.

---

## 2. Prerequisites · Required Programs · Downloads

| What | Required? | Where / How |
|------|:---:|------|
| **Windows PC** | Required | This guide assumes Windows. |
| **Node.js (LTS)** | Required | [nodejs.org](https://nodejs.org) → big green **LTS** button → download → keep clicking "Next". (It's the "engine" that runs programs.) |
| **Claude Code** | Required | The tool you already use. |
| **Internet** | Install only | Only for first install / first run (one-time download of a small AI model). After that, works offline. |
| **Web browser** | Required | Chrome, Edge, anything (to view the screen). |
| **API key / payment** | **Not needed** | O-Brain costs **nothing** — 100% free and local. |

> **Downloading O-Brain itself:** It's already in `D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\`. Nothing extra to download.

---

## 3. Install (just 2 steps, follow exactly)

> The two lines below go into the **Claude Code input box** (prompt) — **inside Claude Code**, not Windows Explorer.

**① Register the marketplace** — tells it where the plugin folder is.
```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\plugin
```

**② Install** — installs O-Brain from that list.
```
/plugin install o-brain@o-brain-local
```

**③ Restart Claude Code** → done.

> - `o-brain` = plugin name, `o-brain-local` = marketplace (list) name.
> - Doing `/plugin install <folder path>` in one step gives a **"Marketplace not found"** error. Always use the **2 steps**.
> - If blocked with "not a git repo", run `git init && git add -A && git commit -m init` in the `plugin` folder, then retry ①.

---

## 4. Check it installed

In the Claude Code input box:
- `/o-brain:status` → shows memory count, recent memories, and status (in Korean).
- `/o-brain:selftest` → one-shot brain check (save / secret-masking / search). **✅✅✅** means OK.

---

## 5. How to Use & How It Works (the key part — very easy)

**How it works, in one line:** *When you end a chat, O-Brain scans it and auto-saves only the "decision / promise / rule" sentences.*

1. **Chat as usual.**
2. Say things you want remembered as **clear decision sentences**.
   - Good: `Let's set this project's test port to 7740` / `Never commit API keys`
   - Not captured: small talk, plain commands like `cd folder`. (Only clear "decide / use / forbid"-type lines.)
3. **End the chat**: type `/clear` (or close the window). → **Saved at this moment.**
4. Verify: `/o-brain:status` → memory count grows and your sentence appears.

> **Automatic security:** passwords / API keys (sk-… etc.) are **masked before being stored** (`[REDACTED]`). This is not a "100% safe" guarantee — always stay careful.

---

## 6. Using the Dashboard

**To open:** type `/o-brain:open` in Claude Code (starts the server if it's off, then opens the browser).
Address: `http://127.0.0.1:7740/` (bookmark it to reopen with one click).

**Three views (top tabs):**
- **List** — memories as cards: type badge, importance (★), date, view count.
- **Graph** — a map of dots and lines (toggle 2D / 3D).
- **Timeline** — chronological.

**In the graph you can:**
- **Hover** a dot → connected memories highlight.
- **Click** a dot → details open on the right.
- **Search** — top box (press `/` to jump there). Matching dots brighten in the graph.
- **"분류색" (category color) button** — recolor dots by *type ↔ topic* (security, UI, deploy, …).
- **"전체 보기" (show all) / focus** — the **◎ (target) button** in the detail panel shows *only that memory and its direct links*; "전체 보기" returns to the full map.
- **Frequently-opened memories glow brighter** (view count).
- **Zoom** — ＋ / − / fit buttons at bottom-right.

**Detail panel (right side, when a memory is clicked):**
- Content, type, category, importance, source, confidence, date, view count.
- **Copy** / **Delete** (irreversible, but a startup backup exists) / **◎ Focus**.
- **"This memory's relations"** — link to other memories as **supersedes / supports / influences / contradicts** (mis-click → "undo" to restore).

**Top tools:** search · type/category chips · **importance & period filters** · sort (newest/oldest/importance) · **light/dark theme** · **export (JSON/Markdown)**.

---

## 7. Commands at a Glance

| What | Where | Command |
|------|------|------|
| Install ① register | Claude Code | `/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\plugin` |
| Install ② install | Claude Code | `/plugin install o-brain@o-brain-local` |
| Status | Claude Code | `/o-brain:status` |
| Self-test | Claude Code | `/o-brain:selftest` |
| Backup | Claude Code | `/o-brain:backup` |
| Open dashboard (auto, recommended) | Claude Code | `/o-brain:open` |
| Screen (manual) | Terminal | `cd D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app` → `npm start` |
| Screen URL | Browser | `http://127.0.0.1:7740/` |
| Backup (manual) | Terminal | `cd ...\app` → `npm run backup` |

---

## 8. Workflow (an example day)

1. **Start working** — when you open Claude Code, some past memories are auto-referenced by the AI (read-back).
2. **While working** — when a key decision is made, state it clearly (it becomes a save target).
3. **Finish** — end the session with `/clear` → that chat's decisions get saved.
4. **Sometimes** — open the screen with `/o-brain:open` to browse memories, link relations, or delete what you don't need.
5. **Periodically** — back up with `/o-brain:backup` (also auto-backs up when the server starts).

---

## 9. File · Data · Document Locations (absolute paths)

| What | Location |
|------|------|
| Project folder | `D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\` |
| Local app (code) | `...\app\` |
| Plugin | `...\plugin\` |
| **Memory DB (precious)** | `...\app\data\obrain.db` |
| Backup folder | `...\app\data\backup\` (keeps latest 7) |
| Settings file | `...\app\.env.local` (sample: `.env.local.example`) |
| User README | `...\README.md` (Korean) · `...\README.en.md` (English) |
| This guide | `...\GUIDE.ko.md` · `...\GUIDE.en.md` (+ each `.pdf`) |
| Design docs (for devs) | `...\.PRD\` (hidden folder, 13 docs) |
| Implementation brief | `...\AGENTS.md` |

**Key settings (.env.local):**
- `OBRAIN_PORT` — the screen's port (default 7740). Change it on conflict.
- `OBRAIN_DATA_DIR` — folder to store memories (default `app\data`).
- `OBRAIN_VEC_GATE` — search sensitivity (default 0.92; lower = stricter).

---

## 10. Backup & Restore (protect your memories)

- **Backup:** `/o-brain:backup` (or `npm run backup`). Also auto-runs once when the server starts.
  - Location: `...\app\data\backup\` (keeps the latest 7 automatically)
- **Restore:** if something breaks, copy the most recent `obrain-....db` from `backup\` over `app\data\obrain.db`. (Copy the current file elsewhere first.)
- ⚠️ Data lives only in that folder — **don't put it in a cloud-synced folder** (conflict/leak risk).

---

## 11. Troubleshooting (things actually hit)

| Symptom | Cause | Fix |
|------|------|------|
| `Marketplace not found` | Tried to install in one step | Use the **2 steps** (register → install) |
| Nothing gets saved | No decision sentence / session not ended | Say a clear decision sentence, then **`/clear`** |
| Screen (URL) won't open | Server not running / port conflict | `/o-brain:open` again, or change `OBRAIN_PORT` in `.env.local` |
| `'node' is not recognized` | Node.js not installed | Install LTS from nodejs.org → **new window** |
| 3D graph won't show | No WebGL / low-spec | Switch to **2D** |
| Search wrong / empty | 1 character or too vague | Use 2+ characters, clearer words |
| Install refused (not a git repo) | Local folder | In `plugin` folder: `git init && git add -A && git commit -m init` |
| Moved to a new PC, doesn't work | Paths are tuned to this PC | Keep the same path, or ask the developer to adjust (currently single-user / this-PC) |

> If stuck, share the **exact screen (or error message)** — we'll fix it together.

---

## 12. Safety · Privacy

- Runs **entirely on your PC**. Memories never leave over the internet.
- The screen server binds only to **127.0.0.1 (your PC)** — not reachable from other devices.
- Secrets (passwords/keys) are **auto-masked** before saving (not a perfect guarantee).
- Keeping and backing up data is **your responsibility**.

---

## 13. License · Copyright · Commercial Use (⚠️ Strict — please read)

- **Current license: undecided ([to be decided]).** The recommendation is *Apache-2.0 © SoDam AI Studio*, but it is **not yet formally applied.**
- **Personal / local use**: using it on your own PC for personal purposes is fine.
- **No redistribution / publishing / sale / commercial use (before the license is set):** until a license is formally chosen, **do not distribute this software, publish it to public repositories, or use it commercially.**
- **No warranty (AS-IS):** provided "as is". **All responsibility for outcomes, data loss, or malfunction lies with the user**; the author makes no warranty whatsoever.
- **Third-party terms are separate:** if you later enable AI features (e.g., Anthropic Claude), **that provider's terms, fees, and policies apply separately** and are unrelated to O-Brain's license.
- **Trademarks / names:** "Claude", "Anthropic", etc. are trademarks of their owners; O-Brain is not affiliated with or endorsed by them.
- **Bundled libraries:** O-Brain uses open-source components (e.g., better-sqlite3, sqlite-vec, force-graph, @huggingface/transformers); **each library's own license applies**. Include their license notices when distributing.

---

## 14. Honest Limitations (current v0.1)

- It remembers **clear decision sentences** well; vague phrasing may be missed.
- **Topic classification is automatic but sometimes wrong** (rule-based). **Linking memories (relations) is still manual.**
- Smarter **AI auto-extraction** is not built yet (enabling it would require a separate API key / cost — currently not applied).
- It is a **single-user / this-PC** stage (moving/sharing to another PC needs extra work).
- This is not a finished, warranted product — it's being refined through real use.

---

*Written from verified, working values (v0.1, as of 2026-06-21). If something breaks, share the exact screen and we'll fix it together.*
