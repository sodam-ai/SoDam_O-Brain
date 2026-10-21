// 슬래시 명령(/o-brain:status 등)이 app/ 스크립트를 실행하는 공통 진입점 — 플러그인이 어디에 설치돼도 app/을 찾아 실행한다.
// 사용: node run-app.mjs <이름> [인자…]   (이름은 아래 허용 목록만 — 임의 파일 실행 방지)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { OBRAIN_ROOT, rootProblem } from './_root.mjs';

const ALLOWED = { status: 'status.mjs', selftest: 'selftest.mjs', backup: 'backup-cli.mjs', open: 'open-dashboard.mjs', reindex: 'reindex.mjs' };
const name = process.argv[2];
if (!ALLOWED[name]) { console.error(`알 수 없는 명령: ${name} (가능: ${Object.keys(ALLOWED).join(', ')})`); process.exit(2); }
if (!OBRAIN_ROOT) { console.error('⚠️ ' + rootProblem()); process.exit(1); }

const app = join(OBRAIN_ROOT, 'app');
const r = spawnSync(process.execPath, [join(app, 'src', ALLOWED[name]), ...process.argv.slice(3)], { cwd: app, stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
