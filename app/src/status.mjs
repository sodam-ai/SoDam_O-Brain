// O-Brain 상태 확인 — 비개발자가 "기억이 쌓였는지" 한눈에. (임베딩 로딩 없음 = 즉시)
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, DATA_DIR } from './db.mjs';
import { listMemories } from './store.mjs';

const db = openDb();
const total = db.prepare('SELECT COUNT(*) AS n FROM memory').get().n;
const byType = db.prepare('SELECT type, COUNT(*) AS n FROM memory GROUP BY type ORDER BY n DESC').all();
const recent = listMemories(db, 5);
db.close();

const probe = join(DATA_DIR, '_probe.json');
const fired = existsSync(probe);
const L = (s = '') => console.log(s);

L('================= O-Brain 상태 =================');
L('저장 위치 : ' + DATA_DIR);
L('총 기억   : ' + total + ' 건' + (byType.length ? '  (' + byType.map(t => `${t.type} ${t.n}`).join(', ') + ')' : ''));
L('훅 발화   : ' + (fired ? `예 — _probe.json 있음 (${statSync(probe).mtime.toLocaleString()})` : '아니오 — 아직 실세션 캡처 기록 없음'));
L('-------------- 최근 기억 5건 --------------');
if (!recent.length) L('(아직 없음)');
for (const m of recent) L(`#${m.id} [${m.type}] ★${m.importance} ${m.content}`);
L('==============================================');
L(fired ? '✅ 훅이 한 번 이상 작동했습니다.' : 'ℹ️ 플러그인 설치 후 "대화 → 세션 종료"를 하면 여기에 자동으로 쌓입니다.');
