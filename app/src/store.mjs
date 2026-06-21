// 저장 파이프라인 — 시크릿 제거 → 임베딩 → SQLite(본체+FTS+벡터).
import { redact } from './redact.mjs';
import { embed, toBlob } from './embed.mjs';
import { classify } from './classify.mjs';

export async function addMemory(db, { content, type = '지식', importance = 3, source = 'ai', confidence = 0.6, project = null, category = null }) {
  const { clean, hits } = redact(content);          // 1) 보안 (저장 전 필수)
  const cat = category || classify(clean);          // 1.5) 분류(온톨로지 v1) — 미지정 시 규칙 자동
  const vec = toBlob(await embed(clean));           // 2) 임베딩
  const tx = db.transaction(() => {                 // 3) 원자적 저장
    const id = Number(db.prepare(
      `INSERT INTO memory(content, type, importance, confidence, source, project, category) VALUES (?,?,?,?,?,?,?)`
    ).run(clean, type, importance, confidence, source, project, cat).lastInsertRowid);
    db.prepare(`INSERT INTO memory_fts(rowid, content) VALUES (?, ?)`).run(id, clean);
    db.prepare(`INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)`).run(BigInt(id), vec);
    return id;
  });
  return { id: tx(), redactedHits: hits };
}

const MEM_COLS = 'id, content, type, importance, confidence, source, project, category, access_count, created_at';
export function listMemories(db, limit = 100, offset = 0) {
  return db.prepare(
    `SELECT ${MEM_COLS} FROM memory ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(Math.max(1, limit | 0), Math.max(0, offset | 0));
}
export function countMemories(db) { return db.prepare('SELECT COUNT(*) n FROM memory').get().n; }
export function getMemory(db, id) {
  return db.prepare(`SELECT ${MEM_COLS} FROM memory WHERE id = ?`).get(Number(id));
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
  return { id: Number(r.lastInsertRowid), inserted: r.changes };
}
export function listRelations(db) {
  return db.prepare('SELECT id, from_id, to_id, type, created_at FROM relation ORDER BY id DESC').all();
}
export function deleteRelation(db, id) {
  return db.prepare('DELETE FROM relation WHERE id = ?').run(Number(id)).changes;
}
