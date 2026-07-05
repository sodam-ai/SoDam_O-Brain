// 저장 파이프라인 — 시크릿 제거 → 임베딩 → SQLite(본체+FTS+벡터).
import { redact } from './redact.mjs';
import { embed, toBlob } from './embed.mjs';
import { classify } from './classify.mjs';

export async function addMemory(db, { content, type = '지식', importance = 3, source = 'ai', confidence = 0.6, project = null, category = null, scope = 'global', session_id = null }) {
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

const MEM_COLS = 'id, content, type, importance, confidence, source, project, category, access_count, created_at';
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
  let relCount = 0, orphans = total, hubs = [], topAccessed = [];
  try {
    relCount = get('SELECT COUNT(*) n FROM relation').n;
    orphans = get('SELECT COUNT(*) n FROM memory WHERE id NOT IN (SELECT from_id FROM relation UNION SELECT to_id FROM relation)').n;
    hubs = rows(`SELECT m.id, m.content, m.type, COUNT(*) d
      FROM (SELECT from_id id FROM relation UNION ALL SELECT to_id id FROM relation) r
      JOIN memory m ON m.id = r.id GROUP BY m.id ORDER BY d DESC LIMIT 3`);
  } catch {}
  topAccessed = rows('SELECT id, content, type, access_count FROM memory WHERE access_count > 0 ORDER BY access_count DESC LIMIT 3');
  return { total, recent7, lowConf, byType, byCategory, byProject, relCount, orphans, hubs, topAccessed };
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
