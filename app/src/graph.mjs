// 그래프 데이터 — 노드(기억) + 엣지(이미 있는 임베딩으로 "비슷한 기억끼리" 자동 연결).
// 관계(relation) 표는 Phase 2에 채워지므로, 그 전엔 의미 유사도로 그래프를 만든다(실데이터).

export function buildGraph(db, { neighbors = 2, limit = 600 } = {}) {
  const total = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const cap = Math.max(1, (Number(limit) | 0) || 600); // 정수화(better-sqlite3 LIMIT은 정수만 허용)
  // 대량 대비: 중요도+최신 우선으로 상한(top-N). 더 보려면 필터·검색·로컬보기로 드릴다운(PRD §8.4).
  const mems = db.prepare(
    `SELECT id, content, type, importance, confidence, project, category, access_count, created_at
     FROM memory ORDER BY importance DESC, id DESC LIMIT ?`
  ).all(cap);
  const inSet = new Set(mems.map(m => m.id));
  const nodes = mems.map(m => ({ id: m.id, name: m.content, type: m.type, importance: m.importance || 1,
    confidence: m.confidence, project: m.project || null, category: m.category || '기타',
    access: m.access_count || 0, created_at: m.created_at, val: m.importance || 1 }));

  const linkSet = new Set();
  const links = [];
  const addLink = (a, b, dist) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ source: a, target: b, distance: dist ?? null });
  };

  // 1) 의미 유사도 기반 — 각 기억의 가장 가까운 이웃 연결(sqlite-vec 자기쿼리)
  // 성능가드(PRD §8.4 "무거우면 자동 단순화") — 노드마다 벡터쿼리 1회씩 실행하는 구조라 DB 전체 규모에 비례해 느려짐
  // (실측 2026-07-11: total=5000·limit=600→2.8초, limit=2000→9.8초 / 실사용 total=633·limit=600→0.58초).
  // 1500건을 넘으면 유사도 계산을 건너뛰고 아래 유형기반 연결로 자동 전환해 프리징을 막는다(가시화: simplified 플래그로 반환).
  const SIM_TOTAL_THRESHOLD = 1500;
  const simplified = total > SIM_TOTAL_THRESHOLD;
  let edgeMode = 'none';
  if (!simplified) {
    try {
      const knn = db.prepare(
        `SELECT rowid AS id, distance FROM memory_vec
         WHERE embedding MATCH (SELECT embedding FROM memory_vec WHERE rowid = ?)
         ORDER BY distance LIMIT ${Number(neighbors) + 1}`
      );
      for (const m of mems) {
        for (const r of knn.all(m.id)) if (r.id !== m.id && inSet.has(r.id)) { addLink(m.id, r.id, r.distance); edgeMode = 'similarity'; } // 상한 집합 안에서만 연결
      }
    } catch { edgeMode = 'none'; }
  }

  // 2) 폴백 — 같은 유형끼리 가볍게 연결
  if (edgeMode === 'none') {
    const byType = {};
    for (const m of mems) (byType[m.type] ||= []).push(m.id);
    for (const ids of Object.values(byType)) for (let i = 1; i < ids.length; i++) addLink(ids[i - 1], ids[i]);
    edgeMode = 'type';
  }

  // 사용자가 만든 '진짜 관계'를 유형선으로 추가 — 같은 쌍이면 유사도선을 대체(자동추론 X)
  let relations = [];
  try { relations = db.prepare('SELECT from_id, to_id, type FROM relation').all(); } catch {}
  const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const relPairs = new Set(relations.map(r => pairKey(r.from_id, r.to_id)));
  const nodeIds = new Set(nodes.map(n => n.id));
  // 유사도선: 관계가 이미 있는 쌍은 빼고, 나머지는 rel:null(흐린 배경선)로 태그
  const merged = links
    .filter(l => !relPairs.has(pairKey(l.source, l.target)))
    .map(l => ({ ...l, rel: null }));
  for (const r of relations) {
    if (!nodeIds.has(r.from_id) || !nodeIds.has(r.to_id)) continue; // 고아 관계 무시
    merged.push({ source: r.from_id, target: r.to_id, rel: r.type, directed: true });
  }

  // 노드 크기 = 중요도 + 연결수(허브일수록 큼) — PRD §8
  const deg = {};
  for (const l of merged) { deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; }
  for (const n of nodes) n.val = (n.val || 1) + (deg[n.id] || 0) * 0.6;
  // 고립 기억: 사용자 관계(relation 테이블)에 등장하지 않는 노드 — UI orphanView·고립 강조 연동
  const relNodeIds = new Set();
  for (const r of relations) { relNodeIds.add(r.from_id); relNodeIds.add(r.to_id); }
  for (const n of nodes) n.isOrphan = !relNodeIds.has(n.id);

  return { nodes, links: merged, edgeMode, relCount: relations.length, total, shown: nodes.length, simplified };
}
