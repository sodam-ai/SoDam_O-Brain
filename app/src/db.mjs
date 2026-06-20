// O-Brain DB 계층 — SQLite + sqlite-vec(벡터) + FTS5(키워드)
// 스파이크에서 검증된 패턴을 본체로 승격(rowid=BigInt, 임베딩=float32 blob).
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { classify } from './classify.mjs';
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
      project TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(content);
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(embedding float[${DIM}]);
    -- 관계(사용자 수동 연결) — 결정의 번복/근거/영향/충돌을 사람이 직접 잇는다(자동추론 X)
    CREATE TABLE IF NOT EXISTS relation(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(from_id, to_id, type)
    );
  `);
  // 마이그레이션(비파괴) — 기존 DB에 컬럼 없으면 추가(기존 행은 NULL)
  const cols = db.prepare('PRAGMA table_info(memory)').all().map(c => c.name);
  if (!cols.includes('project')) db.exec('ALTER TABLE memory ADD COLUMN project TEXT');
  if (!cols.includes('category')) db.exec('ALTER TABLE memory ADD COLUMN category TEXT'); // 분류(온톨로지 v1)
  // 분류 백필 — 비어있는 것만(멱등). 기존 기억에도 규칙 기반 주제 부여.
  try {
    const need = db.prepare(`SELECT id, content FROM memory WHERE category IS NULL OR category = ''`).all();
    if (need.length) {
      const upd = db.prepare('UPDATE memory SET category = ? WHERE id = ?');
      db.transaction(() => { for (const m of need) upd.run(classify(m.content), m.id); })();
    }
  } catch {}
  return db;
}
