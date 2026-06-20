// 로컬 서버 — 127.0.0.1 전용 바인딩 + localhost CORS 제한 + 정적 web 제공.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { listMemories } from './store.mjs';
import { initEmbedder, embedMode } from './embed.mjs';
import { buildGraph } from './graph.mjs';
import { backupOnce } from './backup.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.OBRAIN_PORT || 7740);
const HOST = '127.0.0.1'; // 외부 기기 차단 (08 보안)

const db = openDb();
await initEmbedder();

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return res.status(403).json({ error: 'forbidden origin' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, embed: embedMode(), port: PORT }));
app.get('/api/memories', (req, res) => res.json(listMemories(db, 100)));
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '');
  if (!q.trim()) return res.json([]);
  try { res.json(await search(db, q, 10)); }
  catch (e) { res.status(500).json({ error: '검색 실패' }); }
});
app.get('/api/graph', (req, res) => {
  try { res.json(buildGraph(db)); } catch (e) { res.status(500).json({ error: '그래프 생성 실패' }); }
});
// 그래프 라이브러리는 로컬에서 제공(100% 로컬 — CDN 미사용)
app.use('/vendor/force-graph', express.static(join(HERE, '..', 'node_modules', 'force-graph', 'dist')));
app.use('/vendor/3d-force-graph', express.static(join(HERE, '..', 'node_modules', '3d-force-graph', 'dist')));
app.use(express.static(join(HERE, '..', 'web')));

app.listen(PORT, HOST, () => {
  console.log(`O-Brain 로컬 서버 ▶ http://${HOST}:${PORT}  (임베딩: ${embedMode()})`);
  // 시작 시 데이터 안전망 — 자동 백업(PRD 05 §4)
  backupOnce({ tag: 'startup' })
    .then(r => console.log(`[backup] 스냅샷 저장: ${r.dest} (보관 ${r.total}개)`))
    .catch(e => console.error('[backup] 실패(무시):', e?.message));
});
