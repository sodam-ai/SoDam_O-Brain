// 되돌리기(복원) — npm run restore            (목록에서 번호 고르기)
//                  npm run restore -- <백업 파일 이름>   (이름으로 바로)
// 서버·클로드코드 창을 모두 닫은 뒤 쓰세요. 화면에서 하지 않는 이유: 열려 있는 데이터 파일을 덮어쓰면 손상될 수 있어서입니다.
// 안전장치: 서버 켜짐 거부 → 무결성 검사 → 현재 상태 자동 백업 → 확인 입력 → 이름 바꾸기로 교체(실패 시 원복). 옛 파일은 지우지 않고 옆에 남깁니다.
// (--yes: 확인 질문 생략 — 자동 시험용. 평소에는 쓰지 마세요.)
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { listBackups, restoreFromBackup, withReadonly, RestoreError } from './backup.mjs';
import { DATA_DIR } from './db.mjs';

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const wanted = args.find(a => !a.startsWith('--'));
const PORT = Number(process.env.OBRAIN_PORT || 7740);
const say = console.log;
const die = msg => { say('❌ ' + msg); process.exit(1); };

// 1) 서버가 켜져 있으면 시작도 하지 않는다(편의 점검 — 진짜 방어는 파일 교체 단계의 이름 바꾸기 실패).
let running = false;
try { await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) }); running = true; } catch { /* 연결 안 됨 = 꺼져 있음 */ }
if (running) die(`O-Brain 서버가 켜져 있어요(포트 ${PORT}). 서버를 켠 터미널 창과 클로드코드 창을 모두 닫은 뒤 다시 실행해 주세요.`);

// 2) 되돌릴 수 있는 백업(.db)만 보여준다(이식용 .json.gz는 화면의 "가져오기"로).
const items = listBackups().filter(i => i.kind !== 'portable');
if (!items.length) die('되돌릴 수 있는 백업(.db)이 없어요. 이식용 .json.gz 파일은 O-Brain 화면의 데이터 → 가져오기에서 불러오세요.');
const fmtDate = ms => new Date(ms).toLocaleString('ko-KR', { hour12: false });
const fmtSize = n => (n < 1024 * 1024 ? Math.round(n / 1024) + 'KB' : (n / 1024 / 1024).toFixed(1) + 'MB');
const line = (i, it) => `${String(i + 1).padStart(2)}. ${fmtDate(it.mtime)} · ${it.label} · ${it.ok ? `기억 ${it.memories}건` : '⚠️ 열리지 않음(손상 의심)'} · ${fmtSize(it.size)}\n      ${it.file}`;

let target = null;
if (wanted) {
  target = items.find(i => i.file === wanted);
  if (!target) die(`그런 백업이 없어요: ${wanted}\n(npm run restore 만 입력하면 목록에서 고를 수 있어요)`);
} else {
  if (!process.stdin.isTTY) die('목록에서 고르려면 터미널에서 직접 실행해 주세요(npm run restore). 이름을 아는 경우: npm run restore -- <백업 파일 이름>');
  say('되돌릴 수 있는 백업 (최신순)\n');
  items.forEach((it, i) => say(line(i, it)));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question('\n되돌릴 번호를 입력하세요 (그만두려면 그냥 Enter): ')).trim();
  rl.close();
  if (!ans) { say('취소했어요. 아무것도 바뀌지 않았어요.'); process.exit(0); }
  const n = Number(ans);
  if (!Number.isInteger(n) || n < 1 || n > items.length) die('목록에 없는 번호예요. 아무것도 바뀌지 않았어요.');
  target = items[n - 1];
}
if (!target.ok) die('이 백업은 열리지 않아요(손상 의심). 다른 백업을 골라 주세요. 아무것도 바뀌지 않았어요.');

// 3) 확인 — 현재 데이터와 비교해 보여주고, 정확히 yes를 입력해야 진행한다.
let nowCount = null;
try {
  const live = join(DATA_DIR, 'obrain.db');
  if (existsSync(live)) nowCount = withReadonly(live, c => c.prepare('SELECT COUNT(*) n FROM memory').get().n);
} catch { /* 현재 파일을 못 읽어도 되돌리기는 가능 — 안내만 생략 */ }
say(`\n지금 데이터: ${nowCount == null ? '(읽을 수 없음)' : `기억 ${nowCount}건`}`);
say(`되돌릴 백업: ${fmtDate(target.mtime)} · ${target.label} · 기억 ${target.memories}건`);
if (nowCount != null && target.memories < nowCount) say(`⚠️ 되돌리면 기억이 ${nowCount - target.memories}건 줄어요(그 사이에 쌓인 기억). 지금 데이터는 먼저 자동 백업돼서 나중에 다시 되돌릴 수 있어요.`);
say('진행하면: ① 지금 데이터를 자동 백업 ② 원래 파일은 지우지 않고 이름만 바꿔 옆에 보관 ③ 선택한 백업을 새 데이터로 놓기');
if (!yes) {
  if (!process.stdin.isTTY) die('확인을 받을 수 없어요. 터미널에서 직접 실행해 주세요.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = (await rl.question('\n정말 되돌릴까요? 진행하려면 yes 를 입력하세요: ')).trim().toLowerCase();
  rl.close();
  if (ok !== 'yes') { say('취소했어요. 아무것도 바뀌지 않았어요.'); process.exit(0); }
}

// 4) 실행
const STEP = { verified: '✔ 백업 파일을 열어 확인했어요', 'safety-backup': '✔ 지금 데이터를 먼저 백업했어요', 'safety-backup-skipped': '⚠️ 지금 데이터는 백업하지 못했어요(원래 파일은 옆에 그대로 보관돼요)', swapped: '✔ 파일을 교체했어요' };
try {
  const r = await restoreFromBackup(target.file, { onStep: s => STEP[s] && say(STEP[s]) });
  say(`\n✅ 되돌렸어요 — 기억 ${r.memories}건`);
  if (r.safetyBackup) say(`   직전 상태 백업: ${r.safetyBackup} (되돌린 걸 취소하려면 이 백업으로 다시 npm run restore)`);
  if (r.replaced.length) say(`   원래 파일은 옆에 남겨 뒀어요(문제없으면 직접 지워도 돼요):\n   - ${r.replaced.map(p => p.split(/[\\/]/).pop()).join('\n   - ')}`);
  say('   이제 서버를 다시 켜세요(npm start).');
} catch (e) {
  if (e instanceof RestoreError) die(e.message);
  console.error(e);
  die('되돌리는 중 알 수 없는 문제가 생겼어요. 아무것도 바뀌지 않았을 가능성이 높지만, 데이터 폴더(app/data)를 확인해 주세요.');
}
