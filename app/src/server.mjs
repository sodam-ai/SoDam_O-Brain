// 로컬 서버 — 127.0.0.1 전용 바인딩 + localhost CORS 제한 + 정적 web 제공.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { listMemories, deleteMemory, addRelation, listRelations, deleteRelation } from './store.mjs';
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
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '64kb' })); // POST 본문 파싱(관계 추가). 로컬 전용·길이 제한.

app.get('/api/health', (req, res) => res.json({ ok: true, embed: embedMode(), port: PORT }));
app.get('/api/memories', (req, res) => res.json(listMemories(db, 100)));
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 200); // 입력 길이 제한(ASVS V5)
  if (!q.trim()) return res.json([]);
  try { res.json(await search(db, q, 10)); }
  catch (e) { res.status(500).json({ error: '검색 실패' }); }
});
app.get('/api/graph', (req, res) => {
  try { res.json(buildGraph(db)); } catch (e) { res.status(500).json({ error: '그래프 생성 실패' }); }
});
// 기억 삭제(사용자 요청) — id 검증 후 1건만 제거. 로컬 전용·파라미터 바인딩.
app.delete('/api/memory/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  try {
    const deleted = deleteMemory(db, id);
    if (!deleted) return res.status(404).json({ error: '없는 기억' });
    res.json({ ok: true, deleted });
  } catch (e) { res.status(500).json({ error: '삭제 실패' }); }
});

// ── 관계(사용자 수동 연결) ──
app.get('/api/relations', (req, res) => {
  try { res.json(listRelations(db)); } catch (e) { res.status(500).json({ error: '관계 조회 실패' }); }
});
app.post('/api/relation', (req, res) => {
  const { from_id, to_id, type } = req.body || {};
  try { res.json({ ok: true, ...addRelation(db, { from_id, to_id, type }) }); }
  catch (e) { res.status(400).json({ error: e.message || '관계 추가 실패' }); }
});
app.delete('/api/relation/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  try { const n = deleteRelation(db, id); if (!n) return res.status(404).json({ error: '없는 관계' }); res.json({ ok: true, deleted: n }); }
  catch (e) { res.status(500).json({ error: '관계 삭제 실패' }); }
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
