// 로컬 서버 — 127.0.0.1 전용 바인딩 + localhost CORS 제한 + 정적 web 제공.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openDb, DATA_DIR } from './db.mjs';
import { search } from './search.mjs';
import { strictId, addMemory, listMemories, countMemories, getMemory, getSimilar, getStats, deleteMemory, updateMemory, addRelation, listRelations, deleteRelation, touchMemory, listCategories, applyConfidenceDecay, findDuplicateCandidates, findExactDuplicates, findShortestPath } from './store.mjs';
import { initEmbedder, embedMode, readEmbedDegraded } from './embed.mjs';
import { buildGraph } from './graph.mjs';
import { backupOnce, listBackups, portableBackup, backupDir } from './backup.mjs';
import { exportMemories, buildExport, FORMATS } from './export.mjs';
import { parseImportFile, makePreview, startImport, getJob, undoImport } from './import.mjs';
import { CATEGORIES } from './classify.mjs';
import { isAllowedHost } from './hostguard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.OBRAIN_PORT || 7740);
const HOST = '127.0.0.1'; // 외부 기기 차단 (08 보안)

const db = openDb();
await initEmbedder();

// 로컬 API 토큰 — 서버 실행마다 새로 생성. index.html에 주입 + data/.api-token 파일 공유(MCP 플러그인용).
const API_TOKEN = randomBytes(16).toString('hex');
const API_TOKEN_BUF = Buffer.from(API_TOKEN);
try { writeFileSync(join(DATA_DIR, '.api-token'), API_TOKEN, { mode: 0o600 }); } catch {}

// 타이밍 공격 방지 — 문자열 !== 비교는 다른 지점에서 비교가 끊겨 실행시간 차이로
// 토큰을 한 글자씩 유추당할 여지가 있음(방어심층). 길이 확인 후 timingSafeEqual만 사용.
function isValidToken(token) {
  if (typeof token !== 'string') return false;
  const buf = Buffer.from(token);
  return buf.length === API_TOKEN_BUF.length && timingSafeEqual(buf, API_TOKEN_BUF);
}

// 사용자에게 보여줄 오류 문구 — 우리가 일부러 던진 한글 안내("내용이 비어 있어요" 등)만 그대로, 그 밖(SQLite·파일 오류 등)은 경로·내부 정보가
// 섞일 수 있어 일반 문구로 바꾼다(PRD 08 §7: 운영에서 상세 에러 비노출). 상세는 서버 로그에만 남는다.
const friendlyError = (e, fallback) => (e && /[가-힣]/.test(String(e.message || '')) ? String(e.message) : fallback);

// 거절된 요청 기록(보안 로그, ASVS V7) — 이유·메서드·경로만 남기고 토큰·헤더 값·쿼리·본문은 절대 남기지 않는다.
// 서버 재시작 뒤 열려 있던 옛 화면이 폴링으로 반복 거절될 수 있어, 같은 이유는 분당 1줄(누적 횟수 포함)로 줄인다.
const deniedLog = new Map();
function logDenied(reason, req) {
  const s = deniedLog.get(reason) || { last: 0, n: 0 };
  s.n++; deniedLog.set(reason, s);
  const now = Date.now(); if (now - s.last < 60000) return;
  console.warn(`[security] 요청 거절(${reason}) ${req.method} ${String(req.originalUrl || req.url || '').split('?')[0].slice(0, 60)} — 최근 ${s.n}회`);
  s.last = now; s.n = 0;
}

const app = express();
app.disable('x-powered-by'); // 서버 종류(Express)를 응답 헤더로 알리지 않는다(정보 노출 최소화)
// 맨 첫 미들웨어 — '/'(토큰이 박힌 HTML)·정적 파일·/api 전부에 적용. DNS 리바인딩 방어(PRD 08 §2): 허용한 Host 외엔 거부.
app.use((req, res, next) => {
  if (!isAllowedHost(req.headers.host, PORT)) { logDenied('허용되지 않은 Host', req); return res.status(403).json({ error: 'forbidden host' }); }
  next();
});
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    logDenied('허용되지 않은 Origin', req);
    return res.status(403).json({ error: 'forbidden origin' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
// 로컬 API 토큰 검증(PRD 08 §2 Should) — 지금까지는 발급만 하고 검증을 안 해 장식이었음.
// index.html이 이미 모든 /api/ 요청에 헤더를 자동 첨부하도록 되어 있어(541-549줄 fetch 몽키패치) 안전하게 켤 수 있음.
// [M77] 본문 파서보다 '앞'에 둔다 — 토큰 없는 요청이 큰 본문을 읽게 만들지 않기 위해(내보내기·가져오기는 본문 한도가 더 큼).
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store'); // 기억 내용이 담긴 응답이 브라우저/중간 캐시에 남지 않게
  if (!isValidToken(req.headers['x-obrain-token'])) { logDenied('토큰 없음·불일치', req); return res.status(403).json({ error: '허용되지 않은 요청' }); }
  next();
});
// 내보내기 요청만 본문 한도를 늘림(화면에 불러온 기억 id 목록을 보낼 수 있어야 함). 먼저 읽힌 본문은 아래 전역 파서가 다시 읽지 않는다.
app.use('/api/export', express.json({ limit: '1mb' }));
// 가져오기 파일은 원시 바이트로 받는다(JSON 포장·base64 없이). 한도 6MB는 "5MB 초과" 안내 문구를 import.mjs가 낼 수 있게 한 여유분.
app.use('/api/import/preview', express.raw({ type: () => true, limit: '6mb' }));
app.use(express.json({ limit: '64kb' })); // POST 본문 파싱(관계 추가). 로컬 전용·길이 제한.

// health + 가벼운 변경 신호(total·lastId) — 대시보드 자동 새로고침 폴링용(추가/삭제·신규 캡처 감지)
app.get('/api/health', (req, res) => {
  let total = 0, lastId = 0;
  try { const s = db.prepare('SELECT COUNT(*) c, COALESCE(MAX(id),0) m FROM memory').get(); total = s.c; lastId = s.m; } catch {}
  // embedDegraded: 의미검색이 중단된 적이 있고 아직 안 풀림(다른 프로세스=훅·MCP가 남긴 표식 포함) — 대시보드 배너용. 사유는 경로가 섞일 수 있어 응답에 싣지 않는다(08 §7).
  res.json({ ok: true, embed: embedMode(), embedDegraded: !!readEmbedDegraded(), port: PORT, total, lastId });
});
// 목록 — 페이지네이션(대량 대비). limit 1~500, offset≥0. 총계는 /api/stats 또는 헤더.
app.get('/api/memories', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const scope = req.query.scope ? String(req.query.scope) : null;
  const at = req.query.at ? String(req.query.at).slice(0, 10) : null; // YYYY-MM-DD 시간여행
  res.json(listMemories(db, limit, offset, scope, at));
});
// 개요 통계 — DB 전체 기준 정확 집계(기억 수와 무관하게 빠름)
app.get('/api/stats', (req, res) => {
  try { res.json(getStats(db)); } catch (e) { res.status(500).json({ error: '통계 생성 실패' }); }
});
app.get('/api/categories', (req, res) => {
  try { res.json(listCategories(db)); } catch (e) { res.status(500).json({ error: '카테고리 조회 실패' }); }
});
// 두 기억 사이 최단경로 — PRD 05 §6 "그래프 분석 알고리즘"
app.get('/api/path', (req, res) => {
  const from = Number(req.query.from), to = Number(req.query.to);
  if (!Number.isInteger(from) || from <= 0 || !Number.isInteger(to) || to <= 0) {
    return res.status(400).json({ error: '잘못된 id' });
  }
  try { res.json(findShortestPath(db, from, to)); } catch (e) { res.status(500).json({ error: '경로 탐색 실패' }); }
});
// 기억 1건 — 그래프에서 상한 밖 노드를 눌러도 상세를 열 수 있게(대량 대비)
app.get('/api/memory/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  const m = getMemory(db, id);
  if (!m) return res.status(404).json({ error: '없는 기억' });
  // 어느 세션에서 저장됐는지 — 여러 창(세션)이 동시에 O-Brain을 쓸 때 출처 구분용(읽기 전용, 실패해도 무시)
  if (m.session_id) {
    try { m.session = db.prepare('SELECT project, tool, ended_at FROM session WHERE id = ?').get(m.session_id) || null; }
    catch { m.session = null; }
  }
  res.json(m);
});
// 세션 정보 — 여러 창(세션)이 동시에 O-Brain을 쓸 때 "이 기억이 어느 세션에서 왔는지" 출처 확인용.
app.get('/api/session/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  try {
    const s = db.prepare('SELECT id, project, tool, ended_at FROM session WHERE id = ?').get(id);
    if (!s) return res.status(404).json({ error: '없는 세션' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: '세션 조회 실패' }); }
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
// 그래프 캐시 — DB 지문(총건수+최대id+관계수)이 안 바뀌면 재계산 생략.
// 훅이 별도 프로세스로 저장한 변경도 이 지문으로 잡힘(서버 자체 쓰기 경로에만 의존하는 무효화보다 안전).
const graphCache = new Map();
function graphFingerprint() {
  const r = db.prepare(
    'SELECT (SELECT COUNT(*) FROM memory) mc, (SELECT COALESCE(MAX(id),0) FROM memory) mid, (SELECT COUNT(*) FROM relation) rc'
  ).get();
  return `${r.mc}:${r.mid}:${r.rc}`;
}
// 백업 목록(읽기 전용) — 종류(자동/위험 작업 직전/직접/이식용)·기억 건수·열림 확인(ok)을 함께 돌려준다.
// 되돌리기(DB 교체)는 화면이 아니라 터미널 `npm run restore`로만 한다 — 서버가 쥔 데이터 파일을 덮어쓰면 손상될 수 있어서(PRD 05 §4).
app.get('/api/backups', (req, res) => {
  try { res.json({ dir: backupDir(), items: listBackups() }); } catch (e) { res.status(500).json({ error: '백업 목록 조회 실패' }); }
});
// 지금 백업 만들기 — 기존 데이터를 전혀 건드리지 않는 순수 추가 동작(새 파일만 생성). body.kind==='portable'이면 이식용(.json.gz).
app.post('/api/backups', async (req, res) => {
  const portable = (req.body || {}).kind === 'portable';
  try { const r = portable ? portableBackup() : await backupOnce({ tag: 'manual' }); res.json({ ok: true, ...r }); }
  catch (e) {
    if (e && e.code === 'EMPTY') return res.status(400).json({ error: '백업할 기억이 아직 없어요' });
    console.error('[backup]', e); res.status(500).json({ error: '백업 생성 실패' });
  }
});
// 백업 파일 내려받기 — 목록에 있는 이름만(경로조작 불가, 08 §3/§4). 다른 PC로 옮기거나 클라우드에 따로 보관하려는 용도.
app.get('/api/backups/download', (req, res) => {
  const it = listBackups({ inspect: false }).find(x => x.file === String(req.query.file || ''));
  if (!it) return res.status(404).json({ error: '없는 백업 파일이에요' });
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(it.size),
    'Content-Disposition': `attachment; filename="obrain-backup${it.file.slice(it.file.indexOf('.'))}"; filename*=UTF-8''${encodeURIComponent(it.file)}`,
    'X-Obrain-Filename': encodeURIComponent(it.file),
    'Cache-Control': 'no-store',
  });
  const s = createReadStream(join(backupDir(), it.file));
  s.on('error', () => { if (!res.headersSent) res.status(500).json({ error: '백업 파일을 읽지 못했어요' }); else res.destroy(); });
  s.pipe(res);
});
// 중복 후보 조회(읽기 전용) — 실제 삭제·병합 엔드포인트는 아직 없음(사람 확인 UI 마련 후 별도 추가 예정, PRD의
// "자동 삭제 금지·확인 게이트 필수" 원칙상 탐지와 실행을 분리해 위험을 낮춤).
app.get('/api/duplicates', (req, res) => {
  try { res.json(findDuplicateCandidates(db)); } catch (e) { res.status(500).json({ error: '중복 탐지 실패' }); }
});
// 중복 정리 실행 — 사람이 화면에서 내용을 보고 확인한 뒤에만 호출됨(자동 실행 없음, PRD 준수).
// 삭제 전 자동 백업 필수(배치삭제와 동일 안전장치) + 되돌리기용 원본 스냅샷 반환.
app.post('/api/duplicates/merge', async (req, res) => {
  const keepId = strictId((req.body || {}).keepId), dropId = strictId((req.body || {}).dropId);
  const mode = (req.body || {}).mode === 'combine' ? 'combine' : 'keep';
  if (keepId === null || dropId === null || keepId === dropId)
    return res.status(400).json({ error: '잘못된 대상' });
  const keepMem = getMemory(db, keepId), dropMem = getMemory(db, dropId);
  if (!keepMem || !dropMem) return res.status(404).json({ error: '없는 기억' });
  try { await backupOnce({ tag: 'before-merge' }); }
  catch (e) { console.error('[duplicates/merge]', e); return res.status(500).json({ error: '백업 실패로 정리 중단' }); } // 08 §7: 상세는 로컬 로그만(2026-08-02 정보노출 수정 — clean-exact와 동일 패턴)
  try {
    const keepOriginalContent = keepMem.content; // 되돌리기용 원본(합치기 모드일 때만 의미 있음)
    if (mode === 'combine') await updateMemory(db, keepId, { content: keepOriginalContent + '\n\n' + dropMem.content });
    deleteMemory(db, dropId);
    res.json({ ok: true, kept: keepId, dropped: dropId, mode, dropSnapshot: dropMem, keepOriginalContent });
  } catch (e) { console.error('[duplicates/merge]', e); res.status(500).json({ error: '정리 실패' }); } // 08 §7: 상세 원인은 로컬 로그(console.error)에만, 화면엔 일반 메시지만
});
// 완전일치 중복 일괄 정리 — "찾기는 항상 자동, 실행은 사람이 확인 버튼 누른 뒤"(PRD 자동삭제 금지 원칙 유지).
// findDuplicateCandidates가 아니라 findExactDuplicates를 직접 호출 — DB가 줄어 total<=1500이 되어
// KNN(유사도) 경로로 바뀌어도, 이 일괄삭제만큼은 "완전일치"만 대상으로 고정(모호한 유사매칭까지
// 자동 삭제 대상에 넣지 않기 위함). 안전장치: batch-delete와 동일하게 백업 1회 + 루프 삭제
// (merge API처럼 건마다 백업하면 keep=7 회전이 최근 진짜 백업을 밀어냄 — 2026-07-27 M14 2차 시도
// 사고와 같은 패턴이라 반드시 피함). 응답에 삭제분 전체 스냅샷(관계 포함)을 담아 undo를
// 클라이언트 캐시(all 배열, 페이지 상한 있음)에 의존하지 않고 되돌릴 수 있게 함.
app.post('/api/duplicates/clean-exact', async (req, res) => {
  const total = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const r = findExactDuplicates(db, 1000, total);
  if (!r.pairs.length) return res.json({ ok: true, deleted: [], failed: [] });
  try { await backupOnce({ tag: 'before-dup-clean' }); }
  catch (e) { console.error('[duplicates/clean-exact]', e); return res.status(500).json({ error: '백업 실패로 정리 중단' }); } // 08 §7: 상세는 로컬 로그만(2026-08-02 검증 중 발견 — e.message가 서버 절대경로를 응답에 노출하고 있었음)
  const deleted = [], failed = [];
  for (const p of r.pairs) {
    const id = p.b.id;
    const relRows = db.prepare('SELECT from_id, to_id, type FROM relation WHERE from_id = ? OR to_id = ?').all(id, id);
    try {
      const n = deleteMemory(db, id);
      if (n) deleted.push({ id, content: p.b.content, type: p.b.type, importance: p.b.importance, source: p.b.source, confidence: p.b.confidence, project: p.b.project, category: p.b.category, scope: p.b.scope, relations: relRows });
      else failed.push(id);
    } catch { failed.push(id); }
  }
  res.json({ ok: true, deleted, failed });
});
// 내보내기(JSON·JSONL·CSV·마크다운·TXT·HTML, 선택 gzip) — 읽기 전용 스냅샷. 저장 경로는 항상 data/export/ 고정(사용자 지정 경로 없음, 08 §3/§4 경로조작 방지).
// body: { format, scope:{mode:'all'|'ids'|'project', ids?, project?}, stripProject, gzip, mode:'save'|'download' }
//  - 'save'(기본, 기존 동작 호환): 서버가 파일로 직접 써서 경로·건수만 응답(대량 내보내기 시 프리징 방지).
//  - 'download': 파일 내용을 그대로 응답(브라우저가 내려받기). 이름·건수는 X-Obrain-* 헤더로.
app.post('/api/export', (req, res) => {
  const b = req.body || {};
  const opts = {
    format: Object.hasOwn(FORMATS, b.format) ? b.format : 'json',
    scope: b.scope && ['all', 'ids', 'project'].includes(b.scope.mode) ? b.scope : { mode: 'all' },
    stripProject: b.stripProject === true,
    gzip: b.gzip === true,
  };
  try {
    if (b.mode === 'download') {
      const r = buildExport(db, opts);
      res.set({
        'Content-Type': r.mime + (r.gzip ? '' : '; charset=utf-8'),
        'Content-Disposition': `attachment; filename="obrain-export${r.filename.slice(r.filename.indexOf('.'))}"; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
        'X-Obrain-Filename': encodeURIComponent(r.filename),
        'X-Obrain-Count': String(r.count),
        'X-Obrain-Relations': String(r.relationCount),
        'Cache-Control': 'no-store',
      });
      return res.send(r.bytes);
    }
    res.json({ ok: true, ...exportMemories(db, opts) });
  } catch (e) {
    if (e && e.code === 'EMPTY') return res.status(400).json({ error: e.message });
    console.error('[export]', e); res.status(500).json({ error: '내보내기 실패' }); // 08 §7: 상세는 로컬 로그만
  }
});
// ── 가져오기(JSON·JSONL·CSV·TSV·마크다운·TXT, .gz 포함) ──
// PRD 08 §4: 확장자·MIME·크기 화이트리스트와 실행 차단은 import.mjs가 담당. 흐름은 미리보기(DB 무변경) → 확인 → 자동 백업 → 저장 → 되돌리기.
const headerText = v => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };
const importFail = (res, e, label) => {
  if (e && e.code === 'IMPORT') return res.status(400).json({ error: e.message }); // 우리가 쓴 한글 안내만 그대로
  console.error(label, e); res.status(500).json({ error: '가져오기에 실패했어요' }); // 08 §7: 상세는 로컬 로그만
};
app.post('/api/import/preview', (req, res) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  try {
    const parsed = parseImportFile({ bytes, filename: headerText(req.headers['x-obrain-filename']), mime: String(req.headers['x-obrain-mime'] || ''), split: req.query.split === 'line' ? 'line' : 'paragraph' });
    res.json({ ok: true, ...makePreview(db, parsed) });
  } catch (e) { importFail(res, e, '[import:preview]'); }
});
app.post('/api/import/commit', (req, res) => {
  const b = req.body || {};
  try { res.status(202).json({ ok: true, ...startImport(db, { previewId: String(b.previewId || ''), keepTrust: b.keepTrust === true }) }); }
  catch (e) { importFail(res, e, '[import:commit]'); }
});
app.get('/api/import/status', (req, res) => {
  const j = getJob(String(req.query.job || ''));
  if (!j) return res.status(404).json({ error: '진행 중인 가져오기를 찾지 못했어요' });
  res.json(j);
});
app.post('/api/import/undo', async (req, res) => {
  try { res.json({ ok: true, ...(await undoImport(db, (req.body || {}).batchId)) }); }
  catch (e) { importFail(res, e, '[import:undo]'); }
});
app.get('/api/graph', (req, res) => {
  const limit = Math.min(2000, Math.max(50, Number(req.query.limit) | 0 || 600)); // 노드 상한(대량 프리즈 방지) — 소수 입력 시 정수화(better-sqlite3 LIMIT 바인딩 방어)
  try {
    const fp = graphFingerprint();
    const cached = graphCache.get(limit);
    const data = (cached && cached.fp === fp) ? cached.data : buildGraph(db, { limit });
    if (!cached || cached.fp !== fp) graphCache.set(limit, { fp, data });
    res.json(data);
  } catch (e) { res.status(500).json({ error: '그래프 생성 실패' }); }
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

// 일괄 삭제 — 삭제 전 자동 백업 필수(실패 시 전체 중단). 성공·실패 id 분리 반환.
app.post('/api/memory/batch-delete', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids 배열 필수' });
  const validIds = [...new Set(ids.map(strictId).filter(n => n !== null))]; // true·[5]·''처럼 Number()로 엉뚱한 id가 되는 값은 걸러낸다
  if (!validIds.length) return res.status(400).json({ error: '유효한 id가 없어요' });
  try { await backupOnce({ tag: 'before-delete' }); }
  catch (e) { console.error('[memory:batch-delete]', e); return res.status(500).json({ error: '백업 실패로 삭제 중단' }); } // 08 §7: 상세는 로컬 로그만(2026-08-02 정보노출 수정 — clean-exact와 동일 패턴)
  const deleted = [], failed = [];
  for (const id of validIds) {
    try { const n = deleteMemory(db, id); if (n) deleted.push(id); else failed.push(id); }
    catch { failed.push(id); }
  }
  res.json({ ok: true, deleted, failed });
});

// 기억 생성(UI 복원·신규용) — addMemory 재사용(redact·embed·중복방지 포함)
app.post('/api/memory', async (req, res) => {
  const { content, type = '지식', importance = 3, source = 'user', confidence = 1, project = null, scope, category = null } = req.body || {};
  if (!content || typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: '내용 필수' });
  try {
    const confNum = Number(confidence);
    // scope 미지정 시: project가 있으면 project로 추론(extract-session.mjs 자동캡처 경로와 동일 원칙,
    // PRD 02 "Phase 1 기본값=project·자동 전역화 금지" 준수) — 명시적 'global'/'project'는 그대로 존중.
    const resolvedScope = scope === 'project' || scope === 'global' ? scope : (project ? 'project' : 'global');
    const result = await addMemory(db, { content, type, importance: Math.min(5, Math.max(1, Number(importance) || 3)),
      source, confidence: Number.isFinite(confNum) ? Math.min(1, Math.max(0, confNum)) : 1,
      project, scope: resolvedScope,
      category: CATEGORIES.includes(category) ? category : null }); // 미지정/무효값이면 addMemory가 content로 자동분류(store.mjs classify 폴백)
    res.status(result.skipped ? 200 : 201).json({ ok: true, ...result });
  } catch (e) { console.error('[memory:create]', e); res.status(500).json({ error: '저장 실패' }); } // 08 §7: 동일 원칙
});

// 기억 편집(사용자) — 내용/유형/중요도. 내용 변경 시 저장 전 자동 redact + 재임베딩(store.updateMemory).
app.patch('/api/memory/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 id' });
  const { content, type, importance } = req.body || {};
  try { res.json(await updateMemory(db, id, { content, type, importance })); }
  catch (e) { console.error('[memory:update]', e); res.status(400).json({ error: friendlyError(e, '수정 실패') }); }
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
  catch (e) { console.error('[relation:create]', e); res.status(400).json({ error: friendlyError(e, '관계 추가 실패') }); }
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
// index.html에 API 토큰 주입 — static보다 먼저 등록해야 덮어씀(PRD 08 로컬 보안)
app.get('/', (req, res) => {
  try {
    const html = readFileSync(join(HERE, '..', 'web', 'index.html'), 'utf8');
    res.type('text/html').set('Cache-Control', 'no-store').send(html.replace('__OBRAIN_TOKEN__', API_TOKEN)); // 토큰이 박힌 화면은 캐시에 남기지 않는다
  } catch { res.status(500).send('index.html 로딩 실패'); }
});
app.use(express.static(join(HERE, '..', 'web')));

// 전역 에러 핸들러(반드시 마지막) — PRD 08 §7: 운영에서 스택트레이스·내부경로 비노출.
// express.json() 파싱 실패(깨진 JSON)·본문 용량 초과처럼 라우트의 개별 try/catch를 거치지 않는 에러가
// 여기로 떨어짐 — 지금까지는 Express 기본 핸들러가 스택트레이스·서버 내부 경로를 그대로 응답에 노출했음
// (2026-07-27 검증 중 발견: 깨진 JSON 전송 시 D:\...\node_modules 경로까지 그대로 노출 확인).
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  const status = (err && (err.status || err.statusCode)) || 500;
  const tooBig = /^\/api\/import\//.test(req.originalUrl || '') ? '파일이 너무 커요(5MB 이하만 가져와요). 나눠서 올려 주세요.' : '보내는 내용이 너무 커요';
  res.status(status).json({ error: status === 413 ? tooBig : '요청을 처리하지 못했어요' });
});

app.listen(PORT, HOST, () => {
  console.log(`O-Brain 로컬 서버 ▶ http://${HOST}:${PORT}  (임베딩: ${embedMode()})`);
  // 시작 시 데이터 안전망 — 자동 백업(PRD 05 §4)
  backupOnce({ tag: 'startup' })
    .then(r => {
      console.log(`[backup] 스냅샷 저장: ${r.dest} (보관 ${r.total}개)`);
      try { const n = applyConfidenceDecay(db); if (n > 0) console.log(`[decay] 신뢰도 감쇠 적용: ${n}개`); }
      catch (e) { console.error('[decay] 실패(무시):', e?.message); }
    })
    .catch(e => console.error('[backup] 실패(무시):', e?.message));
});
