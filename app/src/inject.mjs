// SessionStart 주입용 컨텍스트(소량·요약 — 토큰 절약).
import { openDb } from './db.mjs';
import { listMemories } from './store.mjs';
import { search } from './search.mjs';

export async function buildInjection({ query = '', project = '', max = 8 } = {}) {
  const db = openDb();
  let mems;
  try {
    if (query) mems = await search(db, query, max);
    else if (project) {
      // 현재 프로젝트 기억 + 전역(project NULL)만 — 다른 프로젝트 기억 섞임 방지
      mems = db.prepare(
        `SELECT id, content, type, importance FROM memory
         WHERE project = ? OR project IS NULL
         ORDER BY importance DESC, id DESC LIMIT ?`
      ).all(project, max);
    } else mems = listMemories(db, max);
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
