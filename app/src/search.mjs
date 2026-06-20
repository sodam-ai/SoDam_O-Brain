// 하이브리드 검색 — FTS5 키워드(한국어 접두 보정) + sqlite-vec 의미 + RRF 융합.
import { embed, toBlob } from './embed.mjs';

// 의미(벡터) 관련도 문턱 — 이보다 먼 결과는 버린다. 기억이 적을 때 KNN이 '전부'를
// 반환해 검색이 안 먹히던 버그 차단(실측: 진짜 일치≤0.83, 무관≥0.99, 오타≥1.23).
const VEC_GATE = Number(process.env.OBRAIN_VEC_GATE || 0.92);

// 한국어 보정(스파이크 검증): 각 토큰에 접두 * 부착 → '포트'가 '포트는'을 잡음.
function ftsQuery(q) {
  return String(q).trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/["*()]/g, '') + '*').filter(t => t.length > 1).join(' OR ');
}

export async function search(db, query, k = 10) {
  // 키워드 (FTS5)
  let kw = [];
  const fq = ftsQuery(query);
  if (fq) {
    try {
      kw = db.prepare(
        `SELECT m.id FROM memory_fts f JOIN memory m ON m.id=f.rowid
         WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?`
      ).all(fq, k);
    } catch { kw = []; }
  }
  // 의미 (sqlite-vec KNN) — LIMIT은 내부 정수라 리터럴 보간(주입 아님)
  let vec = [];
  try {
    const qv = toBlob(await embed(query));
    vec = db.prepare(
      `SELECT rowid AS id, distance FROM memory_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ${Number(k)}`
    ).all(qv).filter(r => r.distance <= VEC_GATE); // 관련도 문턱 적용(먼 결과 제외)
  } catch { vec = []; }

  // RRF (Reciprocal Rank Fusion, agentmemory 방식)
  const C = 60;
  const score = new Map();
  kw.forEach((r, i) => score.set(r.id, (score.get(r.id) || 0) + 1 / (C + i + 1)));
  vec.forEach((r, i) => score.set(r.id, (score.get(r.id) || 0) + 1 / (C + i + 1)));

  const ids = [...score.keys()];
  if (!ids.length) return [];
  const rows = db.prepare(
    `SELECT id, content, type, importance, confidence, source, created_at
     FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`
  ).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => ({ ...byId.get(id), _score: score.get(id) }))
            .sort((a, b) => b._score - a._score).slice(0, k);
}
