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

export async function search(db, query, k = 10, projectFilter = null) {
  // 프로젝트 우선 시 후보를 넉넉히 뽑아 필터 후에도 충분하게(미지정이면 기존과 동일)
  const fetchK = projectFilter ? Math.max(k * 4, 40) : k;
  // 키워드 (FTS5)
  let kw = [];
  const fq = ftsQuery(query);
  if (fq) {
    try {
      kw = db.prepare(
        `SELECT m.id FROM memory_fts f JOIN memory m ON m.id=f.rowid
         WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?`
      ).all(fq, fetchK);
    } catch { kw = []; }
  }
  // 의미 (sqlite-vec KNN) — LIMIT은 내부 정수라 리터럴 보간(주입 아님)
  let vec = [];
  try {
    const qv = toBlob(await embed(query));
    vec = db.prepare(
      `SELECT rowid AS id, distance FROM memory_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ${Number(fetchK)}`
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
    `SELECT id, content, type, importance, confidence, source, project, category, scope, created_at
     FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`
  ).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  let out = ids.map(id => ({ ...byId.get(id), _score: score.get(id) }));   // _score = 순수 RRF 관련도(보존)
  // 현재 프로젝트 우선 — 지정 시 현재 프로젝트 + 전역(NULL)만 남겨 타 프로젝트에 묻히지 않게(재랭크 전에 적용)
  if (projectFilter) out = out.filter(m => m.project === projectFilter || m.project == null);

  // 재랭크(PRD 07 §5): 관련도×0.7 + 중요도×0.15 + 최신성×0.1 + 신뢰도×0.05.
  // 목적 — 사람이 검증한 기억(conf 1.0)이 자동캡처 노이즈(conf 0.5)와 '비슷한 관련도'일 때 위로.
  // RRF 점수는 랭크 기반이라 스케일이 압축돼 있어, 후보군 내 min-max 정규화로 [0,1] 관련도 축을 준다.
  // 관련도에 0.7을 실어 '분명히 더 관련 있는 결과'는 품질(신뢰도·중요도)로 뒤집히지 않게 지배력 유지.
  if (out.length > 1) {
    const now = Date.now();
    let lo = Infinity, hi = -Infinity;
    for (const m of out) { if (m._score < lo) lo = m._score; if (m._score > hi) hi = m._score; }
    const range = hi - lo;
    for (const m of out) {
      const rel = range > 0 ? (m._score - lo) / range : 1;                                  // 관련도 0~1(동점이면 1)
      const conf = m.confidence != null ? Math.max(0, Math.min(1, m.confidence)) : 0.6;
      const imp = Math.max(0, Math.min(5, m.importance || 0)) / 5;
      const t = m.created_at ? new Date(String(m.created_at).replace(' ', 'T')).getTime() : 0;
      const days = t ? (now - t) / 86400000 : 999;
      const rec = Math.max(0, 1 - Math.min(days / 60, 1));                                    // 최신성(최근 60일)
      m._final = 0.7 * rel + 0.15 * imp + 0.10 * rec + 0.05 * conf;
    }
    out.sort((a, b) => b._final - a._final);
  }
  const sliced = out.slice(0, k);
  sliced.total = out.length; // 잘려나간 개수를 호출자가 알 수 있게(배열이라 JSON.stringify·기존 소비자는 영향 없음)
  return sliced;
}
