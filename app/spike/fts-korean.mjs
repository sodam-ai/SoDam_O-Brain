// O-Brain 검증 스파이크 — 한국어 FTS5 키워드 검색 함정 + 해결 확인
import Database from 'better-sqlite3';
const db = new Database(':memory:');

db.exec(`
  CREATE VIRTUAL TABLE t_default USING fts5(content);                 -- 기본 unicode61
  CREATE VIRTUAL TABLE t_trigram USING fts5(content, tokenize='trigram'); -- 부분일치
`);
const rows = ['테스트 포트는 1601 사용', '8809 포트는 충돌나서 금지', 'API 키는 .env.local 에만 저장'];
const i1 = db.prepare('INSERT INTO t_default(rowid,content) VALUES(?,?)');
const i2 = db.prepare('INSERT INTO t_trigram(rowid,content) VALUES(?,?)');
rows.forEach((c, i) => { i1.run(i + 1, c); i2.run(i + 1, c); });

const q = (t, m) => {
  try { return db.prepare(`SELECT content FROM ${t} WHERE ${t} MATCH ? ORDER BY rank`).all(m).map(r => r.content); }
  catch (e) { return `ERR: ${e.message}`; }
};

console.log('① unicode61  "포트"  →', JSON.stringify(q('t_default', '포트')));
console.log('② unicode61  "포트*" →', JSON.stringify(q('t_default', '포트*')));
console.log('③ trigram    "포트"  →', JSON.stringify(q('t_trigram', '포트')));
console.log('④ trigram    "충돌"  →', JSON.stringify(q('t_trigram', '충돌')));
console.log('⑤ trigram    "테스트" →', JSON.stringify(q('t_trigram', '테스트')));
console.log('⑥ trigram    "포트는" →', JSON.stringify(q('t_trigram', '포트는')));
