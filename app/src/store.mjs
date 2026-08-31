// 저장 파이프라인 — 시크릿 제거 → 임베딩 → SQLite(본체+FTS+벡터).
import { redact } from './redact.mjs';
import { embed, toBlob } from './embed.mjs';
import { classify } from './classify.mjs';

export async function addMemory(db, { content, type = '지식', importance = 3, source = 'ai', confidence = 0.6, project = null, category = null, scope = 'global', session_id = null }) {
  // 호출부(HTTP/MCP)가 이미 클램프하지만, 함수 자체도 방어(향후 새 호출부의 클램프 누락 대비 — 07-11 비대칭 결함과 같은 유형 재발 방지).
  importance = Math.min(5, Math.max(1, Number.isFinite(Number(importance)) ? Math.round(Number(importance)) : 3));
  confidence = Math.min(1, Math.max(0, Number.isFinite(Number(confidence)) ? Number(confidence) : 0.6));
  const { clean, hits } = redact(content);          // 1) 보안 (저장 전 필수)
  // 1.2) 중복 방지 — 같은 프로젝트에 '내용(redact 후)이 정확히 같은' 기억이 있으면 재저장 안 함.
  // 의미유사도가 아니라 '정확 일치'만 검사 → 서로 다른 결정은 절대 막지 않음(silent failure 방지). 스킵은 호출자에 가시화.
  const dup = db.prepare(
    "SELECT id FROM memory WHERE TRIM(content) = TRIM(?) AND IFNULL(project,'') = IFNULL(?,'') LIMIT 1"
  ).get(clean, project);
  if (dup) return { id: dup.id, redactedHits: hits, skipped: true };
  const cat = category || classify(clean);          // 1.5) 분류(온톨로지 v1) — 미지정 시 규칙 자동
  const vec = toBlob(await embed(clean));           // 2) 임베딩
  const sid = session_id ? Number(session_id) : null;
  const today = new Date().toISOString().slice(0, 10); // valid_from = 저장 날짜(YYYY-MM-DD)
  const tx = db.transaction(() => {                 // 3) 원자적 저장
    const id = Number(db.prepare(
      `INSERT INTO memory(content, type, importance, confidence, source, project, category, scope, session_id, valid_from) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(clean, type, importance, confidence, source, project, cat, scope || 'global', sid, today).lastInsertRowid);
    db.prepare(`INSERT INTO memory_fts(rowid, content) VALUES (?, ?)`).run(id, clean);
    db.prepare(`INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)`).run(BigInt(id), vec);
    return id;
  });
  return { id: tx(), redactedHits: hits };
}

const MEM_COLS = 'id, content, type, importance, confidence, source, project, category, scope, access_count, created_at, session_id';
export function listMemories(db, limit = 100, offset = 0, scope = null, at = null) {
  const lim = Math.max(1, limit | 0), off = Math.max(0, offset | 0);
  const conds = [], params = [];
  if (scope) { conds.push('scope = ?'); params.push(scope); }
  if (at) {
    const d = String(at).slice(0, 10); // YYYY-MM-DD
    conds.push('(valid_from IS NULL OR valid_from <= ?)');
    conds.push('(valid_until IS NULL OR valid_until > ?)');
    params.push(d, d);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  return db.prepare(
    `SELECT ${MEM_COLS} FROM memory ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, lim, off);
}
export function countMemories(db) { return db.prepare('SELECT COUNT(*) n FROM memory').get().n; }
export function getMemory(db, id) {
  return db.prepare(`SELECT ${MEM_COLS} FROM memory WHERE id = ?`).get(Number(id));
}

// 관계 연결용 '추천 대상' — 기존 임베딩(sqlite-vec) 유사도로 가장 비슷한 기억 K개.
// 자기 자신·이미 연결된 기억은 제외. 관계 '종류'는 추정하지 않음(사람이 선택 — 오관계 방지).
export function getSimilar(db, id, k = 6) {
  const mid = Number(id);
  if (!Number.isInteger(mid) || mid <= 0) return [];
  let knn = [];
  try {
    knn = db.prepare(
      `SELECT rowid AS id, distance FROM memory_vec
       WHERE embedding MATCH (SELECT embedding FROM memory_vec WHERE rowid = ?)
       ORDER BY distance LIMIT ?`
    ).all(mid, (k | 0) + 8);
  } catch { return []; } // 임베딩 없거나 vec 미가용 — 빈 추천(폼은 정상 동작)
  const skip = new Set([mid]);
  try {
    for (const r of db.prepare('SELECT from_id, to_id FROM relation WHERE from_id = ? OR to_id = ?').all(mid, mid))
      skip.add(r.from_id === mid ? r.to_id : r.from_id);
  } catch {}
  const get = db.prepare('SELECT id, content, type, category FROM memory WHERE id = ?');
  const out = [];
  for (const r of knn) {
    if (skip.has(r.id)) continue;
    const m = get.get(r.id); if (!m) continue;
    out.push({ id: m.id, content: m.content, type: m.type, category: m.category, distance: r.distance });
    if (out.length >= k) break;
  }
  return out;
}

// 중복 후보 탐지(읽기 전용, 실행 없음) — PRD "코사인 0.92 병합"을 그대로 쓰지 않음:
// search.mjs 실측 주석 기준 sqlite-vec의 distance는 코사인 유사도가 아니라 "낮을수록 유사"한 원시값이고
// (진짜 일치≤0.83·무관≥0.99), 0.92는 "검색에 관련 있음" 수준의 느슨한 문턱이라 중복 판정엔 너무 헐겁다.
// 오판(전혀 다른 기억을 중복으로 제안) 위험을 낮추려 그보다 훨씬 엄격한 값을 보수적으로 채택.
// 그래도 이 함수는 "후보 제안"만 한다 — 실제 삭제·병합은 사람이 내용을 직접 보고 확인해야만 실행(자동 실행 없음, PRD 준수).
const DUP_DISTANCE = 0.6;
// 완전일치(문자 그대로 같은 content) 중복 — 벡터 계산 없이 GROUP BY 한 번으로 찾아 findDuplicateCandidates의
// 1500건 성능가드와 무관하게 항상 가벼움(2093건 실DB 실측: 즉시 응답). 큰 DB에서 "정리 기능 자체가 없음"
// 대신, 유사도 판단 없이 확실한 완전일치만이라도 사람이 정리할 수 있게 함. 반환 모양은 findDuplicateCandidates와
// 동일(pairs[].a/b/distance) — 기존 UI(개요 탭 중복 후보 카드·merge 모달)를 그대로 재사용하기 위함.
export function findExactDuplicates(db, limit, total) {
  const rows = db.prepare(`
    SELECT m.id b_id, g.min_id a_id
    FROM memory m
    JOIN (SELECT content, MIN(id) min_id, COUNT(*) c FROM memory GROUP BY content HAVING c > 1) g
      ON m.content = g.content AND m.id != g.min_id
    LIMIT ?
  `).all(limit);
  if (!rows.length) return { pairs: [], skipped: false, total, threshold: 0, exact: true };
  const ids = [...new Set(rows.flatMap(r => [r.a_id, r.b_id]))];
  const mems = db.prepare(
    `SELECT id, content, type, importance, created_at, source, confidence, project, category, scope FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`
  ).all(...ids);
  const byId = new Map(mems.map(m => [m.id, m]));
  const pairs = rows.map(r => ({ a: byId.get(r.a_id), b: byId.get(r.b_id), distance: 0 }))
    .filter(p => p.a && p.b);
  return { pairs, skipped: false, total, threshold: 0, exact: true };
}

export function findDuplicateCandidates(db, { limit = 30 } = {}) {
  const total = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  // graph.mjs와 동일한 성능가드 철학 — 노드당 개별 벡터쿼리라 DB가 크면 느려짐(2026-07-11 실측 교훈 재사용).
  // 단 완전일치는 벡터 없이 가벼우므로 이 규모에서도 그 경로만 대체 실행(위 findExactDuplicates).
  if (total > 1500) return findExactDuplicates(db, limit, total);
  const mems = db.prepare('SELECT id, content, type, importance, created_at FROM memory ORDER BY id').all();
  const byId = new Map(mems.map(m => [m.id, m]));
  const knn = db.prepare(
    `SELECT rowid AS id, distance FROM memory_vec
     WHERE embedding MATCH (SELECT embedding FROM memory_vec WHERE rowid = ?) ORDER BY distance LIMIT 4`
  );
  const seen = new Set();
  const pairs = [];
  try {
    for (const m of mems) {
      for (const r of knn.all(m.id)) {
        if (r.id === m.id || r.distance > DUP_DISTANCE) continue;
        const key = m.id < r.id ? `${m.id}-${r.id}` : `${r.id}-${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const other = byId.get(r.id);
        if (!other) continue;
        pairs.push({
          a: { id: m.id, content: m.content, type: m.type, importance: m.importance, created_at: m.created_at },
          b: { id: other.id, content: other.content, type: other.type, importance: other.importance, created_at: other.created_at },
          distance: r.distance,
        });
      }
    }
  } catch { return { pairs: [], skipped: true, total, reason: '벡터 검색 불가' }; }
  pairs.sort((x, y) => x.distance - y.distance);
  return { pairs: pairs.slice(0, limit), skipped: false, total, threshold: DUP_DISTANCE };
}

// 연결된 소집단(컴포넌트) 감지 — PRD 05 §6 "그래프 분석 알고리즘"을 Cytoscape 없이 축소 구현.
// 확정된 관계(relation)만 기준(유사도선 제외 — 자동연결이라 항상 하나로 뭉쳐 보여 "떨어짐" 자체가 무의미해짐).
// 가장 큰 덩어리(메인 그래프)는 제외하고, 그와 분리된 나머지 소집단만 반환 — 해석("중요/무의미")은 하지 않고 구조적 사실만 전달.
export function findIsolatedClusters(db, { maxClusters = 5, maxMembers = 6 } = {}) {
  const relations = db.prepare('SELECT from_id, to_id FROM relation').all();
  if (!relations.length) return [];
  const parent = new Map();
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const r of relations) {
    if (!parent.has(r.from_id)) parent.set(r.from_id, r.from_id);
    if (!parent.has(r.to_id)) parent.set(r.to_id, r.to_id);
    union(r.from_id, r.to_id);
  }
  const groups = new Map();
  for (const id of parent.keys()) { const root = find(id); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(id); }
  const comps = [...groups.values()].sort((a, b) => b.length - a.length);
  if (comps.length < 2) return []; // 컴포넌트가 1개뿐(전부 연결됨) → 보여줄 "떨어진" 소집단 없음
  const islands = comps.slice(1, 1 + maxClusters); // 가장 큰 덩어리(메인 그래프) 제외
  const ids = islands.flat().slice(0, maxClusters * maxMembers);
  if (!ids.length) return [];
  const rows = db.prepare(`SELECT id, content, type FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  return islands.map(members => ({
    size: members.length,
    members: members.slice(0, maxMembers).map(id => byId.get(id)).filter(Boolean)
  })).filter(c => c.members.length);
}

// 최단경로 찾기 — PRD 05 §6 "그래프 분석 알고리즘"의 남은 조각. relation 테이블만으로 BFS(방향 무시,
// 연결 여부만 봄 — findIsolatedClusters의 Union-Find와 같은 원칙). 새 의존성 없음.
export function findShortestPath(db, fromId, toId) {
  fromId = Number(fromId); toId = Number(toId);
  if (!Number.isFinite(fromId) || !Number.isFinite(toId)) return { found: false, path: [] };
  if (fromId === toId) {
    const row = db.prepare('SELECT id, content, type FROM memory WHERE id = ?').get(fromId);
    return row ? { found: true, path: [row] } : { found: false, path: [] };
  }
  // 프로젝트 전역 상한 관례(graph.mjs SIM_TOTAL_THRESHOLD 등)와 일관 — relation이 비정상적으로 많으면
  // 무제한 로드 대신 명시적으로 생략(틀린 답 대신 "생략됨"만 반환 — 진화추적 skipped 패턴과 동일 원칙).
  const relCount = db.prepare('SELECT COUNT(*) n FROM relation').get().n;
  if (relCount > 5000) return { found: false, path: [], skipped: true };
  const relations = db.prepare('SELECT from_id, to_id FROM relation').all();
  if (!relations.length) return { found: false, path: [] };
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); };
  for (const r of relations) { link(r.from_id, r.to_id); link(r.to_id, r.from_id); }
  if (!adj.has(fromId) || !adj.has(toId)) return { found: false, path: [] };
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) break;
    for (const next of adj.get(cur) || []) {
      if (!prev.has(next)) { prev.set(next, cur); queue.push(next); }
    }
  }
  if (!prev.has(toId)) return { found: false, path: [] };
  const ids = [];
  for (let n = toId; n !== null; n = prev.get(n)) ids.unshift(n);
  const rows = db.prepare(`SELECT id, content, type FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  const path = ids.map(id => byId.get(id)).filter(Boolean);
  return { found: path.length === ids.length, path };
}

// 대시보드 개요용 집계 — DB 전체 기준(SQL COUNT/GROUP BY)이라 기억 수가 수천이어도 정확·빠름.
export function getStats(db) {
  const get = (sql, ...a) => db.prepare(sql).get(...a);
  const rows = (sql, ...a) => db.prepare(sql).all(...a);
  const total = get('SELECT COUNT(*) n FROM memory').n;
  const recent7 = get("SELECT COUNT(*) n FROM memory WHERE created_at >= datetime('now','-7 days')").n;
  const lowConf = get('SELECT COUNT(*) n FROM memory WHERE confidence IS NOT NULL AND confidence < 0.5').n;
  const byType = {}; for (const r of rows('SELECT type, COUNT(*) c FROM memory GROUP BY type')) byType[r.type || '기타'] = r.c;
  const byCategory = {}; for (const r of rows("SELECT COALESCE(category,'기타') cat, COUNT(*) c FROM memory GROUP BY cat")) byCategory[r.cat] = r.c;
  const byProject = rows("SELECT project, COUNT(*) c FROM memory WHERE project IS NOT NULL AND project <> '' GROUP BY project ORDER BY c DESC");
  let relCount = 0, orphans = total, hubs = [], topAccessed = [], islands = [];
  try {
    relCount = get('SELECT COUNT(*) n FROM relation').n;
    orphans = get('SELECT COUNT(*) n FROM memory WHERE id NOT IN (SELECT from_id FROM relation UNION SELECT to_id FROM relation)').n;
    hubs = rows(`SELECT m.id, m.content, m.type, COUNT(*) d
      FROM (SELECT from_id id FROM relation UNION ALL SELECT to_id id FROM relation) r
      JOIN memory m ON m.id = r.id GROUP BY m.id ORDER BY d DESC LIMIT 3`);
    islands = findIsolatedClusters(db);
  } catch {}
  topAccessed = rows('SELECT id, content, type, access_count FROM memory WHERE access_count > 0 ORDER BY access_count DESC LIMIT 3');
  return { total, recent7, lowConf, byType, byCategory, byProject, relCount, orphans, hubs, topAccessed, islands };
}

const MEM_TYPES = ['결정', '제약', '선호', '패턴', '지식'];
// 기억 편집(사용자) — 내용 변경 시 재redact(보안 필수)+재embed+FTS/벡터 동기화. 편집=사람 검증이므로 source=user·confidence=1.0.
export async function updateMemory(db, id, { content, type, importance } = {}) {
  const mid = Number(id);
  if (!Number.isInteger(mid) || mid <= 0) throw new Error('잘못된 id');
  if (!db.prepare('SELECT 1 FROM memory WHERE id = ?').get(mid)) throw new Error('없는 기억');

  const sets = [], vals = [];
  let cleanContent = null, redactedHits = 0;
  if (content != null) {
    const { clean, hits } = redact(String(content));   // 보안: 저장 전 필수
    if (!clean.trim()) throw new Error('내용이 비어 있어요');
    cleanContent = clean; redactedHits = hits;
    sets.push('content = ?'); vals.push(clean);
  }
  if (type != null) {
    if (!MEM_TYPES.includes(type)) throw new Error('잘못된 유형');
    sets.push('type = ?'); vals.push(type);
  }
  if (importance != null) {
    const imp = Number(importance);
    if (!Number.isInteger(imp) || imp < 1 || imp > 5) throw new Error('중요도는 1~5 사이');
    sets.push('importance = ?'); vals.push(imp);
  }
  if (!sets.length) throw new Error('변경할 내용이 없어요');
  sets.push("source = 'user'", 'confidence = 1.0');   // 사람이 확인·수정함 → 검증됨 표시

  const vec = cleanContent != null ? toBlob(await embed(cleanContent)) : null; // 내용 변경 시에만 재임베딩
  const tx = db.transaction(() => {
    db.prepare(`UPDATE memory SET ${sets.join(', ')} WHERE id = ?`).run(...vals, mid);
    if (cleanContent != null) {                         // 키워드(FTS)+벡터 동기화 — addMemory와 동일 패턴
      try { db.prepare('DELETE FROM memory_fts WHERE rowid = ?').run(mid); } catch {}
      db.prepare('INSERT INTO memory_fts(rowid, content) VALUES (?, ?)').run(mid, cleanContent);
      try { db.prepare('DELETE FROM memory_vec WHERE rowid = ?').run(BigInt(mid)); } catch {}
      db.prepare('INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)').run(BigInt(mid), vec);
    }
  });
  tx();
  return { ok: true, redactedHits };
}

// 조회 1회 기록 — 자주 본 기억(글로우) 신호. PRD 02 access_count·§8.1.
export function touchMemory(db, id) {
  return db.prepare(
    `UPDATE memory SET access_count = COALESCE(access_count,0)+1, last_accessed_at = datetime('now') WHERE id = ?`
  ).run(Number(id)).changes;
}

// 기억 1건 삭제 — 본체+FTS+벡터+관계를 원자적으로 제거(사용자 요청 삭제. 서버시작 백업이 안전망).
export function deleteMemory(db, id) {
  const tx = db.transaction(() => {
    const info = db.prepare(`DELETE FROM memory WHERE id = ?`).run(id);
    try { db.prepare(`DELETE FROM memory_fts WHERE rowid = ?`).run(id); } catch {}
    try { db.prepare(`DELETE FROM memory_vec WHERE rowid = ?`).run(BigInt(id)); } catch {}
    try { db.prepare(`DELETE FROM relation WHERE from_id = ? OR to_id = ?`).run(id, id); } catch {} // 고아 관계 정리
    return info.changes;
  });
  return tx();
}

// ── 관계(사용자 수동 연결) ── 자동추론 X. type ∈ SUPERSEDES/SUPPORTS/INFLUENCES/CONTRADICTS
const REL_TYPES = ['SUPERSEDES', 'SUPPORTS', 'INFLUENCES', 'CONTRADICTS'];
export function addRelation(db, { from_id, to_id, type }) {
  const a = Number(from_id), b = Number(to_id);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) throw new Error('잘못된 대상');
  if (!REL_TYPES.includes(type)) throw new Error('잘못된 관계 유형');
  // 두 기억이 실제로 존재하는지 확인(고아 관계 방지)
  const ok = db.prepare('SELECT COUNT(*) n FROM memory WHERE id IN (?, ?)').get(a, b).n;
  if (ok !== 2) throw new Error('없는 기억');
  const r = db.prepare(
    `INSERT OR IGNORE INTO relation(from_id, to_id, type) VALUES (?,?,?)`
  ).run(a, b, type);
  // SUPERSEDES: 대체된 기억(b)을 오늘 날짜로 무효화 — 시간여행 필터와 연동
  if (type === 'SUPERSEDES' && r.changes > 0) {
    db.prepare("UPDATE memory SET valid_until = date('now'), invalidated_by = ? WHERE id = ?").run(a, b);
  }
  return { id: Number(r.lastInsertRowid), inserted: r.changes };
}
export function listRelations(db) {
  return db.prepare('SELECT id, from_id, to_id, type, created_at FROM relation ORDER BY id DESC').all();
}
export function deleteRelation(db, id) {
  return db.prepare('DELETE FROM relation WHERE id = ?').run(Number(id)).changes;
}

// AI가 관계를 따라가게 — 특정 기억의 직접 연결(1-hop) 이웃 + 관계 유형·방향. 읽기 전용.
export function getRelated(db, id) {
  const mid = Number(id);
  if (!Number.isInteger(mid) || mid <= 0) return [];
  try {
    return db.prepare(`
      SELECT r.type AS relation,
             CASE WHEN r.from_id = ? THEN 'out' ELSE 'in' END AS direction,
             m.id, m.content, m.type, m.importance
      FROM relation r
      JOIN memory m ON m.id = (CASE WHEN r.from_id = ? THEN r.to_id ELSE r.from_id END)
      WHERE r.from_id = ? OR r.to_id = ?
      ORDER BY m.importance DESC, m.id DESC`).all(mid, mid, mid, mid);
  } catch { return []; }
}

// 결정의 변천(타임라인) — 키워드 관련 기억을 시간순(오래된→최신) + 대체/충돌 관계 표기. 읽기 전용.
export function getTimeline(db, { query = '', limit = 20 } = {}) {
  const lim = Math.min(100, Math.max(1, limit | 0));
  const q = String(query || '').trim();
  let mems;
  if (q) {
    const like = '%' + q.slice(0, 100).replace(/[%_\\]/g, '') + '%';
    mems = db.prepare(`SELECT id, content, type, importance, created_at FROM memory WHERE content LIKE ? ORDER BY created_at ASC, id ASC LIMIT ?`).all(like, lim);
  } else {
    mems = db.prepare(`SELECT id, content, type, importance, created_at FROM memory ORDER BY created_at ASC, id ASC LIMIT ?`).all(lim);
  }
  const ids = new Set(mems.map(m => m.id));
  let rels = [];
  try { rels = db.prepare(`SELECT from_id, to_id, type FROM relation WHERE type IN ('SUPERSEDES','CONTRADICTS')`).all(); } catch {}
  const notes = {};
  for (const r of rels) if (ids.has(r.from_id)) (notes[r.from_id] ||= []).push({ type: r.type, to: r.to_id });
  return mems.map(m => ({ ...m, evolves: notes[m.id] || [] }));
}

// 카테고리별 기억 수 집계 — UI 필터 드롭다운·MCP list_categories 공용
export function listCategories(db) {
  return db.prepare(
    "SELECT COALESCE(category,'기타') AS cat, COUNT(*) AS c FROM memory GROUP BY cat ORDER BY c DESC"
  ).all();
}

// 신뢰도 감쇠(Memento 30일 반감기) — source='user' 또는 conf≥0.99는 건너뜀(사람이 확인한 기억 보호)
// 12시간 미만이면 실행 안 함(서버 재시작 폭풍 방지). app_settings.last_decay_at에 타임스탬프 저장.
export function applyConfidenceDecay(db) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'last_decay_at'").get();
  // 최초 1회 실행(row 없음) — 1970년부터 감쇠 안 한 것으로 계산하면 기존 기억이 전부 바닥까지
  // 떨어지는 실측 버그(2026-06-29 배포 시 06-20~21 기억이 즉시 0.1로 붕괴) 재발 방지.
  // 시각만 기록하고 이번 실행은 감쇠 건너뜀 — 다음 실행부터 정상적으로 짧은 구간만 감쇠.
  if (!row) {
    db.prepare("INSERT OR REPLACE INTO app_settings(key,value) VALUES('last_decay_at',?)").run(new Date().toISOString());
    return 0;
  }
  const lastMs = new Date(row.value).getTime();
  const nowMs = Date.now();
  const hoursSince = (nowMs - lastMs) / 3_600_000;
  if (hoursSince < 12) return 0; // 너무 잦은 실행 방지
  const daysSince = hoursSince / 24;
  const factor = Math.pow(0.5, daysSince / 30); // 30일 반감기
  const rows = db.prepare(
    "SELECT id, confidence FROM memory WHERE source != 'user' AND confidence IS NOT NULL AND confidence < 0.99"
  ).all();
  if (!rows.length) return 0;
  let updated = 0;
  const upd = db.prepare('UPDATE memory SET confidence = ? WHERE id = ?');
  db.transaction(() => {
    for (const m of rows) {
      const newConf = Math.max(0.1, (m.confidence ?? 0.6) * factor);
      if (Math.abs(newConf - (m.confidence ?? 0.6)) > 0.001) { upd.run(newConf, m.id); updated++; }
    }
    db.prepare("INSERT OR REPLACE INTO app_settings(key,value) VALUES('last_decay_at',?)").run(new Date().toISOString());
  })();
  return updated;
}
