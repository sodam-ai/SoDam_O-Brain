// SessionStart 주입용 컨텍스트(소량·요약 — 토큰 절약).
import { openDb } from './db.mjs';
import { listMemories } from './store.mjs';
import { search } from './search.mjs';

// 세션 시작(검색어 없음) 주입용 합성 랭킹 — 중요도만으론 매번 같은 옛 기억만 떠서,
// 최신성·신뢰도를 함께 반영(PRD 07). 검색어가 있으면 search()가 관련도를 처리하므로 그대로 둠.
function rankNoQuery(rows, max) {
  const now = Date.now();
  const scoreOf = m => {
    const imp = Math.max(0, Math.min(5, m.importance || 0)) / 5;                 // 중요도 0~1
    const d = m.created_at ? new Date(String(m.created_at).replace(' ', 'T')).getTime() : 0;
    const days = d ? (now - d) / 86400000 : 999;
    const rec = Math.max(0, 1 - Math.min(days / 60, 1));                          // 최신성(최근 60일 윈도우)
    const conf = m.confidence != null ? Math.max(0, Math.min(1, m.confidence)) : 0.6;
    return imp * 0.4 + rec * 0.4 + conf * 0.2;
  };
  return rows.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, max);
}

export async function buildInjection({ query = '', project = '', max = 8 } = {}) {
  const db = openDb();
  let mems;
  try {
    if (query) {
      mems = await search(db, query, max);
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
      const valid = invalidated.size ? pool.filter(m => !invalidated.has(m.id)) : pool;
      mems = rankNoQuery(valid, max);
    }
  } catch (e) {
    try { mems = listMemories(db, max); } catch { mems = []; }                    // 폴백: 실패 시 기존 동작(중요도순)
  } finally {
    db.close();
  }
  if (!mems || !mems.length) return null;
  // 라벨 명확화 — 다른 메모리 도구와 섞여도 'O-Brain 기억'임을 구분(충돌 완화)
  const lines = mems.map(m => `- 📌[O-Brain·${m.type}] ${m.content}`);
  return `# 📌 O-Brain 로컬 기억 ${mems.length}건 (이 PC에 저장된 내 기억 — 다른 메모리 도구와 별개)\n` +
    lines.join('\n') +
    `\n(출처: O-Brain 자동 주입. 더 찾기: search_memory 도구. 충돌 시 이 라벨이 O-Brain 기억입니다.)`;
}
