// O-Brain DB 계층 — SQLite + sqlite-vec(벡터) + FTS5(키워드)
// 스파이크에서 검증된 패턴을 본체로 승격(rowid=BigInt, 임베딩=float32 blob).
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.OBRAIN_DATA_DIR
  ? (process.env.OBRAIN_DATA_DIR.startsWith('.') ? join(HERE, '..', process.env.OBRAIN_DATA_DIR) : process.env.OBRAIN_DATA_DIR)
  : join(HERE, '..', 'data');
export const DIM = 384;

export function openDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(join(DATA_DIR, 'obrain.db'));
  db.pragma('journal_mode = WAL');
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT DEFAULT '지식',
      importance INTEGER DEFAULT 3,
      confidence REAL DEFAULT 0.6,
      source TEXT DEFAULT 'ai',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(content);
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(embedding float[${DIM}]);
  `);
  return db;
}
