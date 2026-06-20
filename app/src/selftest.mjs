// O-Brain 셀프테스트 — 두뇌(저장·시크릿가림·검색)가 정상인지 한 방에 확인.
// 실제 기억은 건드리지 않도록 임시 DB 사용 후 정리.
process.env.OBRAIN_DATA_DIR = './spike/_selftest'; // db.mjs import 전에 설정(중요)

import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const testDir = join(here, '..', 'spike', '_selftest');
try { rmSync(testDir, { recursive: true, force: true }); } catch {}

// env 설정 후 동적 import(그래야 임시 DB로 열림)
const { openDb } = await import('./db.mjs');
const { addMemory } = await import('./store.mjs');
const { search } = await import('./search.mjs');

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

db.close();
try { rmSync(testDir, { recursive: true, force: true }); } catch {}

console.log('\n' + (pass
  ? '🎉 셀프테스트 통과 — O-Brain 두뇌가 정상 작동합니다.'
  : '⚠️ 일부 실패 — 위 ❌ 항목을 알려주세요.'));
process.exit(pass ? 0 : 1);
