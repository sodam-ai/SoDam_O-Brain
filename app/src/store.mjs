// 저장 파이프라인 — 시크릿 제거 → 임베딩 → SQLite(본체+FTS+벡터).
import { redact } from './redact.mjs';
import { embed, toBlob } from './embed.mjs';

export async function addMemory(db, { content, type = '지식', importance = 3, source = 'ai', confidence = 0.6 }) {
  const { clean, hits } = redact(content);          // 1) 보안 (저장 전 필수)
  const vec = toBlob(await embed(clean));           // 2) 임베딩
  const tx = db.transaction(() => {                 // 3) 원자적 저장
    const id = Number(db.prepare(
      `INSERT INTO memory(content, type, importance, confidence, source) VALUES (?,?,?,?,?)`
    ).run(clean, type, importance, confidence, source).lastInsertRowid);
    db.prepare(`INSERT INTO memory_fts(rowid, content) VALUES (?, ?)`).run(id, clean);
    db.prepare(`INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)`).run(BigInt(id), vec);
    return id;
  });
  return { id: tx(), redactedHits: hits };
}

export function listMemories(db, limit = 50) {
  return db.prepare(
    `SELECT id, content, type, importance, confidence, source, created_at
     FROM memory ORDER BY id DESC LIMIT ?`
  ).all(limit);
}
