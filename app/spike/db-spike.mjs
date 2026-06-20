// O-Brain 검증 스파이크 — 리스크 ① (DB 스택 실측)
// 목적: better-sqlite3 + sqlite-vec(벡터검색) + FTS5(키워드검색)가
//       이 Windows PC에서 실제로 설치/로드/검색되는지 숫자로 확인.
// 버리는 코드(throwaway). 통과 시 패턴만 app/ 본체로 승격.
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'data'), { recursive: true });

const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

let pass = true;
try {
  // 1) better-sqlite3 네이티브 로드 (R5 핵심)
  const db = new Database(join(here, 'data', 'spike.db'));
  db.pragma('journal_mode = WAL');

  // 2) sqlite-vec 확장 로드 (loadExtension 가능?)
  sqliteVec.load(db);
  const ver = db.prepare('select sqlite_version() as s, vec_version() as v').get();
  log(`[OK] better-sqlite3 로드 · sqlite ${ver.s} · sqlite-vec ${ver.v}`);

  // 3) 스키마: 본체표 + FTS5(키워드) + vec0(384벡터)
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory(
      id INTEGER PRIMARY KEY,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 3
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(content);
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(embedding float[384]);
  `);
  log('[OK] 스키마 생성 (memory + FTS5 + vec0[384])');

  // 4) 가짜 384차원 임베딩 (실측용 더미)
  const fakeVec = (seed) => {
    const a = new Float32Array(384);
    for (let i = 0; i < 384; i++) a[i] = Math.sin(seed * 0.13 + i * 0.017);
    return new Uint8Array(a.buffer); // vec0 = float32 LE blob (sqlite-vec 공식 패턴)
  };

  const rows = [
    { content: '테스트 포트는 1601 사용', importance: 4 },
    { content: '8809 포트는 충돌나서 금지', importance: 3 },
    { content: 'API 키는 .env.local 에만 저장', importance: 5 },
  ];

  const insMem = db.prepare('INSERT INTO memory(content, importance) VALUES (?, ?)');
  const insFts = db.prepare('INSERT INTO memory_fts(rowid, content) VALUES (?, ?)');
  const insVec = db.prepare('INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)');

  const t0 = performance.now();
  db.transaction(() => {
    rows.forEach((r, i) => {
      const id = Number(insMem.run(r.content, r.importance).lastInsertRowid);
      insFts.run(id, r.content);
      insVec.run(BigInt(id), fakeVec(i + 1)); // rowid는 BigInt 필수
    });
  })();
  const t1 = performance.now();
  log(`[OK] 3건 저장(본체+FTS+벡터, 트랜잭션) ${(t1 - t0).toFixed(2)}ms`);

  // 5) FTS5 키워드 검색
  const kw = db.prepare(
    `SELECT m.id, m.content FROM memory_fts f JOIN memory m ON m.id=f.rowid
     WHERE memory_fts MATCH ? ORDER BY rank LIMIT 5`
  ).all('포트');
  log(`[OK] FTS5 키워드("포트") → ${kw.length}건: ${kw.map(r => r.content).join(' / ')}`);

  // 6) sqlite-vec KNN(의미) 검색
  const q = fakeVec(1);
  const tk0 = performance.now();
  const knn = db.prepare(
    `SELECT rowid, distance FROM memory_vec WHERE embedding MATCH ? ORDER BY distance LIMIT 3`
  ).all(q);
  const tk1 = performance.now();
  log(`[OK] sqlite-vec KNN → ${knn.length}건, top distance=${knn[0]?.distance?.toFixed?.(4)} (${(tk1 - tk0).toFixed(2)}ms)`);

  db.close();
} catch (e) {
  pass = false;
  log(`[FAIL] 기본 경로(better-sqlite3+sqlite-vec): ${e.message}`);
}

// 7) 폴백 경로 점검: node:sqlite(내장) + sqlite-vec 확장 로드 가능?
try {
  const { DatabaseSync } = await import('node:sqlite');
  const ndb = new DatabaseSync(':memory:', { allowExtension: true });
  ndb.enableLoadExtension?.(true);
  ndb.loadExtension(sqliteVec.getLoadablePath());
  const v = ndb.prepare('select vec_version() v').get();
  log(`[OK] 폴백 node:sqlite + sqlite-vec 로드 가능 · vec ${v.v}`);
} catch (e) {
  log(`[INFO] 폴백 node:sqlite 확장로드: ${e.message} (기본 경로가 OK면 무관)`);
}

log(pass ? 'SPIKE-DB: PASS' : 'SPIKE-DB: FAIL');
process.exit(pass ? 0 : 1);
