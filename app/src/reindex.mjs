// 벡터 재색인 — 의미검색용 벡터가 빠진 기억에 벡터를 채운다.
// 임베딩 모델을 못 쓰던 시기에 저장된 기억(키워드 검색만 되던 것)을 복구하는 용도. 이미 벡터가 있는 기억은 건드리지 않는다(추가만).
import { openDb } from './db.mjs';
import { initEmbedder, embed, toBlob } from './embed.mjs';

const db = openDb();
const mode = await initEmbedder();
if (mode !== 'all-MiniLM-L6-v2') {
  console.error('⚠️ 임베딩 모델을 불러오지 못해 재색인을 중단했어요(아무것도 바꾸지 않았습니다).');
  console.error('   인터넷 연결(최초 1회 모델 다운로드)과 Node 버전(~26.7)을 확인한 뒤 다시 실행해 주세요.');
  db.close();
  process.exit(1);
}

const have = new Set(db.prepare('SELECT rowid AS id FROM memory_vec').all().map(r => Number(r.id)));
const missing = db.prepare('SELECT id, content FROM memory ORDER BY id').all().filter(m => !have.has(m.id));
if (!missing.length) { console.log('✅ 벡터가 빠진 기억이 없어요 — 할 일 없음.'); db.close(); process.exit(0); }

console.log(`벡터가 빠진 기억 ${missing.length}건을 채웁니다…`);
const ins = db.prepare('INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)');
let done = 0, failed = 0;
for (const m of missing) {
  try { ins.run(BigInt(m.id), toBlob(await embed(m.content))); done++; }
  catch { failed++; } // 한 건 실패가 전체를 막지 않게 — 실패 건수는 아래에서 알린다
}
console.log(`✅ ${done}건 완료` + (failed ? ` / ⚠️ ${failed}건 실패(다시 실행하면 이어서 채웁니다)` : ''));
db.close();
process.exit(failed ? 1 : 0);
