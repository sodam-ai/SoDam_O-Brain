// 그래프 데이터 — 노드(기억) + 엣지(이미 있는 임베딩으로 "비슷한 기억끼리" 자동 연결).
// 관계(relation) 표는 Phase 2에 채워지므로, 그 전엔 의미 유사도로 그래프를 만든다(실데이터).

export function buildGraph(db, { neighbors = 2 } = {}) {
  const mems = db.prepare('SELECT id, content, type, importance FROM memory').all();
  const nodes = mems.map(m => ({ id: m.id, name: m.content, type: m.type, val: m.importance || 1 }));

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
  let edgeMode = 'none';
  try {
    const knn = db.prepare(
      `SELECT rowid AS id, distance FROM memory_vec
       WHERE embedding MATCH (SELECT embedding FROM memory_vec WHERE rowid = ?)
       ORDER BY distance LIMIT ${Number(neighbors) + 1}`
    );
    for (const m of mems) {
      for (const r of knn.all(m.id)) if (r.id !== m.id) { addLink(m.id, r.id, r.distance); edgeMode = 'similarity'; }
    }
  } catch { edgeMode = 'none'; }

  // 2) 폴백 — 같은 유형끼리 가볍게 연결
  if (edgeMode === 'none') {
    const byType = {};
    for (const m of mems) (byType[m.type] ||= []).push(m.id);
    for (const ids of Object.values(byType)) for (let i = 1; i < ids.length; i++) addLink(ids[i - 1], ids[i]);
    edgeMode = 'type';
  }

  // 노드 크기 = 중요도 + 연결수(허브일수록 큼) — PRD §8
  const deg = {};
  for (const l of links) { deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; }
  for (const n of nodes) n.val = (n.val || 1) + (deg[n.id] || 0) * 0.6;

  return { nodes, links, edgeMode };
}
