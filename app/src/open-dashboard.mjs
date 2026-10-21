// /o-brain:open — 서버가 꺼져 있으면 켠 뒤 브라우저로 대시보드를 연다.
// 켜짐 확인은 토큰이 필요 없는 '/'로 한다. (이전에는 토큰이 필요한 /api/health를 토큰 없이 불러 항상 403 →
// 켜져 있어도 "꺼짐"으로 오판해 두 번째 서버를 띄우려 했다.)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.OBRAIN_PORT || 7740);
const URL_ = `http://127.0.0.1:${PORT}/`;
const alive = async () => { try { return (await fetch(URL_, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (await alive()) {
  console.log('서버가 이미 켜져 있어요.');
} else {
  console.log('서버가 꺼져 있어서 켜는 중이에요…');
  spawn(process.execPath, [join(HERE, 'server.mjs')], { cwd: join(HERE, '..'), detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref();
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await sleep(1000); up = await alive(); } // 임베딩 모델 로딩에 몇 초 걸릴 수 있음
  if (!up) {
    console.error('⚠️ 40초 안에 서버가 켜지지 않았어요. app 폴더에서 `npm start`로 직접 켜서 오류 메시지를 확인해 주세요.');
    process.exit(1);
  }
}

if (process.env.OBRAIN_NO_BROWSER === '1') {
  console.log('(브라우저 열기는 생략했어요)');
} else {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL_]]
    : process.platform === 'darwin' ? ['open', [URL_]] : ['xdg-open', [URL_]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
console.log(`O-Brain 대시보드: ${URL_}`);
