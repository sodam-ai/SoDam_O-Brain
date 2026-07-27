// 데이터 안전망 — SQLite 온라인 백업(WAL 중에도 안전). data/backup/에 스냅샷 보관·회전.
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
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

// 복원 준비(읽기 전용, 라이브 DB 미접촉) — M14 2차. 실제 파일교체(닫기~복사~재오픈)는 server.mjs가
// 자신의 살아있는 db 핸들을 쥐고 별도로 수행(책임 분리 — 이 함수는 절대 db.close()나 파일 덮어쓰기를 하지 않음).
// 안전장치: (1)화이트리스트 일치만 허용(경로조작 원천 차단, 08 §3/§4) (2)무결성 확인(손상 스냅샷 복원 방지)
// (3)복원 직전 현재 상태 자동 백업(기존 backupOnce 재사용, 되돌리기용 안전망).
export async function prepareRestore(file) {
  const dir = join(DATA_DIR, 'backup');
  const known = listBackups();
  const match = known.find(it => it.file === file);
  if (!match) throw new Error('알 수 없는 백업 파일이에요');
  const src = join(dir, file);
  if (!existsSync(src)) throw new Error('백업 파일을 찾을 수 없어요');

  let ok;
  try {
    const check = new Database(src, { readonly: true, fileMustExist: true });
    try { ok = check.pragma('integrity_check', { simple: true }); }
    finally { check.close(); }
  } catch { ok = null; } // SQLite 파일이 아니거나 열기부터 실패 — 아래서 손상 처리로 통일
  if (ok !== 'ok') throw new Error('이 백업 파일이 손상된 것 같아 복원을 중단했어요');

  await backupOnce({ tag: 'before-restore' });

  return { src };
}
