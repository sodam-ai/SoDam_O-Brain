// 로컬 서버 — 127.0.0.1 전용 바인딩 + localhost CORS 제한 + 정적 web 제공.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { listMemories, countMemories, getMemory, getSimilar, getStats, deleteMemory, updateMemory, addRelation, listRelations, deleteRelation, touchMemory } from './store.mjs';
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

// health + 가벼운 변경 신호(total·lastId) — 대시보드 자동 새로고침 폴링용(추가/삭제·신규 캡처 감지)
app.get('/api/health', (req, res) => {
  let total = 0, lastId = 0;
  try { const s = db.prepare('SELECT COUNT(*) c, COALESCE(MAX(id),0) m FROM memory').get(); total = s.c; lastId = s.m; } catch {}
  res.json({ ok: true, embed: embedMode(), port: PORT, total, lastId });
});
// 목록 — 페이지네이션(대량 대비). limit 1~500, offset≥0. 총계는 /api/stats 또는 헤더.
app.get('/api/memories', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listMemories(db, limit, offset));
});
// 개요 통계 — DB 전체 기준 정확 집계(기억 수와 무관하게 빠름)
app.get('/api/stats', (req, res) => {
  try { res.json(getStats(db)); } catch (e) { res.status(500).json({ error: '통계 생성 실패' }); }
});
// 기억 1건 — 그래프에서 상한 밖 노드를 눌러도 상세를 열 수 있게(대량 대비)
app.get('/api/memory/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  const m = getMemory(db, id);
  if (!m) return res.status(404).json({ error: '없는 기억' });
  res.json(m);
});
// 관계 연결 추천 — 이 기억과 비슷한(유사도) 기억 목록(연결 대상 후보). 종류는 추정 안 함.
app.get('/api/memory/:id/similar', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  try { res.json(getSimilar(db, id, 6)); } catch (e) { res.status(500).json({ error: '추천 실패' }); }
});
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 200); // 입력 길이 제한(ASVS V5)
  if (!q.trim()) return res.json([]);
  try { res.json(await search(db, q, 10)); }
  catch (e) { res.status(500).json({ error: '검색 실패' }); }
});
app.get('/api/graph', (req, res) => {
  const limit = Math.min(2000, Math.max(50, Number(req.query.limit) || 600)); // 노드 상한(대량 프리즈 방지)
  try { res.json(buildGraph(db, { limit })); } catch (e) { res.status(500).json({ error: '그래프 생성 실패' }); }
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

// 기억 편집(사용자) — 내용/유형/중요도. 내용 변경 시 저장 전 자동 redact + 재임베딩(store.updateMemory).
app.patch('/api/memory/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  const { content, type, importance } = req.body || {};
  try { res.json(await updateMemory(db, id, { content, type, importance })); }
  catch (e) { res.status(400).json({ error: e.message || '수정 실패' }); }
});

// 조회 기록(자주 본 기억 글로우) — 상세 열람 시 1회 증가.
app.post('/api/memory/:id/touch', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  try { res.json({ ok: true, touched: touchMemory(db, id) }); }
  catch (e) { res.status(500).json({ error: '기록 실패' }); }
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
