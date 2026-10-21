// O-Brain 상태 확인 — 비개발자가 "기억이 쌓였는지" 한눈에. (임베딩 로딩 없음 = 즉시)
import { existsSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, DATA_DIR } from './db.mjs';
import { listMemories } from './store.mjs';
import { readEmbedDegraded } from './embed.mjs';
import { listBackups } from './backup.mjs';

const db = openDb();
const total = db.prepare('SELECT COUNT(*) AS n FROM memory').get().n;
const byType = db.prepare('SELECT type, COUNT(*) AS n FROM memory GROUP BY type ORDER BY n DESC').all();
const vecCount = db.prepare('SELECT COUNT(*) AS n FROM memory_vec').get().n;
const recent = listMemories(db, 5);
db.close();

const probe = join(DATA_DIR, '_probe.json');
const fired = existsSync(probe);
const degraded = readEmbedDegraded();
const missingVec = Math.max(0, total - vecCount);
const HERE = dirname(fileURLToPath(import.meta.url));
let lastCap = null; try { lastCap = JSON.parse(readFileSync(join(DATA_DIR, '_last_capture.json'), 'utf8')); } catch {}
let expectedVer = null; try { expectedVer = JSON.parse(readFileSync(join(HERE, '..', '..', 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch {}
let pinned = ''; try { pinned = readFileSync(join(homedir(), '.obrain', 'root'), 'utf8').trim(); } catch {}
const fmtTime = (s) => new Date(s).toLocaleString();
const L = (s = '') => console.log(s);
// 백업 현황 — 종류별 개수와 가장 최근 시각, 열리지 않는(손상 의심) 백업이 있으면 경고. 백업이 "있는지"만이 아니라 "쓸 수 있는지"까지 본다.
let bks = []; try { bks = listBackups(); } catch {}
const bkCount = (k) => bks.filter(b => b.kind === k).length;
const newestDb = bks.find(b => b.kind !== 'portable');
const badBks = bks.filter(b => b.ok === false).length;

L('================= O-Brain 상태 =================');
L('저장 위치 : ' + DATA_DIR);
L('총 기억   : ' + total + ' 건' + (byType.length ? '  (' + byType.map(t => `${t.type} ${t.n}`).join(', ') + ')' : ''));
L('훅 발화   : ' + (fired ? `예 — _probe.json 있음 (${statSync(probe).mtime.toLocaleString()})` : '아니오 — 아직 실세션 캡처 기록 없음'));
// 훅이 '불렸다'는 사실만으로는 저장이 '성공'했는지 알 수 없다 — 마지막 캡처 결과를 따로 보여준다(PRD R9: 조용한 실패 가시화).
L('마지막 캡처: ' + (lastCap
  ? (lastCap.ok
      ? `✅ ${fmtTime(lastCap.at)} — 대화 ${lastCap.exchanges} → 후보 ${lastCap.candidates} → 저장 ${lastCap.saved}건` + (lastCap.skipped ? ` (건너뜀: ${lastCap.skipped})` : '')
      : `❌ ${fmtTime(lastCap.at)} — 실패: ${lastCap.error}`)
  : (fired ? '⚠️ 결과 기록 없음 — 설치된 훅이 구버전일 수 있어요(플러그인 갱신 필요)' : '아직 없음')));
const hookStale = !!(lastCap && expectedVer && lastCap.hookVersion && lastCap.hookVersion !== expectedVer);
if (hookStale) L(`훅 버전   : ⚠️ 설치된 훅 ${lastCap.hookVersion} ≠ 최신 ${expectedVer} — 플러그인을 업데이트하세요`);
const capGap = !!(fired && lastCap && statSync(probe).mtimeMs - Date.parse(lastCap.at) > 10 * 60 * 1000);
if (capGap) L('⚠️ 최근 세션이 끝났는데 그에 대한 캡처 결과 기록이 없어요 — 훅이 실패했거나 구버전 훅일 수 있어요');
L('플러그인 연결: ' + (pinned ? `설정됨 → ${pinned}` : '없음 (repo 제자리 실행이면 불필요 · /plugin 설치본이면 app 폴더에서 npm run plugin:pin 필요)'));
L('의미검색  : ' + (degraded
  ? `⚠️ 일시 중단 (${new Date(degraded.since).toLocaleString()}부터) — 키워드 검색만 동작`
  : '✅ 정상'));
L('검색 벡터 : ' + `${vecCount}/${total}건` + (missingVec ? `  ⚠️ ${missingVec}건 빠짐 → npm run reindex 로 채우세요` : '  ✅'));
if (degraded) L('   사유: ' + degraded.reason);
L('백업      : ' + (bks.length
  ? `총 ${bks.length}개 (서버시작 ${bkCount('startup')} · 위험작업 직전 ${bkCount('before')} · 직접 ${bkCount('manual')} · 이식용 ${bkCount('portable')}) · 가장 최근 ${newestDb ? fmtTime(newestDb.mtime) : '없음'}` + (badBks ? `  ⚠️ 열리지 않는 백업 ${badBks}개(손상 의심)` : '  ✅')
  : '⚠️ 아직 없어요 — npm run backup 으로 만들거나 서버를 한 번 켜 보세요'));
L('-------------- 최근 기억 5건 --------------');
if (!recent.length) L('(아직 없음)');
// 이 출력은 /o-brain:status로 AI에게도 전달된다 — 제어문자(터미널 이스케이프 시퀀스 포함)를 지우고 한 줄·200자로 줄이며(2026-10-21 독립 검토),
// 검토 전에 가져온 기억(source=import, 신뢰도 0.5 미만)은 표시해 AI가 "내가 확인한 기억"으로 오해하지 않게 한다.
const oneLine = s => { const t = String(s ?? '').replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim(); const cp = [...t]; return cp.length > 200 ? cp.slice(0, 200).join('') + '…' : t; };
for (const m of recent) L(`#${m.id} [${oneLine(m.type)}] ★${m.importance} ${oneLine(m.content)}${m.source === 'import' && !(m.confidence >= 0.5) ? ' ⚠️(가져온 뒤 아직 검토 안 함)' : ''}`);
L('==============================================');
const problems = !!(degraded || missingVec || hookStale || capGap || badBks || (lastCap && !lastCap.ok) || (fired && !lastCap));
if (problems) L('⚠️ 위에 ⚠️/❌로 표시된 항목을 확인해 주세요. (기억 자체는 안전하게 저장되어 있습니다.)');
else L(fired ? '✅ 훅이 작동했고 마지막 저장도 성공했습니다.' : 'ℹ️ 플러그인 설치 후 "대화 → 세션 종료"를 하면 여기에 자동으로 쌓입니다.');
