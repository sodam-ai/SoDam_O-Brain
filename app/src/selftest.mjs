// O-Brain 셀프테스트 — 두뇌(저장·시크릿가림·검색·감쇠·삭제·관계·그래프·최단경로·중복탐지)가 정상인지 한 방에 확인.
// 실제 기억은 건드리지 않도록 임시 DB 사용 후 정리.
process.env.OBRAIN_DATA_DIR = './spike/_selftest'; // db.mjs import 전에 설정(중요)

import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const testDir = join(here, '..', 'spike', '_selftest');
try { rmSync(testDir, { recursive: true, force: true }); } catch {}

// env 설정 후 동적 import(그래야 임시 DB로 열림)
const { openDb } = await import('./db.mjs');
const {
  addMemory, getMemory, deleteMemory,
  addRelation, listRelations, deleteRelation,
  findShortestPath, findExactDuplicates, applyConfidenceDecay,
} = await import('./store.mjs');
const { search } = await import('./search.mjs');
const { buildGraph } = await import('./graph.mjs');
const { captureSession } = await import('./extract-session.mjs');

let pass = true;
const check = (name, ok) => { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) pass = false; };

const db = openDb();
const secret = 'sk-SELFTEST1234567890ABCD';
const r = await addMemory(db, { content: `셀프테스트: 이 프로젝트 포트는 7740으로 정하자 (비밀 ${secret})`, type: '결정', importance: 4 });
check('1. 기억이 저장됨', !!r.id);

const saved = db.prepare('SELECT content FROM memory WHERE id=?').get(r.id).content;
check('2. 시크릿(sk-...) 자동 가림', !saved.includes(secret) && saved.includes('[REDACTED'));

const found = await search(db, '포트', 5);
check('3. 한국어 검색으로 다시 찾음', found.some(m => m.id === r.id));

// 4. 신뢰도 감쇠 — 마지막 실행을 40일 전으로 위조해 실제 감쇠가 일어나는지 확인
db.prepare("INSERT OR REPLACE INTO app_settings(key,value) VALUES('last_decay_at',?)")
  .run(new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString());
const decayed = applyConfidenceDecay(db);
const afterDecay = getMemory(db, r.id);
check('4. 신뢰도 감쇠(40일 경과 시뮬레이션)로 confidence 하락', decayed > 0 && afterDecay.confidence < 0.6);

// 5. 삭제 — 본체+FTS+벡터+관계까지 원자적으로 지워지는지
const del = await addMemory(db, { content: '셀프테스트: 삭제될 기억', type: '지식' });
deleteMemory(db, del.id);
check('5. 삭제 후 조회되지 않음', !getMemory(db, del.id));
check('5-1. 삭제 후 FTS 인덱스도 정리됨', !db.prepare('SELECT 1 FROM memory_fts WHERE rowid=?').get(del.id));

// 6. 관계 추가·조회·삭제 라운드트립
const m3 = await addMemory(db, { content: '셀프테스트: 체인 A', type: '결정' });
const m4 = await addMemory(db, { content: '셀프테스트: 체인 B', type: '결정' });
const rel = addRelation(db, { from_id: m3.id, to_id: m4.id, type: 'SUPPORTS' });
check('6. 관계 추가됨', rel.inserted === 1);
check('6-1. 목록 조회에 나타남', listRelations(db).some(x => x.id === rel.id));
deleteRelation(db, rel.id);
check('6-2. 삭제 후 목록에서 사라짐', !listRelations(db).some(x => x.id === rel.id));

// 7. SUPERSEDES 특수동작 — 대체된 기억이 자동으로 무효화되는지
const mA = await addMemory(db, { content: '셀프테스트: 옛 결정', type: '결정' });
const mB = await addMemory(db, { content: '셀프테스트: 새 결정', type: '결정' });
addRelation(db, { from_id: mB.id, to_id: mA.id, type: 'SUPERSEDES' });
// getMemory()는 valid_until을 반환 안 함(MEM_COLS에 없음) — DB 원본 컬럼을 직접 조회해 실제 반영 확인
const oldMemRaw = db.prepare('SELECT valid_until, invalidated_by FROM memory WHERE id=?').get(mA.id);
check('7. SUPERSEDES로 대체된 기억이 valid_until 설정됨', !!oldMemRaw.valid_until && oldMemRaw.invalidated_by === mB.id);

// 8~9. 그래프 빌드 + 최단경로(정상 케이스) — A-B-C 체인
const gA = await addMemory(db, { content: '셀프테스트: 경로 시작', type: '결정' });
const gB = await addMemory(db, { content: '셀프테스트: 경로 중간', type: '결정' });
const gC = await addMemory(db, { content: '셀프테스트: 경로 끝', type: '결정' });
addRelation(db, { from_id: gA.id, to_id: gB.id, type: 'SUPPORTS' });
addRelation(db, { from_id: gB.id, to_id: gC.id, type: 'SUPPORTS' });

const graph = buildGraph(db, { limit: 100 });
check('8. 그래프에 관계선이 반영됨', graph.relCount >= 2 && graph.nodes.some(n => n.id === gA.id));

const path = findShortestPath(db, gA.id, gC.id);
check('9. 최단경로가 A→B→C 3단계로 발견됨', path.found && path.path.length === 3 && path.path[1].id === gB.id);

// 10. 최단경로(미연결 케이스) — 고립된 기억까지는 경로가 없어야 함
const isolated = await addMemory(db, { content: '셀프테스트: 고립된 기억', type: '지식' });
const noPath = findShortestPath(db, gA.id, isolated.id);
check('10. 연결 안 된 기억 사이엔 경로 없음(found=false)', noPath.found === false && noPath.path.length === 0);

// 11. 완전일치 중복탐지 — 같은 내용, 다른 프로젝트(같은 프로젝트면 addMemory 자체가 재저장을 건너뜀)
const dupContent = '셀프테스트: 완전히 같은 내용의 기억';
const dupA = await addMemory(db, { content: dupContent, type: '지식', project: 'testA' });
const dupB = await addMemory(db, { content: dupContent, type: '지식', project: 'testB' });
const dupResult = findExactDuplicates(db, 30, 100);
const dupIds = new Set(dupResult.pairs.flatMap(p => [p.a.id, p.b.id]));
check('11. 완전일치 중복 쌍이 탐지됨', dupIds.has(dupA.id) && dupIds.has(dupB.id));

// 12~16. 사람이 쓴 글만 기억 후보로(2026-10-20) — 합성 대화 기록(.jsonl)을 격리 폴더에 만들어 captureSession을 끝까지 실행.
// 실제 측정: 후보의 71.5%가 프로그램 호출(sdk) 세션, 23.1%가 사람 세션 안의 비사람 턴(origin≠human·isMeta)에서 나왔다.
delete process.env.OBRAIN_CAPTURE_SDK; // .env.local에 켜져 있어도 이 테스트는 "기본값(꺼짐)"을 검사해야 하므로 고정
const txDir = join(testDir, 'tx'); mkdirSync(txDir, { recursive: true });
const urec = (text, extra = {}) => ({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] }, ...extra });
const arec = (text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const writeTx = (name, recs) => { const p = join(txDir, name + '.jsonl'); writeFileSync(p, recs.map(r => JSON.stringify(r)).join('\n') + '\n'); return p; };
const savedText = r => r.saved.map(s => s.content).join(' | ');

const sdkTx = writeTx('sdk', [urec('셀프테스트 SDK: 로그 폴더는 절대 지우지 마', { entrypoint: 'sdk-py' }), arec('알겠습니다')]);
const r12 = await captureSession({ transcriptPath: sdkTx, projectPath: 'C:\\selftest\\sdk' });
check('12. 프로그램이 호출한(sdk) 세션은 기억 후보를 만들지 않음(기본)', r12.skipped === 'sdk-session' && r12.candidates === 0 && r12.saved.length === 0);
check('12-1. 그 세션 행은 tool=claude-code-sdk로 구분 기록됨', db.prepare('SELECT tool FROM session WHERE id=?').get(r12.session_id)?.tool === 'claude-code-sdk');

process.env.OBRAIN_CAPTURE_SDK = '1';
const r13 = await captureSession({ transcriptPath: sdkTx, projectPath: 'C:\\selftest\\sdk' });
delete process.env.OBRAIN_CAPTURE_SDK;
check('13. OBRAIN_CAPTURE_SDK=1이면 sdk 세션도 현행처럼 저장', !r13.skipped && savedText(r13).includes('로그 폴더'));

const mixTx = writeTx('mixed', [
  urec('셀프테스트 사람: 백업 폴더는 매일 확인하기로 했다', { entrypoint: 'cli', origin: { kind: 'human' } }),
  urec('셀프테스트 동료: 배포는 금요일에 하지 마', { entrypoint: 'cli', origin: { kind: 'peer' }, isMeta: true }),
  urec('셀프테스트 알림: 캐시는 절대 지우지 마', { entrypoint: 'cli', origin: { kind: 'task-notification' } }),
]);
const r14 = await captureSession({ transcriptPath: mixTx, projectPath: 'C:\\selftest\\mixed' });
check('14. 사람 세션 안의 동료(peer)·알림·isMeta 턴은 제외하고 사람 턴만 저장',
  savedText(r14).includes('백업 폴더') && !savedText(r14).includes('배포는 금요일') && !savedText(r14).includes('캐시는') &&
  r14.dropped.meta === 1 && r14.dropped['origin:task-notification'] === 1);

const legacyTx = writeTx('legacy', [urec('셀프테스트 구버전: 캐시 폴더 이름은 tmp로 정했다'), arec('네')]);
const r15 = await captureSession({ transcriptPath: legacyTx, projectPath: 'C:\\selftest\\legacy' });
check('15. 표식이 없는 구버전 기록은 현행 그대로 저장(하위호환)', savedText(r15).includes('구버전') && Object.keys(r15.dropped).length === 0);

const unkTx = writeTx('unknown', [urec('셀프테스트 미지: 알림음은 끄기로 정했다', { entrypoint: 'cli', origin: { kind: 'voice-input' } })]);
const r16 = await captureSession({ transcriptPath: unkTx, projectPath: 'C:\\selftest\\unknown' });
check('16. 알 수 없는 origin 종류는 사람으로 간주해 저장하고 개수를 남김', savedText(r16).includes('알림음') && r16.unknownOrigins['voice-input'] === 1);

db.close();
try { rmSync(testDir, { recursive: true, force: true }); } catch {}

console.log('\n' + (pass
  ? '🎉 셀프테스트 통과 — O-Brain 두뇌가 정상 작동합니다.'
  : '⚠️ 일부 실패 — 위 ❌ 항목을 알려주세요.'));
process.exit(pass ? 0 : 1);
