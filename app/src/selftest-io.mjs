// 가져오기·내보내기·백업 셀프테스트(M77~M79). selftest.mjs가 같은 임시 DB·check()를 넘겨 호출한다(단독 실행 X).
// 실제 기억은 건드리지 않음 — 호출부가 OBRAIN_DATA_DIR을 임시 폴더로 잡은 뒤 이 모듈을 import한다.
import { gunzipSync } from 'node:zlib';
import { existsSync, statSync, rmSync, readFileSync, readdirSync as readDir, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function runExportTests({ db, check, addMemory, addRelation }) {
  const { buildExport, exportMemories, selectMemories, FORMATS, CSV_HEADERS } = await import('./export.mjs');
  const { parseCsv, unguardCell } = await import('./csv.mjs');

  // 일부러 까다로운 내용: 수식 시작 문자 · HTML 태그 · 따옴표/쉼표/빈 줄 · 한글
  const contents = {
    formula: '=HYPERLINK("http://example.invalid","클릭")',
    html: '<script>alert(1)</script> & "인용" <b>굵게</b>',
    multi: '첫 줄\n\n둘째 줄, 쉼표와 "따옴표" 포함',
    plus: '+1 증가, -5% 감소, @멘션',
    plain: '내보내기 시험용 평범한 한국어 문장',
  };
  const ids = {};
  for (const [k, v] of Object.entries(contents)) {
    const r = await addMemory(db, { content: (k === 'formula' || k === 'plus' ? '' : 'IO시험 ') + v, type: k === 'plain' ? '선호' : '결정', importance: 4, project: k === 'plain' ? 'D:\\io\\P2' : 'D:\\io\\P1' });
    ids[k] = r.id;
  }
  addRelation(db, { from_id: ids.multi, to_id: ids.html, type: 'SUPPORTS' });
  const mine = Object.values(ids);
  const scopeMine = { mode: 'ids', ids: mine };
  const dec = b => new TextDecoder('utf-8').decode(b);

  // 1) CSV — BOM·머리글·수식 방어·왕복
  const csv = buildExport(db, { format: 'csv', scope: scopeMine });
  const csvText = dec(csv.bytes);
  const parsed = parseCsv(csvText.replace(/^\uFEFF/, ''));
  const body = parsed.rows.slice(1);
  const contentCol = CSV_HEADERS.indexOf('내용');
  check('25. CSV: UTF-8 BOM으로 시작(엑셀 한글)·머리글 한글·행 수 일치',
    csv.bytes[0] === 0xEF && csv.bytes[1] === 0xBB && csv.bytes[2] === 0xBF && parsed.rows[0].cells.join('|') === CSV_HEADERS.join('|') && body.length === mine.length && !parsed.unterminated);
  check('25-1. CSV: 쉼표·따옴표·빈 줄이 든 내용이 왕복 후 그대로(수식 방어 접두 제거 포함)',
    body.every(r => { const id = Number(r.cells[0]); const orig = db.prepare('SELECT content FROM memory WHERE id=?').get(id).content; return unguardCell(r.cells[contentCol]) === orig; }));
  check('25-3. CSV: 실제 내보낸 파일에서 = 와 + 로 시작하는 기억이 수식으로 읽히지 않게 접두 \' 가 붙음',
    csvText.includes(`"'=HYPERLINK(`) && csvText.includes(`"'+1 증가`) && !/(^|,)=HYPERLINK/m.test(csvText));
  const { csvCell } = await import('./csv.mjs'); // 방어 규칙 전체는 순수 함수로도 확인
  check('25-2. CSV 수식 방어: = + - @ 탭 CR로 시작하는 칸은 앞에 \' 가 붙고, 읽을 때 되돌려짐',
    ['=1+1', '+SUM(A1)', '-2', '@x', '\tx', '\rx'].every(s => csvCell(s).replace(/^"|"$/g, '').startsWith("'") && unguardCell(csvCell(s).replace(/^"|"$/g, '').replace(/""/g, '"')) === s)
    && csvCell('평범') === '평범' && csvCell("'따옴표로 시작") === "'따옴표로 시작" && unguardCell("'따옴표로 시작") === "'따옴표로 시작");

  // 2) HTML — 스크립트 실행 불가·이스케이프·CSP
  const html = dec(buildExport(db, { format: 'html', scope: scopeMine }).bytes);
  check('26. HTML: 기억 속 <script>가 실행 불가(태그 이스케이프) · CSP default-src none · 스크립트 태그 0개',
    !/<script/i.test(html) && html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes("default-src 'none'") && html.includes('<html lang="ko">'));
  check('26-1. HTML: 관계가 번복·뒷받침 같은 쉬운 말로 표시되고 앵커로 이어짐', html.includes('뒷받침') && html.includes(`href="#m${ids.html}"`));

  // 3) JSON / JSONL / MD / TXT 구조
  const js = JSON.parse(dec(buildExport(db, { format: 'json', scope: scopeMine }).bytes));
  check('27. JSON: format·count·memories·relations 구조(기존 키 유지) + 관계 1건', js.format === 'obrain-export' && js.count === mine.length && js.memories.length === mine.length && js.relations.length === 1 && typeof js.exportedAt === 'string' && typeof js.note === 'string');
  const jl = dec(buildExport(db, { format: 'jsonl', scope: scopeMine }).bytes).trim().split('\n').map(l => JSON.parse(l));
  check('27-1. JSONL: 한 줄에 한 객체(기억 5 + 관계 1)', jl.filter(o => o.content).length === mine.length && jl.filter(o => o.relation).length === 1);
  const md = dec(buildExport(db, { format: 'md', scope: scopeMine }).bytes);
  check('27-2. 마크다운: 기억마다 "## #id [유형]" 머리글 + 관계 줄', mine.every(id => md.includes(`## #${id} [`)) && /- 관계\(SUPPORTS\) → #\d+/.test(md));
  const txt = dec(buildExport(db, { format: 'txt', scope: scopeMine }).bytes);
  const paras = txt.trim().split(/\n\s*\n/);
  check('27-3. TXT: "[유형] 내용" 단락이 기억 수만큼(내용 안의 빈 줄은 단락 경계를 깨지 않음)', paras.length === mine.length && paras.every(p => /^\[(결정|선호|제약|패턴|지식)\] /.test(p)));

  // 4) 범위 · 경로 빼기 · gzip · 빈 선택
  check('28. 범위 ids: 고른 기억만, 관계는 양 끝이 모두 들어올 때만 포함',
    selectMemories(db, { mode: 'ids', ids: [ids.plain, ids.html] }).length === 2
    && JSON.parse(dec(buildExport(db, { format: 'json', scope: { mode: 'ids', ids: [ids.plain, ids.html] } }).bytes)).relations.length === 0
    && JSON.parse(dec(buildExport(db, { format: 'json', scope: { mode: 'ids', ids: [ids.multi, ids.html] } }).bytes)).relations.length === 1);
  check('28-1. 범위 project: 그 프로젝트의 기억만', selectMemories(db, { mode: 'project', project: 'D:\\io\\P2' }).map(m => m.id).join() === String(ids.plain));
  const stripped = JSON.parse(dec(buildExport(db, { format: 'json', scope: scopeMine, stripProject: true }).bytes));
  const strippedHtml = dec(buildExport(db, { format: 'html', scope: scopeMine, stripProject: true }).bytes);
  const strippedCsv = dec(buildExport(db, { format: 'csv', scope: scopeMine, stripProject: true }).bytes);
  check('28-2. 폴더 경로 빼기: JSON·HTML·CSV 어디에도 프로젝트 경로가 남지 않음',
    stripped.memories.every(m => m.project === null) && !JSON.stringify(stripped).includes('D:\\\\io') && !strippedHtml.includes('D:\\io') && !strippedCsv.includes('D:\\io') && stripped.projectsIncluded === false);
  const gz = buildExport(db, { format: 'json', scope: scopeMine, gzip: true });
  const unz = JSON.parse(dec(gunzipSync(gz.bytes)));
  check('28-3. gzip: .gz 이름·압축 풀면 같은 기억', gz.filename.endsWith('.json.gz') && gz.mime === 'application/gzip' && unz.memories.length === mine.length && gz.bytes[0] === 0x1f && gz.bytes[1] === 0x8b);
  let emptyErr = null; try { buildExport(db, { format: 'csv', scope: { mode: 'ids', ids: [999999] } }); } catch (e) { emptyErr = e; }
  check('28-4. 내보낼 기억이 없으면 한글 안내 오류(빈 파일을 조용히 만들지 않음)', !!emptyErr && emptyErr.code === 'EMPTY' && /[가-힣]/.test(emptyErr.message));
  check('28-5. 형식 6종 모두 파일을 만든다', Object.keys(FORMATS).length === 6 && Object.keys(FORMATS).every(f => buildExport(db, { format: f, scope: scopeMine }).bytes.length > 100));
  check('28-6. 모르는 형식 이름은 json으로(경로·확장자 주입 불가)', buildExport(db, { format: '../../x', scope: scopeMine }).format === 'json');

  // 5) 서버 저장 경로 — data/export 고정
  const saved = exportMemories(db, { format: 'csv', scope: scopeMine });
  const onDisk = existsSync(saved.path) && statSync(saved.path).size === saved.size && saved.path.startsWith(saved.dir) && !saved.file.includes('/') && !saved.file.includes('\\');
  check('29. 서버 저장: data/export 안에 파일이 생기고 크기가 일치(사용자 지정 경로 없음)', onDisk && readFileSync(saved.path).length === saved.size);
  try { rmSync(saved.path); } catch {}
  return { ids };
}

// ── M78 가져오기 ──────────────────────────────────────────
export async function runImportTests({ db, check, ids }) {
  const imp = await import('./import.mjs');
  const { buildExport } = await import('./export.mjs');
  const { deleteMemory, updateMemory } = await import('./store.mjs');
  const { search } = await import('./search.mjs');
  const { buildInjection } = await import('./inject.mjs');
  const { gzipSync } = await import('node:zlib');
  const { readdirSync } = await import('node:fs');
  const { DATA_DIR } = await import('./db.mjs');
  const enc = s => Buffer.from(s, 'utf8');
  const dec = b => new TextDecoder().decode(b);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const parse = (bytes, filename, extra = {}) => imp.parseImportFile({ bytes: Buffer.isBuffer(bytes) ? bytes : enc(bytes), filename, ...extra });
  const rejects = (bytes, filename, extra) => { try { parse(bytes, filename, extra); return null; } catch (e) { return e; } };
  const koreanReject = (bytes, filename, extra) => { const e = rejects(bytes, filename, extra); return !!e && e.code === 'IMPORT' && /[가-힣]/.test(e.message); };
  const waitJob = async id => { for (let i = 0; i < 600; i++) { const j = imp.getJob(id); if (j && (j.phase === 'done' || j.phase === 'error')) return j; await sleep(100); } return imp.getJob(id); };
  const mine = Object.values(ids);

  // 30. 왕복 — 내보낸 파일을 다시 읽으면 내용·유형·중요도·프로젝트가 원본과 정확히 같다(json·jsonl·csv·md, .gz 포함)
  const origin = new Map(db.prepare(`SELECT id, content, type, importance, project FROM memory WHERE id IN (${mine.map(() => '?').join(',')})`).all(...mine).map(r => [r.id, r]));
  const bad = [];
  for (const [f, name] of [['json', 'a.json'], ['jsonl', 'a.jsonl'], ['csv', 'a.csv'], ['md', 'a.md']]) {
    const p = parse(buildExport(db, { format: f, scope: { mode: 'ids', ids: mine } }).bytes, name);
    const same = p.rows.length === mine.length && p.rows.every(r => { const o = origin.get(r.oldId); return o && r.content === o.content && r.type === o.type && r.importance === o.importance && r.project === o.project; });
    if (!same) bad.push(f);
  }
  const gzP = parse(buildExport(db, { format: 'json', scope: { mode: 'ids', ids: mine }, gzip: true }).bytes, 'a.json.gz');
  if (!(gzP.gz && gzP.rows.length === mine.length && gzP.relations.length === 1)) bad.push('json.gz');
  check('30. 내보내기→가져오기 왕복: 4형식(+gz) 모두 내용·유형·중요도·프로젝트가 원본과 동일', bad.length === 0, bad.join(','));
  const relCounts = ['json', 'jsonl', 'md'].map(f => parse(buildExport(db, { format: f, scope: { mode: 'ids', ids: mine } }).bytes, 'r.' + f).relations.length);
  check('30-1. 관계도 json·jsonl·마크다운에서 왕복(1건)', relCounts.every(n => n === 1));
  const txtP = parse(buildExport(db, { format: 'txt', scope: { mode: 'ids', ids: mine } }).bytes, 'a.txt');
  check('30-2. TXT 왕복: 유형 말머리가 복원되고 내용 안의 빈 줄만 한 줄바꿈으로 줄어듦',
    txtP.rows.length === mine.length && txtP.rows.every(r => { const o = [...origin.values()].find(x => x.content.replace(/\n\s*\n+/g, '\n') === r.content); return o && o.type === r.type; }));

  // 31. 악성·깨진 파일은 전부 쉬운 한국어로 거부(저장 전에 막힘)
  const pdf = Buffer.concat([enc('%PDF-1.7\n'), Buffer.alloc(40, 65)]);
  const zip = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), enc('xx')]);
  const sqlite = Buffer.concat([enc('SQLite format 3'), Buffer.from([0]), enc('xxxx')]);
  const nul = Buffer.concat([enc('MZ'), Buffer.from([0x90, 0, 3, 0, 0, 0]), enc('나머지')]);
  const gzOfText = gzipSync(enc('내용\n안녕'));
  check('31. 확장자 화이트리스트: .exe·.js·.py·.xlsx·.db·.html·.zip·.pdf·.sql·확장자 없음·모르는 확장자 거부',
    ['a.exe', 'a.js', 'a.py', 'a.xlsx', 'a.db', 'a.html', 'a.zip', 'a.pdf', 'a.sql', 'memo', 'a.xyz', 'a.csv.exe'].every(n => koreanReject('내용\n안녕', n)));
  check('31-1. 이름만 바꾼 이진 파일(.txt인 PDF·zip·SQLite·실행파일·gz)은 내용 검사로 거부',
    koreanReject(pdf, 'a.txt') && koreanReject(zip, 'a.json') && koreanReject(sqlite, 'a.csv') && koreanReject(nul, 'a.txt') && koreanReject(gzOfText, 'a.txt'));
  check('31-2. MIME 검사: image/png·실행파일 MIME은 거부, text/plain·빈 값·octet-stream은 통과',
    koreanReject('내용', 'a.txt', { mime: 'image/png' }) && koreanReject('내용', 'a.txt', { mime: 'application/x-msdownload' }) && koreanReject('내용', 'a.txt', { mime: 'application/pdf' })
    && !rejects('내용', 'a.txt', { mime: 'text/plain; charset=utf-8' }) && !rejects('내용', 'a.txt', { mime: '' }) && !rejects('내용', 'a.txt', { mime: 'application/octet-stream' }));
  check('31-3. 크기·건수·글자 수 상한: 한도를 넘으면 거부(작은 한도로 시험)',
    koreanReject('abcdefghijklmnop', 'a.txt', { limits: { fileBytes: 10 } }) && koreanReject('a\n\nb\n\nc\n\nd', 'a.txt', { limits: { rows: 3 } })
    && koreanReject('', 'a.txt') && koreanReject(Buffer.alloc(0), 'a.txt'));
  const longP = parse(JSON.stringify([{ content: '짧은 내용' }, { content: '이 내용은 열 글자를 훨씬 넘는 아주 긴 내용입니다' }, { content: '또 짧음' }]), 'a.json', { limits: { contentChars: 10 } });
  check('31-4. 한 건이 너무 길면 그 건만 오류(줄 번호와 이유), 나머지는 계속', longP.rows.length === 2 && longP.errorTotal === 1 && longP.errors[0].line === 2 && /너무 길어요/.test(longP.errors[0].reason));
  const bomb = gzipSync(Buffer.alloc(300000, 97));
  const eBomb = rejects(bomb, 'a.txt.gz', { limits: { unpackedBytes: 100000 } });
  check('31-5. 압축을 풀면 한도를 넘는 .gz(압축폭탄)와 깨진 .gz는 거부', !!eBomb && eBomb.code === 'IMPORT' && /넘어서/.test(eBomb.message)
    && koreanReject(Buffer.concat([Buffer.from([0x1F, 0x8B, 8, 0]), enc('깨진데이터')]), 'a.txt.gz') && !rejects(gzOfText, 'ok.txt.gz'));
  check('31-6. 깨진 JSON·알 수 없는 구조·따옴표 안 닫힌 CSV·내용 열 없는 CSV는 안내와 함께 거부',
    koreanReject('{"a": ', 'a.json') && koreanReject('"그냥 문자열"', 'a.json') && koreanReject('내용,유형\n"안 닫힘,결정', 'a.csv') && koreanReject('번호,이름\n1,가\n2,나', 'a.csv'));
  const evil = parse('{"memories":[{"content":"PROTO시험","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"p2":1}}}]}', 'e.json');
  check('31-7. 프로토타입 오염 시도(__proto__·constructor)가 전역에 영향 없음, 허용 필드만 복사', ({}).polluted === undefined && Object.prototype.p2 === undefined && evil.rows.length === 1 && !('polluted' in evil.rows[0]));
  check('31-8. 파일 이름의 경로·제어문자는 제거되어 표시', imp.cleanFilename('..\\..\\x\\evil.txt') === 'evil.txt' && imp.cleanFilename('a/b/c\u0001d.csv') === 'cd.csv' && imp.cleanFilename('') === '이름 없음');

  // 31-9~10. [최종 점검 2026-10-21] 독립 검토에서 재현한 두 결함의 회귀 방지
  // 31-9: 값이 객체·배열이면 String()/Number()가 TypeError를 던져 500이 되던 것 → "읽을 수 없는 값"으로 세고 기본값을 쓴다.
  const tryParse = (bytes, name) => { try { return parse(bytes, name); } catch (e) { return e; } };
  const objP = tryParse(JSON.stringify([{ content: '객체값시험 하나', importance: { toString: 1 }, type: { a: 1 }, project: { toString: 1 }, source: [1], scope: { x: 1 }, created_at: { toString: 1 }, id: {}, invalidated_by: [] }]), 'o.json');
  const objRel = tryParse('{"memories":[{"content":"관계객체시험"}],"relations":[{"from_id":{"toString":1},"to_id":2,"type":{"a":1}},{"from_id":1,"to_id":[2],"type":"SUPPORTS"}]}', 'o2.json');
  const objL = tryParse('{"content":"한 줄","importance":{"toString":1}}\n{"relation":{"from_id":{"toString":1},"to_id":2,"type":"SUPPORTS"}}', 'o.jsonl');
  check('31-9. 객체·배열 값이 든 항목은 TypeError 없이 처리(내용은 받고 읽을 수 없는 값은 기본값)',
    !(objP instanceof Error) && objP.rows.length === 1 && objP.rows[0].importance === 3 && objP.rows[0].type === '지식'
    && !(objRel instanceof Error) && objRel.rows.length === 1 && !(objL instanceof Error) && objL.rows.length === 1);
  // 31-10: 한도(rows)를 넘는 파일은 끝까지 읽지 않고 중간에 멈춘다(작은 .gz가 순간 GB 단위 메모리를 쓰던 것) — 거부 메시지는 같은 형식.
  const nRows = n => Array.from({ length: n }, (_, i) => '행' + i);
  const manyJsonl = nRows(10).map(s => JSON.stringify({ content: s })).join('\n');
  const manyCsv = '내용\n' + nRows(10).join('\n');
  const manyPara = nRows(10).join('\n\n');
  const overflowOk = (bytes, name, extra) => { const e = rejects(bytes, name, { ...extra, limits: { rows: 3 } }); return !!e && e.code === 'IMPORT' && /3건을 넘어요/.test(e.message); };
  const fitsOk = (bytes, name, extra) => { try { return parse(bytes, name, { ...extra, limits: { rows: 3 } }).rows.length === 3; } catch { return false; } };
  check('31-10. 행 수 한도를 넘는 JSONL·CSV·TXT(단락·줄)·마크다운은 중간에 멈추고 같은 형식으로 거부, 한도 이내 파일은 그대로 받음',
    overflowOk(manyJsonl, 'a.jsonl') && overflowOk(manyCsv, 'a.csv') && overflowOk(manyPara, 'a.txt') && overflowOk(nRows(10).join('\n'), 'a.txt', { split: 'line' }) && overflowOk(manyPara, 'a.md')
    && fitsOk(nRows(3).map(s => JSON.stringify({ content: s })).join('\n'), 'a.jsonl') && fitsOk('내용\n' + nRows(3).join('\n'), 'a.csv') && fitsOk(nRows(3).join('\n\n'), 'a.txt'));

  // 32. 인코딩·구분자·형식 변형
  const cp949 = Buffer.concat([enc('content\n'), Buffer.from([0xB0, 0xA1, 0xB3, 0xAA])]);   // "가나"(CP949)
  const p949 = parse(cp949, 'k.csv');
  const u16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('내용,유형\n유니코드 시험,결정\n', 'utf16le')]);
  const pu16 = parse(u16, 'u.csv');
  check('32. 인코딩: CP949(한글 윈도우) CSV와 UTF-16 CSV를 읽음(CP949는 안내 문구 포함)', p949.rows[0]?.content === '가나' && p949.notes.some(n => /CP949/.test(n)) && pu16.rows[0]?.content === '유니코드 시험' && pu16.rows[0]?.type === '결정');
  const semi = parse('내용;유형;중요도\n세미콜론 시험;선호;5', 'e.csv');
  const tsv = parse('content\ttype\n탭 시험\t패턴', 'e.tsv');
  check('32-1. 엑셀식 세미콜론 CSV와 TSV 구분자 자동 판별', semi.rows[0]?.type === '선호' && semi.rows[0]?.importance === 5 && tsv.rows[0]?.type === '패턴');
  const guard = parse("내용\n'=1+1\n'-5도 이하\n'따옴표 글", 'g.csv');
  check("32-2. CSV 수식 방어 접두(') 되돌림: '=1+1 → =1+1, 일반 따옴표 글은 그대로", guard.rows.map(r => r.content).join('|') === "=1+1|-5도 이하|'따옴표 글");
  const headless = parse('첫 번째 기억\n두 번째 기억', 'h.csv');
  check('32-3. 머리글 없는 한 칸짜리 CSV는 모든 줄을 기억으로(안내 포함)', headless.rows.length === 2 && headless.notes.some(n => /머리글이 없는/.test(n)));
  const txt = parse('[결정] 첫 단락\n이어지는 줄\n\n\n[선호] 둘째 단락\n\n그냥 셋째', 'a.txt');
  const txtLine = parse('줄 하나\n\n줄 둘', 'a.txt', { split: 'line' });
  check('32-4. TXT: 빈 줄 기준 단락(말머리는 유형으로) / 줄 단위 선택', txt.rows.length === 3 && txt.rows[0].type === '결정' && txt.rows[0].content === '첫 단락\n이어지는 줄' && txt.rows[1].type === '선호' && txtLine.rows.length === 2);
  const md = parse('---\ntags: [a]\n---\n# 제목만\n\n## 소제목\n\n본문 하나\n\n- 목록 하나\n- 목록 둘', 'n.md');
  const mdLine = parse('# 제목\n- 항목 하나\n* 항목 둘\n1. 항목 셋', 'n.md', { split: 'line' });
  check('32-5. 마크다운: 머리말(front matter)·제목만 있는 단락 제외 / 줄 모드에서 목록 기호 제거',
    md.rows.length === 2 && md.rows[0].content === '본문 하나' && md.notes.some(n => /제목만/.test(n)) && mdLine.rows.map(r => r.content).join('|') === '항목 하나|항목 둘|항목 셋');
  const dates = parse(JSON.stringify([
    { content: 'd1', created_at: '2026.10.20' }, { content: 'd2', created_at: '2026-10-20T10:00:00+09:00' }, { content: 'd3', created_at: '2999-01-01' },
    { content: 'd4', created_at: '2026-13-45' }, { content: 'd5', confidence: '80%', importance: '9' }, { content: 'd6', confidence: 1.5, type: 'decision' }, { content: 'd7', created_at: '2026-10-20 25:00' }]), 'd.json');
  const R = dates.rows;
  check('32-6. 날짜·숫자 정규화: 점 구분·시간대 변환·미래 시각은 지금으로·잘못된 값은 기본값(+안내)',
    R[0].created_at === '2026-10-20 00:00:00' && R[1].created_at === '2026-10-20 01:00:00' && new Date(R[2].created_at.replace(' ', 'T') + 'Z').getTime() <= Date.now() + 5000
    && R[3].created_at === null && R[4].confidence === 0.8 && R[4].importance === 5 && R[5].confidence === null && R[5].type === '결정' && R[6].created_at === null && dates.notes.some(n => /기본값/.test(n)));

  // 33. 미리보기: 시크릿 가림·중복(DB·파일 안)·오류 요약 — 아직 DB는 그대로
  const before = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const existingText = db.prepare('SELECT content FROM memory ORDER BY id LIMIT 1').get().content;
  const fakeKey = 'sk-' + 'ABCDEFGHIJKLMNOPQRSTUV';
  const pvFile = JSON.stringify([{ content: '미리보기 시험 하나' }, { content: '미리보기 시험 하나' }, { content: existingText }, { content: '키가 든 기억 ' + fakeKey }, { content: 12 }, { content: ['배열'] }, { content: '   ' }]);
  const pv = imp.makePreview(db, parse(pvFile, 'pv.json'));
  check('33. 미리보기: 새것/DB 중복/파일 안 중복/가려진 시크릿/오류를 구분해 센다', pv.counts.new === 3 && pv.counts.dupDb === 1 && pv.counts.dupFile === 1 && pv.counts.redactedRows === 1 && pv.counts.invalid === 1 && pv.counts.empty === 1, JSON.stringify(pv.counts));
  check('33-1. 시크릿은 미리보기 단계에서 이미 가려져 있고(원문 없음), 미리보기만으로 DB가 바뀌지 않음',
    !JSON.stringify(pv).includes(fakeKey) && pv.samples.some(s => /REDACTED/.test(s.content)) && db.prepare('SELECT COUNT(*) n FROM memory').get().n === before);

  // 34. 실제 가져오기 — 신뢰해서(내 파일) 가져오면 필드·관계·날짜가 그대로 복원된다
  const fields = 'content, type, importance, confidence, source, project, category, scope, created_at, valid_from';
  const snap = db.prepare(`SELECT ${fields} FROM memory WHERE id IN (${mine.map(() => '?').join(',')}) ORDER BY content`).all(...mine);
  const jsonFile = buildExport(db, { format: 'json', scope: { mode: 'ids', ids: mine } }).bytes;
  for (const id of mine) deleteMemory(db, id);                                // 원본을 지우고 → 파일로 복원
  const pv1 = imp.makePreview(db, parse(jsonFile, 'obrain.json'));
  check('34. 원본을 지운 뒤 파일을 미리보기하면 5건 모두 새것, 관계 1건 사용 가능', pv1.counts.new === 5 && pv1.counts.dupDb === 0 && pv1.counts.relationsUsable === 1);
  const s1 = imp.startImport(db, { previewId: pv1.previewId, keepTrust: true });
  const j1 = await waitJob(s1.jobId);
  const sessRow = db.prepare("SELECT tool, project FROM session WHERE id = ?").get(j1.result?.batchId);
  check('34-1. 가져오기 성공: 5건 저장·관계 1건·벡터 모두 생성(의미검색 가능)·세션(tool=import)에 묶임',
    j1.phase === 'done' && j1.result.inserted === 5 && j1.result.relationsAdded === 1 && j1.result.vectorSkipped === 0 && sessRow?.tool === 'import' && /가져오기/.test(sessRow.project),
    JSON.stringify(j1).slice(0, 200));
  const after = db.prepare(`SELECT ${fields} FROM memory WHERE session_id = ? ORDER BY content`).all(j1.result.batchId);
  check('34-2. 신뢰 가져오기는 내용·유형·중요도·신뢰도·출처·프로젝트·분류·범위·저장시각을 그대로 복원', JSON.stringify(after) === JSON.stringify(snap));
  const newIds = db.prepare('SELECT id, content FROM memory WHERE session_id = ?').all(j1.result.batchId);
  const idOfC = s => newIds.find(r => r.content.includes(s))?.id;
  const relRow = db.prepare('SELECT type FROM relation WHERE from_id = ? AND to_id = ?').get(idOfC('둘째 줄'), idOfC('<script>'));
  check('34-3. 관계가 새 id로 다시 이어짐(첫 줄… SUPPORTS <script>…)', relRow?.type === 'SUPPORTS');
  check('34-4. 가져오기 직전 자동 백업(before-import)이 만들어짐', readdirSync(join(DATA_DIR, 'backup')).some(f => f.endsWith('-before-import.db')));
  check('34-5. 한 번 쓴 미리보기는 재사용 불가(이중 실행 방지)', (() => { try { imp.startImport(db, { previewId: pv1.previewId }); return false; } catch (e) { return e.code === 'IMPORT' && /만료/.test(e.message); } })());
  const inj1 = await buildInjection({ query: 'IO시험', max: 8 });
  check('34-6. 신뢰해서 가져온 기억은 새 대화 자동 주입 후보에 포함', !!inj1 && inj1.includes('IO시험'));

  // 35. 되돌리기
  const u1 = await imp.undoImport(db, j1.result.batchId);
  check('35. 되돌리기: 그 묶음 5건·관계·세션 행이 모두 사라짐(원본 5건은 앞에서 지웠으므로 전체는 시작 때보다 5건 적음)', u1.deleted === 5 && db.prepare('SELECT COUNT(*) n FROM memory WHERE session_id = ?').get(j1.result.batchId).n === 0
    && db.prepare('SELECT COUNT(*) n FROM session WHERE id = ?').get(j1.result.batchId).n === 0 && db.prepare('SELECT COUNT(*) n FROM relation WHERE from_id = ? OR to_id = ?').get(idOfC('둘째 줄'), idOfC('둘째 줄')).n === 0
    && db.prepare('SELECT COUNT(*) n FROM memory').get().n === before - 5);
  check('35-1. 이미 되돌린 가져오기를 다시 되돌리면 한글 안내', await imp.undoImport(db, j1.result.batchId).then(() => false, e => e.code === 'IMPORT' && /찾지 못했어요/.test(e.message)));

  // 36. 신뢰하지 않고(기본) 가져오기 — 검토 필요(0.4)·source=import, 새 대화 자동 주입에서 제외, 검색엔 보임, 열어서 저장하면 정식 기억
  const pv2 = imp.makePreview(db, parse(jsonFile, 'obrain.json'));
  const s2 = imp.startImport(db, { previewId: pv2.previewId });                // keepTrust 기본 false
  const j2 = await waitJob(s2.jobId);
  const rows2 = db.prepare('SELECT id, source, confidence, created_at, valid_until FROM memory WHERE session_id = ?').all(j2.result.batchId);
  check('36. 기본 가져오기: 전부 source=import·신뢰도 0.4(검토 필요), 저장시각은 파일 값 유지', j2.phase === 'done' && rows2.length === 5 && rows2.every(r => r.source === 'import' && r.confidence === 0.4) && rows2.every(r => r.created_at.length === 19));
  const inj2 = await buildInjection({ query: 'IO시험', max: 8 });
  const found2 = await search(db, 'IO시험', 10);
  check('36-1. 검토 전 가져온 기억은 새 대화 자동 주입에서 제외되지만 검색에는 보임(프롬프트 주입 방어선)', (!inj2 || !inj2.includes('IO시험')) && found2.length >= 3);
  const promote = db.prepare("SELECT id, content FROM memory WHERE session_id = ? AND content LIKE 'IO시험%' LIMIT 1").get(j2.result.batchId);
  await updateMemory(db, promote.id, { content: promote.content });
  const inj3 = await buildInjection({ query: 'IO시험', max: 8 });
  check('36-2. 사용자가 열어서 저장(편집)하면 user/1.0으로 승격되어 주입 대상이 됨', !!inj3 && inj3.includes(promote.content.slice(0, 20)));
  db.prepare("UPDATE session SET ended_at = datetime('now','-40 minutes') WHERE id = ?").run(j2.result.batchId);
  const lateErr = await imp.undoImport(db, j2.result.batchId).then(() => null, e => e);
  check('36-3. 30분이 지나면 자동 되돌리기를 막고(고친 기억 보호) 백업 복원 안내', !!lateErr && lateErr.code === 'IMPORT' && /30분/.test(lateErr.message) && /npm run restore/.test(lateErr.message)
    && db.prepare('SELECT COUNT(*) n FROM memory WHERE session_id = ?').get(j2.result.batchId).n === 5);
  db.prepare("UPDATE session SET ended_at = datetime('now') WHERE id = ?").run(j2.result.batchId);
  const u2 = await imp.undoImport(db, j2.result.batchId);
  check('36-4. 시간 안에서는 되돌리기 성공(승격한 것 포함 그 묶음 전부)', u2.deleted === 5);

  // 37. 원자성·동시 실행·만료·전부 중복
  const sessBefore = db.prepare("SELECT COUNT(*) n FROM session WHERE tool = 'import'").get().n;
  const memBefore = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const pvT = imp.makePreview(db, parse(JSON.stringify([{ content: '원자성 시험 A' }, { content: '원자성 시험 B' }, { content: '원자성 시험 C' }]), 't.json'));
  imp.getPreview(pvT.previewId).items[2].content = null;                      // 마지막 줄에서 저장이 실패하도록 의도적으로 망가뜨림
  const origErr = console.error; console.error = () => {};
  const sT = imp.startImport(db, { previewId: pvT.previewId });
  const jT = await waitJob(sT.jobId);
  console.error = origErr;
  check('37. 저장 도중 실패하면 전부 취소(0건 저장·세션 행도 없음)·한글 안내', jT.phase === 'error' && /[가-힣]/.test(jT.error) && db.prepare('SELECT COUNT(*) n FROM memory').get().n === memBefore
    && db.prepare("SELECT COUNT(*) n FROM session WHERE tool = 'import'").get().n === sessBefore && db.prepare("SELECT COUNT(*) n FROM memory_fts WHERE content LIKE '원자성 시험%'").get().n === 0);
  const pvA = imp.makePreview(db, parse('동시성 시험 A', 'a.txt')), pvB = imp.makePreview(db, parse('동시성 시험 B', 'b.txt'));
  const sA = imp.startImport(db, { previewId: pvA.previewId });
  const second = (() => { try { imp.startImport(db, { previewId: pvB.previewId }); return null; } catch (e) { return e; } })();
  const jA = await waitJob(sA.jobId);
  check('37-1. 가져오기는 한 번에 하나만(진행 중이면 두 번째는 한글 안내로 거부), 끝나면 다시 가능', !!second && /진행 중/.test(second.message) && jA.phase === 'done');
  const sB = imp.startImport(db, { previewId: pvB.previewId });
  const jB = await waitJob(sB.jobId);
  await imp.undoImport(db, jA.result.batchId); await imp.undoImport(db, jB.result.batchId);
  const pvX = imp.makePreview(db, parse('만료 시험', 'x.txt'));
  imp.getPreview(pvX.previewId).createdAt = Date.now() - 16 * 60 * 1000;
  check('37-2. 15분 지난 미리보기는 만료 안내', (() => { try { imp.startImport(db, { previewId: pvX.previewId }); return false; } catch (e) { return /만료/.test(e.message); } })());
  const pvDup = imp.makePreview(db, parse(existingText, 'd.txt'));
  check('37-3. 전부 이미 있는 기억이면 시작하지 않고 한글 안내', pvDup.counts.new === 0 && (() => { try { imp.startImport(db, { previewId: pvDup.previewId }); return false; } catch (e) { return /새로 가져올 기억이 없어요/.test(e.message); } })());

  // 38. 관계 규칙 — 새 기억과 이어진 관계만, 기존 기억을 가져오기로 "번복 처리"하지 않음
  const keep = db.prepare("SELECT id, content FROM memory ORDER BY id LIMIT 1").get();
  const relFile = JSON.stringify({ memories: [{ id: 1, content: keep.content }, { id: 2, content: '관계 시험 새 기억 가' }, { id: 3, content: '관계 시험 새 기억 나' }],
    relations: [{ from_id: 2, to_id: 1, type: 'SUPERSEDES' }, { from_id: 2, to_id: 3, type: 'SUPERSEDES' }, { from_id: 1, to_id: 3, type: 'SUPPORTS' }, { from_id: 9, to_id: 1, type: 'SUPPORTS' }, { from_id: 2, to_id: 3, type: 'WRONG' }] });
  const pvR = imp.makePreview(db, parse(relFile, 'rel.json'));
  const sR = imp.startImport(db, { previewId: pvR.previewId, keepTrust: true });
  const jR = await waitJob(sR.jobId);
  const keepRaw = db.prepare('SELECT valid_until FROM memory WHERE id = ?').get(keep.id);
  const nid = c => db.prepare('SELECT id, valid_until, invalidated_by FROM memory WHERE session_id = ? AND content = ?').get(jR.result.batchId, c);
  const ga = nid('관계 시험 새 기억 가'), na = nid('관계 시험 새 기억 나');
  check('38. 관계 규칙: 기존 기억을 번복 처리하지 않고(SUPERSEDES→기존 건너뜀), 새 기억끼리의 번복은 반영, 없는 id·모르는 유형은 무시',
    jR.result.relationsAdded === 2 && keepRaw.valid_until === null && na.valid_until !== null && na.invalidated_by === ga.id
    && !!db.prepare('SELECT 1 FROM relation WHERE from_id = ? AND to_id = ? AND type = ?').get(keep.id, na.id, 'SUPPORTS')
    && !db.prepare('SELECT 1 FROM relation WHERE from_id = ? AND to_id = ?').get(ga.id, keep.id), JSON.stringify(jR.result));
  await imp.undoImport(db, jR.result.batchId);
  check('38-1. 되돌리면 그 관계도 정확히 사라지고 기존 기억은 그대로', !db.prepare('SELECT 1 FROM relation WHERE from_id = ? OR to_id = ?').get(ga.id, ga.id) && db.prepare('SELECT COUNT(*) n FROM memory').get().n === memBefore
    && db.prepare('SELECT valid_until FROM memory WHERE id = ?').get(keep.id).valid_until === null);
}

// ── M79 백업·되돌리기 ─────────────────────────────────────
export async function runBackupTests({ db, check, testDir }) {
  const bk = await import('./backup.mjs');
  const imp = await import('./import.mjs');
  const { execFileSync, spawn } = await import('node:child_process');
  const { createServer } = await import('node:http');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const dir = bk.backupDir();
  const names = () => readDir(dir);
  const kinds = k => names().filter(f => bk.classifyBackup(f) === k);

  check('39. 백업 이름을 종류로 분류(자동·위험 작업 직전·직접·이식용, 모르는 파일은 무시)',
    bk.classifyBackup('obrain-2026-10-20T07-30-52-505Z-startup.db') === 'startup' && bk.classifyBackup('obrain-2026-08-09T06-50-33-593Z-before-dup-clean.db') === 'before'
    && bk.classifyBackup('obrain-2026-10-20T07-30-52-505Z-manual.db') === 'manual' && bk.classifyBackup('obrain-2026-10-20T07-30-52-505Z.db') === 'manual'
    && bk.classifyBackup('obrain-2026-10-20T07-30-52-505Z-portable.json.gz') === 'portable' && bk.classifyBackup('obrain.db-wal') === null && bk.classifyBackup('메모.txt') === null);

  // 40. 이전 결함: 태그 구분 없이 최신 7개만 남겨 직접 만든 백업도 자동 삭제됐다 → 종류별 회전
  const man = await bk.backupOnce({ tag: 'manual' });
  const made = []; for (let i = 0; i < 9; i++) made.push((await bk.backupOnce({ tag: 'startup' })).file);
  const bef = []; for (let i = 0; i < 8; i++) bef.push((await bk.backupOnce({ tag: 'before-delete' })).file);
  check('40. 자동 백업이 계속 쌓여도 종류별로만 회전(서버시작 7·위험작업직전 7) — 직접 만든 백업은 밀려나지 않음',
    kinds('startup').length === 7 && kinds('before').length === 7 && names().includes(man.file));
  check('40-1. 회전은 오래된 것부터 지움(가장 최근 것은 남고 가장 오래된 것은 사라짐)', names().includes(made[8]) && !names().includes(made[0]) && names().includes(bef[7]) && !names().includes(bef[0]));

  // 41. 목록: 종류·쉬운 이름·기억 건수·열림 확인, 읽기만 해도 찌꺼기 파일(-wal/-shm)을 남기지 않음
  const items = bk.listBackups();
  check('41. 백업 목록: 모든 백업이 열리고(ok) 기억 건수와 한글 종류 이름이 붙음', items.length > 10 && items.every(i => i.ok === true && i.memories > 0 && /[가-힣]/.test(i.label)) && ['startup', 'manual', 'before'].every(k => items.some(i => i.kind === k)));
  check('41-1. 목록을 읽어도 백업 폴더에 찌꺼기(-wal/-shm 등)가 생기지 않음', names().every(f => bk.classifyBackup(f) !== null));

  // 42. 이식용 백업(.json.gz) — 다른 PC로 옮기는 용도, 가져오기로 그대로 읽힘, 10개 보관
  const { addMemory } = await import('./store.mjs');
  await addMemory(db, { content: '이식용 백업 시험: 프로젝트 경로가 담겨야 해요', project: 'D:\\bk\\P', scope: 'project' });
  const total = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
  const pb = bk.portableBackup();
  const pItem = bk.listBackups().find(i => i.file === pb.file);
  const pParsed = imp.parseImportFile({ bytes: readFileSync(pb.dest), filename: pb.file });
  check('42. 이식용 백업: .json.gz가 만들어지고 기억 전체가 들었으며, 가져오기가 그대로 읽음(프로젝트 경로 포함)',
    pb.file.endsWith('-portable.json.gz') && pb.count === total && pItem?.kind === 'portable' && pItem.memories === total && pParsed.rows.length === total && pParsed.rows.some(r => r.project));
  for (let i = 0; i < 11; i++) bk.portableBackup();
  check('42-1. 이식용 백업은 10개까지만 보관(다른 종류는 그대로)', kinds('portable').length === 10 && kinds('startup').length === 7 && names().includes(man.file));

  // 43. 되돌리기(복원) — 이름·손상 검사, 열린 DB 보호
  const err = async f => { try { await bk.restoreFromBackup(f); return null; } catch (e) { return e; } };
  const garbage = 'obrain-2000-01-01T00-00-00-000Z-manual.db';
  writeFileSync(join(dir, garbage), '이건 SQLite 파일이 아니에요');
  const eName = await err('../../evil.db'), ePortable = await err(pb.file), eGarbage = await err(garbage);
  try { rmSync(join(dir, garbage)); } catch {}
  check('43. 복원 입력 검사: 경로조작 이름·이식용 파일·손상된 파일은 한글 안내로 거부(아무것도 안 바뀜)',
    [eName, ePortable, eGarbage].every(e => e && e.code === 'RESTORE' && /[가-힣]/.test(e.message)) && /손상/.test(eGarbage.message) && /알 수 없는/.test(eName.message));
  if (process.platform === 'win32') {
    const live = db.prepare('SELECT COUNT(*) n FROM memory').get().n;
    const eOpen = await err(man.file);
    check('43-1. 다른 프로그램이 데이터를 쥐고 있으면 교체에 실패하고 원래대로(파일 이동·찌꺼기 없음, 데이터 그대로)',
      !!eOpen && eOpen.code === 'RESTORE' && /쓰고 있어서/.test(eOpen.message) && db.prepare('SELECT COUNT(*) n FROM memory').get().n === live
      && !readDir(join(dir, '..')).some(f => /\.(replaced|restoring)-/.test(f)));
  } else check('43-1. (윈도우 전용 시험 — 이 OS에서는 건너뜀)', true);

  // 44. 실제 교체 — 별도 폴더에서 자식 프로세스로(열린 핸들 없이): 열린 DB 보호 → 교체 → 직전 상태로 재복원
  const rsDir = join(testDir, 'rs'); mkdirSync(rsDir, { recursive: true });
  const probe = join(testDir, 'restore_probe.mjs');
  writeFileSync(probe, `
    import { readdirSync } from 'node:fs';
    const [,, dbUrl, storeUrl, backupUrl, dataDir] = process.argv;
    const { openDb } = await import(dbUrl); const { addMemory } = await import(storeUrl); const bk = await import(backupUrl);
    const out = {};
    const db = openDb();
    for (let i = 1; i <= 3; i++) await addMemory(db, { content: '복원 시험 기억 ' + i });
    const b = await bk.backupOnce({ tag: 'manual' });
    for (let i = 4; i <= 5; i++) await addMemory(db, { content: '복원 시험 기억 ' + i });
    db.close();
    if (process.platform === 'win32') {
      const hold = openDb();
      try { await bk.restoreFromBackup(b.file); out.heldErr = 'none'; } catch (e) { out.heldErr = e.code; }
      out.heldCount = hold.prepare('SELECT COUNT(*) n FROM memory').get().n;
      hold.close();
      out.leftovers = readdirSync(dataDir).filter(f => /\\.(replaced|restoring)-/.test(f)).length;
    }
    const r = await bk.restoreFromBackup(b.file);
    const d2 = openDb();
    out.after = d2.prepare('SELECT COUNT(*) n FROM memory').get().n;
    out.fts = d2.prepare('SELECT COUNT(*) n FROM memory_fts').get().n;
    out.has4 = d2.prepare("SELECT COUNT(*) n FROM memory WHERE content LIKE '%기억 4'").get().n;
    d2.close();
    out.safety = r.safetyBackup; out.replaced = r.replaced.length; out.manual = b.file;
    const r2 = await bk.restoreFromBackup(r.safetyBackup);   // 되돌린 것을 취소 — 직전 상태로
    const d3 = openDb(); out.back = d3.prepare('SELECT COUNT(*) n FROM memory').get().n; d3.close();
    out.restoredAgain = !!r2.restored;
    console.log(JSON.stringify(out));
  `);
  const childEnv = { ...process.env, OBRAIN_DATA_DIR: rsDir, OBRAIN_EMBED_DISABLE: '1' };
  const here = fileURLToPath(new URL('.', import.meta.url));
  const u = f => pathToFileURL(join(here, f)).href;
  let po = null;
  try { po = JSON.parse(execFileSync(process.execPath, [probe, u('db.mjs'), u('store.mjs'), u('backup.mjs'), rsDir], { env: childEnv, encoding: 'utf8', stdio: 'pipe' }).trim().split('\n').pop()); }
  catch (e) { console.log('   (복원 시험 자식 프로세스 실패: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' | ') + ')'); }
  check('44. 복원: 백업 시점(3건)으로 교체되고(5건→3건)·검색 색인도 같이 되돌며·직전 상태 백업과 옛 파일이 옆에 보관됨',
    !!po && po.after === 3 && po.fts === 3 && po.has4 === 0 && /before-restore/.test(po.safety || '') && po.replaced >= 1, JSON.stringify(po));
  check('44-1. 직전 상태 백업으로 다시 복원하면 5건으로 돌아옴(되돌린 것도 되돌릴 수 있음)', !!po && po.back === 5 && po.restoredAgain === true);
  if (process.platform === 'win32') check('44-2. (윈도우) 열린 DB가 있는 상태의 복원은 실패하고 원상태 유지(데이터 5건·옆 파일 0개)', !!po && po.heldErr === 'RESTORE' && po.heldCount === 5 && po.leftovers === 0, JSON.stringify(po));

  // 45. npm run restore(CLI) — 서버 켜짐 거부 · 이름 오류 · 터미널 아님 · 이름 지정 end-to-end
  const cli = join(here, 'restore-cli.mjs');
  // 비동기 실행 — 같은 프로세스의 가짜 서버가 자식의 접속에 응답해야 하므로 spawnSync(이벤트 루프를 막음)를 쓰면 안 된다.
  const run = (args, env) => new Promise(res => {
    const p = spawn(process.execPath, [cli, ...args], { env: { ...childEnv, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    p.on('close', code => res({ status: code, stdout: out })); p.stdin.end();
  });
  const free = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const fake = createServer((q, r) => r.end('ok')); await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const busyPort = fake.address().port;
  const cBusy = await run(['whatever.db', '--yes'], { OBRAIN_PORT: String(busyPort) });
  fake.close();
  const cNone = await run(['없는백업.db', '--yes'], { OBRAIN_PORT: String(free) });
  const cTty = await run([], { OBRAIN_PORT: String(free) });
  check('45. CLI: 서버가 켜져 있으면 시작도 안 하고(안내), 없는 백업 이름·터미널이 아닌 실행은 한글로 거부(종료코드 1)',
    cBusy.status === 1 && /서버가 켜져 있어요/.test(cBusy.stdout) && cNone.status === 1 && /그런 백업이 없어요/.test(cNone.stdout) && cTty.status === 1 && /터미널에서 직접/.test(cTty.stdout));
  const man2 = readDir(join(rsDir, 'backup')).find(f => f === po?.manual);
  const cOk = man2 ? await run([man2, '--yes'], { OBRAIN_PORT: String(free) }) : { status: -1, stdout: '' };
  check('45-1. CLI 이름 지정 복원(--yes): 단계 안내·"되돌렸어요 — 기억 3건"·직전 백업과 옛 파일 안내·서버 재시작 안내',
    cOk.status === 0 && /되돌렸어요 — 기억 3건/.test(cOk.stdout) && /직전 상태 백업/.test(cOk.stdout) && /원래 파일은 옆에 남겨/.test(cOk.stdout) && /npm start/.test(cOk.stdout), String(cOk.stdout).slice(-300));
}
