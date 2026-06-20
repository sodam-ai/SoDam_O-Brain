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

export function listMemories(db, limit = 50) {
  return db.prepare(
    `SELECT id, content, type, importance, confidence, source, category, created_at
     FROM memory ORDER BY id DESC LIMIT ?`
  ).all(limit);
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
