// 하이브리드 검색 — FTS5 키워드(한국어 접두 보정) + sqlite-vec 의미 + RRF 융합.
import { embed, toBlob } from './embed.mjs';

// 의미(벡터) 관련도 문턱 — 이보다 먼 결과는 버린다. 기억이 적을 때 KNN이 '전부'를
// 반환해 검색이 안 먹히던 버그 차단(실측: 진짜 일치≤0.83, 무관≥0.99, 오타≥1.23).
const VEC_GATE = Number(process.env.OBRAIN_VEC_GATE || 0.92);

// 한국어 보정(스파이크 검증): 각 토큰에 접두 * 부착 → '포트'가 '포트는'을 잡음.
// 토큰은 따옴표로 감싸 FTS5에 "글자 그대로" 넘긴다(2026-10-21 독립 검토 재현). 따옴표 없이 보내면 `.` `-` `+` `:` `/` `#` `%` 같은 기호나 AND/OR/NOT가
// 들어간 흔한 개발 검색어(node.js, C++, e-mail, 7740/tcp)가 FTS5 문법 오류가 되고, 그 오류가 search()의 catch에서 삼켜져 키워드 검색이 조용히 통째로 사라졌다.
// 접두 `*`는 따옴표 바깥에 붙인다("포트"* → '포트는'도 잡음). 글자·숫자가 하나도 없는 토큰(".", "--")은 버린다. 따옴표(")만 지우면 어떤 입력도 문법에 맞는다.
export function ftsQuery(q) {
  return String(q).trim().split(/\s+/).filter(Boolean)
    .map(t => t.replace(/[\u0000-\u001f"]/g, '')).filter(t => /[\p{L}\p{N}]/u.test(t))
    .map(t => `"${t}"*`).join(' OR ');
}

// includeSuperseded: 번복(대체)된 기억도 포함할지 — 기본 false(PRD 07 §5 "유효성: valid_until이 지난 기억은 기본 제외, 시간여행 요청 시 포함").
export async function search(db, query, k = 10, projectFilter = null, { includeSuperseded = false } = {}) {
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
  // 의미 쪽이 실패하면(모델 로드 실패·확장 오류 등) 키워드 결과만 돌려주되 degraded로 호출자에게 알린다(PRD 05 §3 — 조용한 우회 금지).
  let vec = [], degraded = false;
  try {
    const qv = toBlob(await embed(query));
    vec = db.prepare(
      `SELECT rowid AS id, distance FROM memory_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ${Number(fetchK)}`
    ).all(qv).filter(r => r.distance <= VEC_GATE); // 관련도 문턱 적용(먼 결과 제외)
  } catch { vec = []; degraded = true; }

  // RRF (Reciprocal Rank Fusion, agentmemory 방식)
  const C = 60;
  const score = new Map();
  kw.forEach((r, i) => score.set(r.id, (score.get(r.id) || 0) + 1 / (C + i + 1)));
  vec.forEach((r, i) => score.set(r.id, (score.get(r.id) || 0) + 1 / (C + i + 1)));

  const ids = [...score.keys()];
  if (!ids.length) { const none = []; none.degraded = degraded; return none; }
  const rows = db.prepare(
    `SELECT id, content, type, importance, confidence, source, project, category, scope, created_at, valid_until, invalidated_by
     FROM memory WHERE id IN (${ids.map(() => '?').join(',')})`
  ).all(...ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  let out = ids.map(id => ({ ...byId.get(id), _score: score.get(id) }));   // _score = 순수 RRF 관련도(보존)
  // 번복(대체)된 기억은 기본 제외 — 옛 결정이 최신 결정과 나란히 "정답"처럼 나오지 않게(타임라인·get_timeline·시간여행은 별도 경로라 그대로 보임).
  if (!includeSuperseded) {
    const today = new Date().toISOString().slice(0, 10); // SQLite date('now')와 같은 UTC 날짜
    out = out.filter(m => m.invalidated_by == null && (!m.valid_until || m.valid_until > today));
  }
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
    // 관련도 최소 보장선(2026-09-01 실행테스트로 재현·확정) — RRF 원점수가 다른(=관련도가
    // 진짜로 다른) 후보끼리는 품질 보너스로 순서를 못 뒤집게 막는다. min-max 정규화가 RRF의
    // 원래 좁은 점수차를 [0,1] 전체로 늘려 펴는 바람에, 거의 무관한 후보가 근소한 relevance
    // 우위(정규화 후 6%p)를 중요도·신뢰도 보너스(최대 20%p)로 뒤집어 정확 일치 결과보다 위로
    // 올라가는 걸 재현 확인(CHECKPOINT M62) — 위 주석 "분명히 더 관련 있는 결과는 안 뒤집힘"
    // 의도를 실제로 지키려면 원점수 동률일 때만 품질로 정하는 게 맞음.
    out.sort((a, b) => {
      if (Math.abs(a._score - b._score) > 1e-9) return b._score - a._score; // 원점수 다르면 관련도 그대로
      return b._final - a._final;                                           // 원점수 동률일 때만 품질로 결정
    });
  }
  const sliced = out.slice(0, k);
  sliced.total = out.length; // 잘려나간 개수를 호출자가 알 수 있게(배열이라 JSON.stringify·기존 소비자는 영향 없음)
  sliced.degraded = degraded; // true면 의미검색 없이 키워드 결과만(같은 방식으로 호출자에게 전달)
  return sliced;
}
