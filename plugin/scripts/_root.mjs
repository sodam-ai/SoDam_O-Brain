// 플러그인이 app/(DB·검색·서버) 코어를 찾는 방법 — 설치 위치와 무관하게 동작하도록 세 단계로 찾는다.
//  1) 환경변수 OBRAIN_ROOT
//  2) 이 파일 기준 형제 폴더 — repo에서 plugin/과 app/이 나란히 있을 때(제자리 실행)
//  3) ~/.obrain/root 포인터 — `/plugin` 설치는 plugin 폴더를 캐시 폴더로 '복사'해서 옆에 app/이 없다.
//     이때를 위해 app 폴더에서 `npm run plugin:pin`을 한 번 실행하면 O-Brain 위치가 이 파일에 기록된다.
// 못 찾으면 null — 훅·MCP·명령은 조용히 넘어가지 않고 rootProblem() 문구를 사용자에게 보여준다(PRD 05 §3).
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const POINTER_FILE = join(homedir(), '.obrain', 'root');
const hasApp = (root) => !!root && existsSync(join(root, 'app', 'src', 'db.mjs'));
function pinned() { try { return readFileSync(POINTER_FILE, 'utf8').trim(); } catch { return ''; } }

function findRoot() {
  for (const c of [process.env.OBRAIN_ROOT, join(HERE, '..', '..'), pinned()]) {
    if (c && hasApp(resolve(c))) return resolve(c);
  }
  return null;
}

export const OBRAIN_ROOT = findRoot();
export const rootProblem = () => OBRAIN_ROOT ? null
  : 'O-Brain의 app 폴더를 찾지 못했어요. O-Brain의 app 폴더에서 `npm run plugin:pin`을 한 번 실행해 주세요(또는 환경변수 OBRAIN_ROOT 지정).';
export const appUrl = (rel) => {
  if (!OBRAIN_ROOT) throw new Error(rootProblem());
  return pathToFileURL(join(OBRAIN_ROOT, 'app', 'src', rel)).href;
};
// db.mjs의 DATA_DIR 규칙과 동일(환경변수가 '.'으로 시작하면 app/ 기준 상대경로).
export const dataDir = () => {
  if (!OBRAIN_ROOT) return null;
  const app = join(OBRAIN_ROOT, 'app'), e = process.env.OBRAIN_DATA_DIR;
  return e ? (e.startsWith('.') ? join(app, e) : e) : join(app, 'data');
};

// 설정(.env.local)을 직접 읽는다 — 설치 위치와 무관하게 포트·데이터 폴더·OBRAIN_CAPTURE_SDK가 적용되도록.
// 이미 설정된 환경변수는 덮어쓰지 않는다(명시한 값이 우선).
if (OBRAIN_ROOT) { try { process.loadEnvFile(join(OBRAIN_ROOT, 'app', '.env.local')); } catch {} }
