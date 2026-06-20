// 데모 시드 — 실제 파이프라인(시크릿제거→임베딩→저장)으로 기억 몇 건 적재.
import { openDb } from './db.mjs';
import { addMemory, listMemories } from './store.mjs';
import { initEmbedder } from './embed.mjs';

const DEMO = [
  { content: '이 프로젝트 테스트 포트는 1601 사용', type: '결정', importance: 4 },
  { content: '8809 포트는 충돌나서 금지', type: '제약', importance: 3 },
  { content: 'API 키는 .env.local 에만 저장하고 절대 커밋 금지', type: '제약', importance: 5 },
  { content: '실수로 키 노출 예: sk-ABCD1234EFGH5678IJKLmnop 는 저장되면 안 됨', type: '제약', importance: 5 },
  { content: 'UI는 shadcn/ui 컴포넌트를 우선 재사용한다', type: '선호', importance: 3 },
];

const mode = await initEmbedder();
console.log('임베딩 엔진:', mode);
const db = openDb();
for (const m of DEMO) {
  const r = await addMemory(db, m);
  console.log(`저장 #${r.id} (시크릿 ${r.redactedHits}건 제거)`);
}
console.log('\n=== 저장된 기억(최신순) ===');
for (const m of listMemories(db, 10)) console.log(`#${m.id} [${m.type}] ★${m.importance} ${m.content}`);
db.close();
