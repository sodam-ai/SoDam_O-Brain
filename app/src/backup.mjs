// 데이터 안전망 — SQLite 온라인 백업(WAL 중에도 안전). data/backup/에 스냅샷 보관·회전.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, DATA_DIR } from './db.mjs';

// 백업 목록 조회(읽기 전용) — 화면에 시각·용량을 보여주기 위함. 삭제·이동 없음(PRD 05 §4 "DB 파일 복사 안내"의 최소 요건).
export function listBackups() {
  const dir = join(DATA_DIR, 'backup');
  mkdirSync(dir, { recursive: true });
  return readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .map(f => { const st = statSync(join(dir, f)); return { file: f, size: st.size, mtime: st.mtimeMs }; })
    .sort((a, b) => b.mtime - a.mtime);
}

export async function backupOnce({ keep = 7, tag = '' } = {}) {
  const dir = join(DATA_DIR, 'backup');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(dir, `obrain-${ts}${tag ? '-' + tag : ''}.db`);

  const db = openDb();
  await db.backup(dest); // better-sqlite3 온라인 백업(파일복사보다 안전)
  db.close();

  // 회전 — 최신 keep개만 남김
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(keep)) { try { rmSync(join(dir, old.f)); } catch {} }

  return { dest, total: Math.min(files.length, keep), dir };
}
