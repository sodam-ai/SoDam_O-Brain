// 검색 데모 — 하이브리드 검색을 콘솔로 확인.  사용: node src/search-demo.mjs 포트
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { initEmbedder } from './embed.mjs';

const q = process.argv.slice(2).join(' ') || '포트';
await initEmbedder();
const db = openDb();
const res = await search(db, q, 5);
console.log(`검색어 "${q}" → ${res.length}건`);
for (const r of res) console.log(`  #${r.id} [${r.type}] ★${r.importance} ${r.content}  (score ${r._score.toFixed(4)})`);
db.close();
