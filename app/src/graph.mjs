// 그래프 데이터 — 노드(기억) + 엣지(사용자가 직접 만든 관계 우선, 없는 쌍은 임베딩 유사도로 보완).
// relation 표에 실제 연결이 있으면 그 관계선을 우선 쓰고, 아직 안 이어진 기억끼리만 의미 유사도로 채운다.
import { DIM } from './db.mjs';

// 유사도선 예산(M73, 2026-10-20) — 비용은 '총 기억 수'가 아니라 '표시할 노드 수'에 비례한다.
// 예전에는 노드마다 벡터 인덱스 KNN(=DB 전체 스캔)을 돌려서, 총 1,500건을 넘으면 유사도선을 통째로 포기하고
// '같은 유형끼리 이은 선'(관계처럼 보이지만 아무 뜻 없는 선)으로 대체했다. 지금은 표시 노드의 저장 벡터를 메모리에 올려
// 노드끼리만 쌍 비교한다(실측 2026-10-20, 실DB 2,340건: 노드 600개 59ms·1,000개 157ms·2,000개 704ms — 예전 방식은 600개에 1.8초).
// 예산 = 화면에서 고를 수 있는 최대 노드 수(서버 클램프 2000)와 같다 → 어떤 설정에서도 의미 없는 유형선으로 속이지 않는다.
// 최악(2,000개)의 계산 비용은 DB가 바뀐 뒤 첫 요청 1회(이후 서버 캐시 — 지문이 같으면 수 ms)이며, 그 사이 서버 응답이 최대 1초가량 늦어질 수 있다.
const SIM_NODE_BUDGET = 2000;
// 이 거리(L2)보다 먼 쌍은 잇지 않는다 — '가장 가까운 이웃'이라도 무관하면 선을 긋지 않는다(검색의 관련도 문턱과 같은 값).
const SIM_GATE = Number(process.env.OBRAIN_VEC_GATE || 0.92);

// 표시 노드끼리 가장 가까운 neighbors개를 잇는 유사도선. 벡터가 없는 기억(임베딩을 못 쓰던 시기 저장분)은 건너뛴다.
function similarityLinks(db, ids, neighbors) {
  const want = new Set(ids);
  const rows = db.prepare('SELECT rowid AS id, embedding FROM memory_vec').all().filter(r => want.has(Number(r.id)));
  const n = rows.length;
  if (n < 2) return [];
  const M = new Float32Array(n * DIM);
  // 정렬(byteOffset) 가정 없이 복사해서 읽는다 — Buffer 풀 위치에 따라 Float32Array 직접 뷰가 실패할 수 있음.
  rows.forEach((r, i) => M.set(new Float32Array(r.embedding.buffer.slice(r.embedding.byteOffset, r.embedding.byteOffset + DIM * 4)), i * DIM));
  const k = Math.max(1, neighbors | 0);
  const best = Array.from({ length: n }, () => []); // 노드별 [내적, 상대 인덱스] 상위 k
  const offer = (arr, dot, j) => {
    if (arr.length < k) { arr.push([dot, j]); arr.sort((a, b) => b[0] - a[0]); }
    else if (dot > arr[k - 1][0]) { arr[k - 1] = [dot, j]; arr.sort((a, b) => b[0] - a[0]); }
  };
  for (let i = 0; i < n; i++) {
    const oi = i * DIM;
    for (let j = i + 1; j < n; j++) {
      const oj = j * DIM; let dot = 0;
      for (let d = 0; d < DIM; d++) dot += M[oi + d] * M[oj + d];
      offer(best[i], dot, j); offer(best[j], dot, i);
    }
  }
  const out = [];
  best.forEach((arr, i) => arr.forEach(([dot, j]) => {
    const dist = Math.sqrt(Math.max(0, 2 - 2 * dot)); // 정규화 벡터의 L2 거리 — 기존 KNN distance와 같은 척도
    if (dist <= SIM_GATE) out.push([Number(rows[i].id), Number(rows[j].id), dist]);
  }));
  return out;
}

export function buildGraph(db, { neighbors = 2, limit = 600, simNodeBudget = SIM_NODE_BUDGET } = {}) {
  const total = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const cap = Math.max(1, (Number(limit) | 0) || 600); // 정수화(better-sqlite3 LIMIT은 정수만 허용)
  // 대량 대비: 중요도+최신 우선으로 상한(top-N). 더 보려면 필터·검색·로컬보기로 드릴다운(PRD §8.4).
  const mems = db.prepare(
    `SELECT id, content, type, importance, confidence, project, category, scope, access_count, created_at
     FROM memory ORDER BY importance DESC, id DESC LIMIT ?`
  ).all(cap);
  const nodes = mems.map(m => ({ id: m.id, name: m.content, type: m.type, importance: m.importance || 1,
    confidence: m.confidence, project: m.project || null, category: m.category || '기타', scope: m.scope || 'global',
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

  // 1) 의미 유사도 기반 — 표시 노드끼리 가장 가까운 이웃 연결.
  // 성능가드(PRD §8.4 "무거우면 자동 단순화"): 표시 노드가 예산을 넘을 때만 아래 유형기반 연결로 전환한다(simplified 플래그로 가시화).
  const simplified = nodes.length > simNodeBudget;
  let edgeMode = 'none';
  if (!simplified) {
    try {
      for (const [a, b, dist] of similarityLinks(db, nodes.map(n => n.id), neighbors)) addLink(a, b, dist);
      edgeMode = 'similarity'; // 가까운 쌍이 하나도 없어도 '유사도 기준으로 계산했다'는 사실은 유지(유형선으로 속이지 않는다)
    } catch { edgeMode = 'none'; }
  }

  // 2) 폴백 — 같은 유형끼리 가볍게 연결(예산 초과 또는 벡터 읽기 실패 시에만)
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
    // 자기참조 관계(from_id===to_id) 방어 — addRelation()이 이미 막아 정상 경로로는 못 만들지만
    // (2026-09-01 실행테스트 확인), addLink()의 기존 자기루프 방지(`a===b`면 무시)와 동일한 방어를
    // 여기도 둬 그래프 렌더링에 자기루프 선이 남지 않게 함(방어심층).
    if (r.from_id === r.to_id) continue;
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

  return { nodes, links: merged, edgeMode, relCount: relations.length, total, shown: nodes.length, simplified, simBudget: simNodeBudget };
}
