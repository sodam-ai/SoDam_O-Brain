// 데이터 안전망 — SQLite 온라인 백업(WAL 중에도 안전) + 이식용 JSON 백업 + 되돌리기(복원).
// 백업 종류별로 따로 보관·회전한다(이전엔 태그 구분 없이 최신 7개만 남겨서, 직접 만든 백업도 며칠 뒤 자동 삭제됐다):
//   startup(서버 시작) 7 · before-*(삭제·병합·가져오기 등 위험 작업 직전) 7 · manual(직접 만든 .db) 10 · portable(이식용 .json.gz) 10
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, rmSync, statSync, existsSync, renameSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { openDb, DATA_DIR } from './db.mjs';
import { buildExport } from './export.mjs';

export const KEEP = { startup: 7, before: 7, manual: 10, portable: 10 };
export const backupDir = () => join(DATA_DIR, 'backup');
const stampNow = () => new Date().toISOString().replace(/[:.]/g, '-');

export class RestoreError extends Error {
  constructor(msg) { super(msg); this.code = 'RESTORE'; }
}

// 파일 이름 → 종류. 태그 없는 옛 .db는 직접 만든 것(manual)으로 본다.
export function classifyBackup(file) {
  if (/-portable\.json\.gz$/.test(file)) return 'portable';
  if (!file.endsWith('.db')) return null;
  const m = /Z-(.+)\.db$/.exec(file);
  const tag = m ? m[1] : '';
  if (tag === 'startup') return 'startup';
  if (tag.startsWith('before-')) return 'before';
  return 'manual';
}
const LABELS = {
  startup: '서버를 켤 때 자동', 'before-delete': '삭제 직전 자동', 'before-merge': '병합 직전 자동', 'before-dup-clean': '중복 정리 직전 자동',
  'before-import': '가져오기 직전 자동', 'before-undo': '되돌리기 직전 자동', 'before-restore': '복원 직전 자동', manual: '직접 만든 백업', portable: '이식용(다른 PC로 옮기기)',
};
export function labelOf(file, kind) {
  const m = /Z-(.+)\.db$/.exec(file);
  return LABELS[m ? m[1] : kind] || (kind === 'before' ? '위험 작업 직전 자동' : LABELS[kind] || '백업');
}

// SQLite 파일을 읽기 전용으로 열어 fn을 실행. 백업 파일엔 WAL 형식 표시가 있어서 "읽기만 해도" 옆에 -wal/-shm이 생기므로,
// 이 호출이 새로 만든 것만 닫은 뒤 치운다(원래 있던 파일은 건드리지 않음 — 목록을 볼 때마다 찌꺼기가 쌓이는 것 방지).
export function withReadonly(path, fn) {
  const side = [path + '-wal', path + '-shm'];
  const had = side.map(p => existsSync(p));
  const c = new Database(path, { readonly: true, fileMustExist: true });
  try { return fn(c); }
  finally { c.close(); side.forEach((p, i) => { if (!had[i]) { try { rmSync(p, { force: true }); } catch {} } }); }
}

// 열어서 실제로 읽히는지·기억이 몇 건 들었는지 확인(읽기 전용). 실패하면 ok:false — "백업은 있는데 못 쓰는" 상황을 미리 드러낸다.
function inspectBackup(path, kind) {
  try {
    if (kind === 'portable') {
      if (statSync(path).size > 50 * 1024 * 1024) return { ok: true, memories: null };
      const j = JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
      return { ok: Array.isArray(j.memories), memories: j.count ?? (j.memories || []).length, relations: j.relationCount ?? (j.relations || []).length };
    }
    return withReadonly(path, c => {
      const memories = c.prepare('SELECT COUNT(*) n FROM memory').get().n;
      let relations = 0; try { relations = c.prepare('SELECT COUNT(*) n FROM relation').get().n; } catch {}
      return { ok: true, memories, relations };
    });
  } catch { return { ok: false, memories: null }; }
}

// 백업 목록(읽기 전용) — 최신순. inspect=false면 내용 확인 없이 이름·크기만(빠름).
export function listBackups({ inspect = true } = {}) {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  return readdirSync(dir)
    .map(f => {
      const kind = classifyBackup(f);
      if (!kind) return null;
      const st = statSync(join(dir, f));
      const it = { file: f, size: st.size, mtime: st.mtimeMs, kind, label: labelOf(f, kind) };
      return inspect ? Object.assign(it, inspectBackup(join(dir, f), kind)) : it;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime || (a.file < b.file ? 1 : -1));
}

// 같은 종류끼리만 회전 — 다른 종류의 백업은 절대 밀어내지 않는다. 동시각이면 파일 이름(시각 포함)으로 최신을 가린다.
function rotate(kind, keepOverride) {
  const dir = backupDir();
  const limit = Number.isInteger(keepOverride) && keepOverride > 0 ? keepOverride : KEEP[kind];
  const files = readdirSync(dir).filter(f => classifyBackup(f) === kind)
    .map(f => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t || (a.f < b.f ? 1 : -1));
  for (const old of files.slice(limit)) { try { rmSync(join(dir, old.f)); } catch {} }
  return Math.min(files.length, limit);
}

export async function backupOnce({ keep, tag = '' } = {}) {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const name = `obrain-${stampNow()}${tag ? '-' + tag : ''}.db`;
  const dest = join(dir, name);
  const db = openDb();
  try { await db.backup(dest); } // better-sqlite3 온라인 백업(파일복사보다 안전)
  finally { db.close(); }
  const kind = classifyBackup(name);
  return { dest, file: name, kind, total: rotate(kind, keep), dir };
}

// 이식용 백업 — 모든 기억·관계를 JSON(.gz)로. .db는 같은 버전의 O-Brain이어야 열리지만 이건 다른 PC·새 설치에서도 "가져오기"로 읽힌다.
// 폴더 경로도 그대로 담는다(옮겨서 같은 프로젝트 구분을 쓰기 위함) — 남에게 보내는 파일이 아니라 "내 보관용"이다.
export function portableBackup() {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const db = openDb();
  try {
    const b = buildExport(db, { format: 'json', scope: { mode: 'all' }, stripProject: false, gzip: true });
    const name = `obrain-${stampNow()}-portable.json.gz`;
    const dest = join(dir, name);
    writeFileSync(dest, b.bytes);
    return { dest, file: name, kind: 'portable', count: b.count, size: b.bytes.length, total: rotate('portable'), dir };
  } finally { db.close(); }
}

// 되돌리기(복원) — 터미널의 `npm run restore`가 호출한다. 서버·클로드코드 창이 DB를 쥐고 있을 땐 쓰면 안 되므로 화면에서는 하지 않는다.
// 안전장치: (1) 목록에 있는 .db 이름만 허용(경로조작 불가) (2) 무결성 검사 (3) 현재 상태를 먼저 자동 백업
// (4) 지우지 않고 "옆으로 치우기(이름 바꾸기)"로 교체 — 다른 프로그램이 파일을 쥐고 있으면(Windows) 첫 단계에서 실패해 아무것도 안 바뀜
// (5) 낡은 -wal/-shm도 함께 치움(새 DB에 잘못 적용되는 것 방지) (6) 교체 뒤 열어 확인하고, 안 되면 원래대로 되돌림.
export async function restoreFromBackup(file, { onStep = () => {} } = {}) {
  const item = listBackups({ inspect: false }).find(it => it.file === file && it.file.endsWith('.db'));
  if (!item) throw new RestoreError('알 수 없는 백업 파일이에요(.db 백업만 되돌릴 수 있어요. 이식용 .json.gz는 화면의 "가져오기"로 불러오세요).');
  const src = join(backupDir(), file);
  let ok = null;
  try { ok = withReadonly(src, c => c.pragma('integrity_check', { simple: true })); } catch { ok = null; }
  if (ok !== 'ok') throw new RestoreError('이 백업 파일이 손상된 것 같아 되돌리기를 중단했어요. 다른 백업을 골라 보세요.');
  onStep('verified');

  const live = join(DATA_DIR, 'obrain.db');
  let safety = null;
  if (existsSync(live)) { try { safety = (await backupOnce({ tag: 'before-restore' })).file; } catch { safety = null; } }
  onStep(safety ? 'safety-backup' : 'safety-backup-skipped');

  const stamp = stampNow();
  const parts = [live, live + '-wal', live + '-shm'];
  const tmp = live + '.restoring-' + stamp;
  const aside = p => p + '.replaced-' + stamp;
  copyFileSync(src, tmp);
  const moved = [];
  let placed = false;
  const rollback = () => {
    try { rmSync(tmp, { force: true }); } catch {}
    if (placed) for (const p of parts) { try { rmSync(p, { force: true }); } catch {} }   // 새로 놓은 파일(과 그걸 열다 생긴 -wal/-shm)을 치움
    for (const p of [...moved].reverse()) { try { if (existsSync(aside(p))) renameSync(aside(p), p); } catch {} }
  };
  try {
    for (const p of parts) if (existsSync(p)) { renameSync(p, aside(p)); moved.push(p); }
    renameSync(tmp, live);
    placed = true;
  } catch {
    rollback();
    throw new RestoreError('다른 프로그램(O-Brain 서버·클로드코드 창)이 데이터를 쓰고 있어서 교체하지 못했어요. 모두 닫고 다시 해 주세요. 아무것도 바뀌지 않았어요.');
  }
  onStep('swapped');
  let memories = null;
  try { const db = openDb(); try { memories = db.prepare('SELECT COUNT(*) n FROM memory').get().n; } finally { db.close(); } }
  catch { rollback(); throw new RestoreError('되돌린 파일을 열지 못해서 원래대로 돌려놨어요. 아무것도 바뀌지 않았어요.'); }
  return { restored: file, memories, safetyBackup: safety, replaced: moved.map(p => aside(p)), stamp };
}
