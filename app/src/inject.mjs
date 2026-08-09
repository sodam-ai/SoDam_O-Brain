// SessionStart 주입용 컨텍스트(소량·요약 — 토큰 절약).
import { openDb } from './db.mjs';
import { listMemories } from './store.mjs';
import { search } from './search.mjs';

// 노이즈 방어(2026-07-26, M12 후속) — extract.mjs/index.html과 동일 기준(대화인용·표·헤더).
// M12-①은 '앞으로 저장될' 노이즈만 막았고, 2026-07-26 이전 저장분(실측 383건)은 아직 DB에 남아있음.
// 그 기존 노이즈가 중요도/최신성 점수로 다음 세션 컨텍스트에 다시 새어들지 않도록 주입 직전에 한 번 더 거른다.
// (삭제 아님 — 주입 후보에서만 제외. 실데이터는 그대로 두고, 정리는 목록 탭 노이즈 필터+전체선택으로 사람이 확인 후 수행)
const NOISE_RE = /^\*{0,2}(Claude|Assistant|User|사용자|어시스턴트)\*{0,2}\s*[:：]|^#{1,6}\s|\|.*\|/i;
const isNoisy = m => NOISE_RE.test(String(m.content || '').trim());

// 세션 시작(검색어 없음) 주입용 합성 랭킹 — 중요도만으론 매번 같은 옛 기억만 떠서,
// 최신성·신뢰도를 함께 반영(PRD 07 §5). 검색어가 있으면 search()가 관련도를 처리하므로 그대로 둠.
// 가중치(2026-07-16 정정): PRD 07 §5 "의미유사도0.7+중요도0.15+최신성0.1+신뢰도0.05"에서 관련도 항을 뺀
// 나머지 비율(중요도:최신성:신뢰도 = 0.15:0.1:0.05 → 정규화 0.5:0.33:0.17)로 맞춤. 기존 0.4/0.4/0.2(최신성=중요도 동률)는
// 60일 창 경계 근처에서 저가치 신규 노이즈가 검증된 고가치 기억을 역전시키는 경계 버그 확인(격리 DB 실측, _inject_verify.mjs).
function rankNoQuery(rows, max) {
  const now = Date.now();
  const scoreOf = m => {
    const imp = Math.max(0, Math.min(5, m.importance || 0)) / 5;                 // 중요도 0~1
    const d = m.created_at ? new Date(String(m.created_at).replace(' ', 'T')).getTime() : 0;
    const days = d ? (now - d) / 86400000 : 999;
    const rec = Math.max(0, 1 - Math.min(days / 60, 1));                          // 최신성(최근 60일 윈도우)
    const conf = m.confidence != null ? Math.max(0, Math.min(1, m.confidence)) : 0.6;
    return imp * 0.5 + rec * 0.33 + conf * 0.17;
  };
  return rows.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, max);
}

export async function buildInjection({ query = '', project = '', max = 8 } = {}) {
  const db = openDb();
  let mems;
  try {
    if (query) {
      // scope 우선순위(PRD 07 §5) — 쿼리 유무와 무관하게 항상 "현재 프로젝트 + 전역" 우선이어야 하는데,
      // 이 경로(query 있음)는 지금까지 실제로 호출된 적이 없어 projectFilter 누락이 드러나지 않았던 잠재
      // 결함(2026-08-10 발견) — 다른 프로젝트 기억이 섞여 들어오는 걸 막는다.
      mems = await search(db, query, max, project || null);
    } else {
      // 후보 풀 = 최근 60 + 중요도 상위 40(오래된 핵심 기억도 후보 유지) → 합성점수로 재정렬.
      // project 있으면 해당 프로젝트 + 전역(NULL) 기억. project 없으면 global scope만(타 프로젝트 섞임 방지).
      const where = project
        ? 'WHERE (project = ? OR project IS NULL)'
        : "WHERE (scope IS NULL OR scope = 'global')";
      const args = project ? [project] : [];
      const cols = 'id, content, type, importance, confidence, created_at';
      const recent = db.prepare(`SELECT ${cols} FROM memory ${where} ORDER BY created_at DESC, id DESC LIMIT 60`).all(...args);
      const important = db.prepare(`SELECT ${cols} FROM memory ${where} ORDER BY importance DESC, id DESC LIMIT 40`).all(...args);
      const seen = new Set(); const pool = [];
      for (const r of recent.concat(important)) if (!seen.has(r.id)) { seen.add(r.id); pool.push(r); }
      // SUPERSEDES 당한 기억(번복된 결정) 제외 — 무효화된 기억이 주입되지 않도록(PRD 07 §5)
      let invalidated;
      try {
        invalidated = new Set(
          db.prepare("SELECT DISTINCT to_id FROM relation WHERE type='SUPERSEDES'").all().map(r => r.to_id)
        );
      } catch { invalidated = new Set(); }
      const notInvalidated = invalidated.size ? pool.filter(m => !invalidated.has(m.id)) : pool;
      const valid = notInvalidated.filter(m => !isNoisy(m)); // 노이즈 방어(위 주석 참고)
      mems = rankNoQuery(valid, max);
    }
  } catch (e) {
    try { mems = listMemories(db, max); } catch { mems = []; }                    // 폴백: 실패 시 기존 동작(중요도순)
  } finally {
    db.close();
  }
  // 안전망 — query 경로(search 결과)·fallback 경로(listMemories)는 위 pool 필터를 안 거치므로 여기서 한 번 더 방어.
  if (mems) mems = mems.filter(m => !isNoisy(m));
  if (!mems || !mems.length) return null;
  // 라벨 명확화 — 다른 메모리 도구와 섞여도 'O-Brain 기억'임을 구분(충돌 완화)
  const lines = mems.map(m => `- 📌[O-Brain·${m.type}] ${m.content}`);
  return `# 📌 O-Brain 로컬 기억 ${mems.length}건 (이 PC에 저장된 내 기억 — 다른 메모리 도구와 별개)\n` +
    lines.join('\n') +
    `\n(출처: O-Brain 자동 주입. 더 찾기: search_memory 도구. 충돌 시 이 라벨이 O-Brain 기억입니다.)`;
}
