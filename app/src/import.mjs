// 가져오기 — JSON · JSONL · CSV/TSV · 마크다운 · TXT (+ 단일 파일 .gz). PRD 08 §4 "업로드 도입 시 확장자·MIME·크기 화이트리스트 + 실행 차단" 충족.
// 흐름: ① 파싱·검증(parseImportFile) → ② 시크릿 제거+중복 판정+미리보기(makePreview, 아직 DB 무변경)
//       → ③ 사용자가 확인하면 startImport: 자동 백업 → 임베딩 전부 계산 → 단일 트랜잭션 저장 → ④ undoImport(30분 안).
// 새 의존성 없음. 파일 내용은 어떤 경우에도 실행·평가하지 않고(JSON.parse·문자열 처리만) 허용한 필드 값만 복사한다(프로토타입 오염 방지).
import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { redact } from './redact.mjs';
import { embed, toBlob, embedMode } from './embed.mjs';
import { classify, CATEGORIES } from './classify.mjs';
import { parseCsv, detectDelimiter, unguardCell } from './csv.mjs';
import { backupOnce } from './backup.mjs';
import { deleteMemory, strictId } from './store.mjs';

export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,        // 올린 파일 최대
  unpackedBytes: 20 * 1024 * 1024,   // .gz를 풀었을 때 최대(압축폭탄 방어)
  rows: 5000,                        // 한 번에 가져올 기억 수
  contentChars: 5000,                // 기억 1건 길이
  projectChars: 300,
  errorSamples: 50,
};
export const UNDO_WINDOW_MS = 30 * 60 * 1000;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const MEM_TYPES = ['결정', '제약', '선호', '패턴', '지식'];
const TYPE_EN = { decision: '결정', constraint: '제약', preference: '선호', pattern: '패턴', knowledge: '지식' };
const REL_TYPES = ['SUPERSEDES', 'SUPPORTS', 'INFLUENCES', 'CONTRADICTS'];
const SOURCES = ['user', 'ai', 'rule', 'import'];
export const IMPORT_EXTS = ['json', 'jsonl', 'ndjson', 'csv', 'tsv', 'md', 'markdown', 'txt'];
const FORMAT_LABEL = { json: 'JSON', jsonl: 'JSON Lines', csv: 'CSV', tsv: 'TSV', md: '마크다운', txt: '텍스트' };

export class ImportError extends Error {
  constructor(msg) { super(msg); this.code = 'IMPORT'; }
}
const fail = msg => { throw new ImportError(msg); };

// ── 1. 이름·종류·내용 검사 ─────────────────────────────────
const HINT_SHEET = "엑셀 파일은 직접 읽지 않아요. 엑셀에서 '다른 이름으로 저장 → CSV UTF-8'로 저장한 뒤 올려 주세요.";
const HINT_DB = '이 파일은 백업(복원)용 파일이에요. 가져오기가 아니라 터미널(app 폴더)에서 npm run restore 로 되돌릴 수 있어요. 다른 PC로 옮기려면 내보내기의 JSON을 쓰세요.';
const HINT_HTML = 'HTML은 읽기·인쇄용 내보내기라서 가져오지 않아요. JSON이나 CSV로 내보낸 파일을 쓰세요.';
const HINT_DOC = 'PDF·문서 파일은 직접 읽지 않아요. 내용을 .txt나 .md로 저장해서 올려 주세요.';
const HINT_ARCHIVE = '압축 묶음(zip·7z·rar·tar)은 지원하지 않아요. 안의 파일을 꺼내 올리거나, 파일 하나를 압축한 .gz를 쓰세요.';
const REJECT_HINT = {
  xlsx: HINT_SHEET, xls: HINT_SHEET, db: HINT_DB, sqlite: HINT_DB,
  sql: 'SQL 파일은 열면 안에 든 명령이 실행될 수 있어 받지 않아요. 내보내기의 JSON·CSV를 쓰세요.',
  html: HINT_HTML, htm: HINT_HTML, pdf: HINT_DOC, doc: HINT_DOC, docx: HINT_DOC, pptx: HINT_DOC,
  zip: HINT_ARCHIVE, '7z': HINT_ARCHIVE, rar: HINT_ARCHIVE, tar: HINT_ARCHIVE,
};
const EXEC_EXT = new Set(['exe', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'msi', 'lnk', 'js', 'mjs', 'vbs', 'scr', 'com', 'jar', 'py']);

export function cleanFilename(raw) {
  let s = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  s = s.split(/[\\/]/).pop().trim();
  return (s || '이름 없음').slice(0, 120);
}

// 확장자 결정(.gz는 안쪽 확장자를 본다). 허용 목록 밖이면 쉬운 안내와 함께 거부.
function checkName(filename) {
  const name = cleanFilename(filename).toLowerCase();
  let gz = false, base = name;
  if (base.endsWith('.gz')) { gz = true; base = base.slice(0, -3); }
  const ext = base.includes('.') ? base.split('.').pop() : '';
  if (IMPORT_EXTS.includes(ext)) return { ext, gz };
  if (EXEC_EXT.has(ext)) fail('실행 파일이나 스크립트는 받지 않아요.');
  if (REJECT_HINT[ext]) fail(REJECT_HINT[ext]);
  return fail(`이 파일 종류(${ext ? '.' + ext : '확장자 없음'})는 지원하지 않아요. 지원: .json .jsonl .csv .tsv .md .txt (+ .gz로 압축한 것)`);
}

const MIME_OK = /^(text\/.+|application\/(json|x-ndjson|ndjson|jsonl|csv|vnd\.ms-excel|gzip|x-gzip|x-gunzip|octet-stream)|binary\/octet-stream)$/;
function checkMime(mime) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m && !MIME_OK.test(m)) fail('파일 종류(MIME)가 텍스트 파일이 아니에요. 내용을 .txt/.csv/.json 으로 저장해서 올려 주세요.');
}

// 이진 파일 "머리표(매직 바이트)" — 이름만 .txt로 바꾼 실행·압축·그림·문서를 걸러낸다. (MZ 같은 짧은 글자 머리는 일반 글과 겹치므로 NUL 검사에 맡김)
const MAGICS = [
  [[0x50, 0x4B, 0x03, 0x04], '압축·오피스 파일'], [[0x25, 0x50, 0x44, 0x46, 0x2D], 'PDF 파일'],
  [[0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00], '데이터베이스 파일'],
  [[0x89, 0x50, 0x4E, 0x47], '그림 파일'], [[0xFF, 0xD8, 0xFF], '그림 파일'], [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], '그림 파일'], [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], '그림 파일'],
  [[0x1F, 0x8B], '압축 파일'], [[0x52, 0x61, 0x72, 0x21], '압축 파일'], [[0x37, 0x7A, 0xBC, 0xAF], '압축 파일'], [[0xD0, 0xCF, 0x11, 0xE0], '오피스 파일'],
];
const startsWith = (b, sig) => b.length >= sig.length && sig.every((v, i) => b[i] === v);
function sniffBinary(b) {
  for (const [sig, what] of MAGICS) if (startsWith(b, sig)) fail(`텍스트 파일이 아니에요(${what}처럼 보여요). 내용을 텍스트로 저장해서 올려 주세요.`);
  const utf16 = startsWith(b, [0xFF, 0xFE]) || startsWith(b, [0xFE, 0xFF]);
  if (!utf16) { const n = Math.min(b.length, 8192); for (let i = 0; i < n; i++) if (b[i] === 0) fail('텍스트 파일이 아니에요(이진 데이터가 들어 있어요).'); }
}

function decodeText(b, notes) {
  if (startsWith(b, [0xFF, 0xFE])) return new TextDecoder('utf-16le').decode(b);
  if (startsWith(b, [0xFE, 0xFF])) return new TextDecoder('utf-16be').decode(b);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { /* 다음 후보 */ }
  try {
    const t = new TextDecoder('euc-kr', { fatal: true }).decode(b);
    notes.push('글자 인코딩이 UTF-8이 아니어서 한글 윈도우 방식(CP949)으로 읽었어요. 글자가 깨져 보이면 UTF-8로 다시 저장해 올려 주세요.');
    return t;
  } catch { /* 아래에서 안내 */ }
  return fail('글자 인코딩을 알 수 없어요. UTF-8로 저장해서 다시 올려 주세요.');
}

// ── 2. 필드 이름 표준화·값 정규화 ──────────────────────────
const ALIASES = {
  content: ['content', '내용', 'text', 'memo', '메모', '본문', 'note', 'body'],
  type: ['type', '유형', '종류'],
  importance: ['importance', '중요도'],
  confidence: ['confidence', '신뢰도'],
  source: ['source', '출처'],
  project: ['project', '프로젝트'],
  category: ['category', '분류', '카테고리'],
  scope: ['scope', '범위'],
  created_at: ['created_at', 'createdat', 'created', '저장시각', '저장', '날짜', 'date', '작성일'],
  valid_from: ['valid_from', '유효시작'],
  valid_until: ['valid_until', '유효종료'],
  id: ['id', '번호'],
  invalidated_by: ['invalidated_by'],
};
const ALIAS_MAP = new Map();
for (const [k, list] of Object.entries(ALIASES)) for (const a of list) ALIAS_MAP.set(a.toLowerCase(), k);
const canonKey = k => ALIAS_MAP.get(String(k).trim().toLowerCase());
function canon(obj) { // 허용한 필드만 값 복사 — 파일 속 다른 키(__proto__ 등)는 버린다
  const out = {};
  for (const k of Object.keys(obj)) { const f = canonKey(k); if (f && !(f in out)) out[f] = obj[k]; }
  return out;
}

const blank = v => v == null || (typeof v === 'string' && !v.trim());
// 0~1 그대로, "80%" 또는 정수 2~100("80")은 퍼센트로 본다. "1.5"처럼 어느 쪽도 아닌 값은 읽을 수 없는 값(NaN) — 0.015로 잘못 바꾸지 않는다.
function parseConfidence(v) {
  if (blank(v)) return null;
  let n, pct = false;
  if (typeof v === 'number') n = v;
  else { const s = String(v).trim(); pct = s.endsWith('%'); n = Number(s.replace('%', '')); }
  if (!Number.isFinite(n)) return NaN;
  if (pct) n /= 100;
  else if (n > 1) { if (Number.isInteger(n) && n <= 100) n /= 100; else return NaN; }
  return n >= 0 && n <= 1 ? n : NaN;
}
const pad2 = n => String(n).padStart(2, '0');
// 'YYYY-MM-DD[ T]HH:MM[:SS]' · 2026.10.20 · 2026/10/20 · ISO(Z/오프셋). 반환: 'YYYY-MM-DD HH:MM:SS' | null(없음) | NaN(읽을 수 없음).
function parseDateTime(v) {
  if (blank(v)) return null;
  const s = String(v).trim().replace(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/, '$1-$2-$3');
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (!m) return NaN;
  const [, Y, Mo, D, h = '0', mi = '0', se = '0', tz] = m;
  if (+h > 23 || +mi > 59 || +se > 59) return NaN;
  let d = new Date(Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +se));
  if (d.getUTCFullYear() !== +Y || d.getUTCMonth() !== +Mo - 1 || d.getUTCDate() !== +D) return NaN;
  if (tz && tz.toUpperCase() !== 'Z') { const sign = tz[0] === '-' ? -1 : 1; const digits = tz.replace(/[^0-9]/g, ''); d = new Date(d.getTime() - sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4)) * 60000); }
  if (d.getUTCFullYear() < 1990) return NaN;
  if (d.getTime() > Date.now() + 86400000) d = new Date(); // 미래 시각으로 "최신"인 척하지 못하게 지금으로 고정
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

// 한 항목 → { row } | { empty } | { err }. counters는 "값이 이상해 기본값으로 바꾼 횟수".
function normalizeItem(rawItem, counters) {
  let o;
  if (typeof rawItem === 'string') o = { content: rawItem };
  else if (rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem)) o = canon(rawItem);
  else return { err: '항목 형식이 올바르지 않아요' };
  // 내용 말고는 글자·숫자·불리언만 인정한다 — 값이 객체·배열이면(예: {"toString":1}) 아래의 String()/Number()가 TypeError를 던져
  // "가져오기에 실패했어요"(500)로 끝났다(2026-10-21 독립 검토 재현). 읽을 수 없는 값으로 세고 기본값으로 대신한다.
  for (const k of Object.keys(o)) if (k !== 'content' && o[k] !== null && typeof o[k] === 'object') { o[k] = null; counters.badValues++; }
  let content = o.content;
  if (blank(content)) return { empty: true };
  if (typeof content === 'number' || typeof content === 'boolean') content = String(content);
  if (typeof content !== 'string') return { err: '내용이 글자가 아니에요' };
  content = content.replace(/\r\n?/g, '\n').trim();
  if (content.length > counters.limits.contentChars) return { err: `내용이 너무 길어요(${counters.limits.contentChars.toLocaleString('ko-KR')}자 초과)` };

  const t = blank(o.type) ? '' : String(o.type).trim();
  let type = '지식';
  if (MEM_TYPES.includes(t)) type = t;
  else if (TYPE_EN[t.toLowerCase()]) type = TYPE_EN[t.toLowerCase()];
  else if (t) counters.typeFallback++;

  let importance = 3;
  if (!blank(o.importance)) { const n = Number(o.importance); if (Number.isFinite(n)) importance = Math.min(5, Math.max(1, Math.round(n))); else counters.badValues++; }
  let confidence = parseConfidence(o.confidence);
  if (Number.isNaN(confidence)) { counters.badValues++; confidence = null; }

  const sRaw = blank(o.source) ? null : String(o.source).trim().toLowerCase();
  const source = sRaw && SOURCES.includes(sRaw) ? sRaw : null;

  const project = blank(o.project) ? null : String(o.project).trim();
  if (project && project.length > counters.limits.projectChars) return { err: '프로젝트 값이 너무 길어요' };
  const catRaw = blank(o.category) ? null : String(o.category).trim();
  const category = catRaw && CATEGORIES.includes(catRaw) ? catRaw : null;
  const scRaw = blank(o.scope) ? null : String(o.scope).trim().toLowerCase();
  let scope = scRaw === 'project' || scRaw === 'global' ? scRaw : null;
  if (scope === 'project' && !project) scope = 'global';

  const dt = parseDateTime(o.created_at); if (Number.isNaN(dt)) counters.badValues++;
  const vf = parseDateTime(o.valid_from); if (Number.isNaN(vf)) counters.badValues++;
  const vu = parseDateTime(o.valid_until); if (Number.isNaN(vu)) counters.badValues++;
  const idN = Number(o.id), ibN = Number(o.invalidated_by);
  return { row: {
    content, type, importance, confidence, source, project, category, scope,
    created_at: typeof dt === 'string' ? dt : null,
    valid_from: typeof vf === 'string' ? vf.slice(0, 10) : null,
    valid_until: typeof vu === 'string' ? vu.slice(0, 10) : null,
    oldId: Number.isInteger(idN) && idN > 0 && !blank(o.id) ? idN : null,
    invalidatedByOld: Number.isInteger(ibN) && ibN > 0 && !blank(o.invalidated_by) ? ibN : null,
  } };
}

// ── 3. 형식별 파서: { items:[{raw,line}], relations:[{from,to,type}] } ────────
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const jsonPosHint = (e, text) => {
  const msg = String(e && e.message);
  let m = /line (\d+) column/.exec(msg);
  if (m) return ` (${m[1]}번째 줄 근처)`;
  m = /position (\d+)/.exec(msg);
  return m ? ` (${text.slice(0, Number(m[1])).split('\n').length}번째 줄 근처)` : '';
};
// 관계 값도 글자·숫자만 읽는다(객체면 Number()/String()이 TypeError를 던짐) — 읽을 수 없으면 NaN/빈 글자로 두어 아래 단계가 건너뛴다.
const relNum = v => (typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN);
const relFrom = r => (isObj(r) ? { from: relNum(r.from_id ?? r.from), to: relNum(r.to_id ?? r.to), type: typeof r.type === 'string' ? r.type.toUpperCase() : '' } : null);

function parseJsonDoc(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { fail('JSON 형식이 올바르지 않아요' + jsonPosHint(e, text) + '. 파일이 중간에 잘렸거나 쉼표·괄호가 빠졌을 수 있어요.'); }
  if (Array.isArray(data)) return { items: data.map((raw, i) => ({ raw, line: i + 1 })), relations: [] };
  if (isObj(data) && Array.isArray(data.memories)) {
    return { items: data.memories.map((raw, i) => ({ raw, line: i + 1 })), relations: (Array.isArray(data.relations) ? data.relations : []).map(relFrom).filter(Boolean) };
  }
  if (isObj(data) && Object.keys(data).some(k => canonKey(k) === 'content')) return { items: [{ raw: data, line: 1 }], relations: [] };
  return fail('알 수 없는 JSON 구조예요. O-Brain에서 내보낸 JSON, 또는 {"content": "…"} 객체 목록이어야 해요.');
}

// 줄을 split()으로 한꺼번에 쪼개지 않고 하나씩 읽는다 — 한도(maxItems)를 넘으면 거기서 멈춰, 줄이 수백만 개인 파일이 메모리를 한꺼번에 차지하지 않게 한다
// (2026-10-21 독립 검토: 20MB로 풀리는 .gz 하나가 순간 0.5~2GB를 썼다). 관계 줄은 기억의 10배까지만 받는다.
function parseJsonl(text, errs, maxItems = Infinity) {
  const items = [], relations = [];
  let pos = 0, no = 0;
  while (pos <= text.length) {
    let nl = text.indexOf('\n', pos); if (nl === -1) nl = text.length;
    let ln = text.slice(pos, nl); if (ln.endsWith('\r')) ln = ln.slice(0, -1);
    no++; pos = nl + 1;
    if (!ln.trim()) continue;
    let o; try { o = JSON.parse(ln); } catch { errs(no, 'JSON 형식이 올바르지 않아요'); continue; }
    if (isObj(o) && isObj(o.relation)) {
      const r = relFrom(o.relation); if (r) relations.push(r);
      if (relations.length > maxItems * 10) return { items, relations, overflow: true };
      continue;
    }
    items.push({ raw: o, line: no });
    if (items.length > maxItems) return { items, relations, overflow: true };
  }
  return { items, relations };
}

function parseCsvDoc(text, ext, notes, errs, maxItems = Infinity) {
  const delim = ext === 'tsv' ? '\t' : detectDelimiter(text);
  const { rows, unterminated, overflow } = parseCsv(text, delim, maxItems + 1); // +1 = 머리글 줄
  if (overflow) return { items: [], relations: [], overflow: true };
  if (unterminated) fail('따옴표(")가 닫히지 않은 줄이 있어요. 파일이 잘렸거나 따옴표가 하나 빠졌을 수 있어요.');
  if (!rows.length) return { items: [], relations: [] };
  const header = rows[0].cells.map(c => canonKey(unguardCell(c)));
  const contentCol = header.indexOf('content');
  const items = [];
  if (contentCol === -1) {
    if (rows.every(r => r.cells.length === 1)) { // 머리글 없는 한 칸짜리 목록
      notes.push('머리글이 없는 한 칸짜리 파일이라, 모든 줄을 기억 내용으로 읽었어요.');
      for (const r of rows) items.push({ raw: { content: unguardCell(r.cells[0]) }, line: r.line });
      return { items, relations: [] };
    }
    fail("내용 열을 찾지 못했어요. 첫 줄(머리글)에 '내용' 또는 'content'가 있어야 해요. 예: 번호,유형,내용,중요도");
  }
  const ignored = rows[0].cells.filter((c, i) => !header[i] && String(c).trim()).length;
  if (ignored) notes.push(`알아보지 못한 열 ${ignored}개는 무시했어요.`);
  for (const r of rows.slice(1)) {
    if (r.cells.length > header.length && r.cells.slice(header.length).some(c => String(c).trim())) { errs(r.line, `칸이 머리글보다 많아요(${r.cells.length}칸)`); continue; }
    const o = {};
    header.forEach((f, i) => { if (f && !(f in o)) o[f] = unguardCell(r.cells[i] ?? ''); });
    items.push({ raw: o, line: r.line });
  }
  return { items, relations: [] };
}

// 내보낸 마크다운 구조 읽기: "## #id [유형] · 분류" / 본문 / "- 중요도 N · 신뢰도 X · 출처 S · 저장 T" / "- 프로젝트: `P`" / "- 관계(TYPE) → #id …"
function parseStructuredMd(text) {
  const items = [], relations = [];
  let cur = null, inMeta = false;
  const flush = () => { if (cur) { cur.raw.content = cur.lines.join('\n').trim(); items.push({ raw: cur.raw, line: cur.line }); } cur = null; };
  text.split(/\r?\n/).forEach((ln, i) => {
    const h = /^## #(\d+) \[([^\]]*)\](?: · (.*))?$/.exec(ln);
    if (h) { flush(); cur = { raw: { id: h[1], type: h[2], category: h[3] || '' }, lines: [], line: i + 1 }; inMeta = false; return; }
    if (!cur) return;
    if (!inMeta && /^- 중요도 /.test(ln)) inMeta = true;
    if (!inMeta) { cur.lines.push(ln); return; }
    let m;
    if ((m = /^- 중요도 (\S*) · 신뢰도 (\S*) · 출처 (\S*) · 저장 (.+)$/.exec(ln))) Object.assign(cur.raw, { importance: m[1], confidence: m[2], source: m[3], created_at: m[4].trim() });
    else if ((m = /^- 프로젝트: `(.+)`$/.exec(ln))) cur.raw.project = m[1];
    else if ((m = /^- 관계\(([A-Z_]+)\) → #(\d+)/.exec(ln))) relations.push({ from: Number(cur.raw.id), to: Number(m[2]), type: m[1] });
  });
  flush();
  return { items, relations };
}

// 일반 텍스트·마크다운: 빈 줄로 나뉜 단락(또는 줄)마다 기억 1건. 맨 앞 [결정] 같은 말머리는 유형으로, 마크다운은 머리말(front matter)·제목만 있는 단락 제외.
function parseFreeText(text, { md, split }, counters) {
  let t = text.replace(/\r\n?/g, '\n');
  if (md) t = t.replace(/^---\n[\s\S]*?\n---\n/, '');
  // 줄을 하나씩 읽으며 한도를 넘으면 멈춘다(2026-10-21: split('\n')이 줄 수백만 개짜리 파일에서 메모리를 한꺼번에 차지하던 문제).
  // 머리글 단락은 나중에 빠지므로 단락 수는 한도의 3배까지 허용하고, 최종 건수 검사는 아래에서 그대로 한다.
  // 한 단락이 contentChars의 2배를 넘으면 더 모으지 않는다 — 어차피 "내용이 너무 길어요"로 거절되는 단락이다.
  const L = counters.limits, maxBlocks = L.rows * 3, lineCap = L.contentChars * 2;
  const blocks = [];
  let cur = [], curChars = 0, over = false, start = 0, pos = 0, no = 0;
  const flush = () => { if (cur.length) blocks.push({ s: cur.join('\n').trim(), line: start }); cur = []; curChars = 0; over = false; };
  while (pos <= t.length) {
    let nl = t.indexOf('\n', pos); if (nl === -1) nl = t.length;
    const ln = t.slice(pos, nl); no++; pos = nl + 1;
    if (split === 'line') { if (ln.trim()) blocks.push({ s: ln.trim(), line: no }); }
    else if (!ln.trim()) flush();
    else {
      if (!cur.length) start = no;
      if (!over) { cur.push(ln); curChars += ln.length + 1; if (curChars > lineCap) over = true; }
    }
    if (blocks.length > maxBlocks) return { items: [], relations: [], overflow: true };
  }
  flush();
  const items = [];
  for (const b of blocks) {
    let s = b.s;
    if (md && s.split('\n').every(l => /^#{1,6}\s/.test(l.trim()))) { counters.headingsSkipped++; continue; }
    if (md && split === 'line') s = s.replace(/^([-*+]|\d+[.)])\s+/, '');
    const m = /^\[(결정|제약|선호|패턴|지식)\]\s*/.exec(s);
    items.push({ raw: m ? { content: s.slice(m[0].length), type: m[1] } : { content: s }, line: b.line });
  }
  return { items, relations: [] };
}

// ── 4. 진입점: 파일 바이트 → 정규화된 행 ───────────────────
export function parseImportFile({ bytes, filename, mime = '', split = 'paragraph', limits = {} }) {
  const L = { ...LIMITS, ...limits };
  if (!Buffer.isBuffer(bytes) || !bytes.length) fail('파일이 비어 있어요.');
  if (bytes.length > L.fileBytes) fail(`파일이 너무 커요(${Math.round(L.fileBytes / 1024 / 1024)}MB 이하만 가져와요). 나눠서 올려 주세요.`);
  const { ext, gz } = checkName(filename);
  checkMime(mime);
  let data = bytes;
  if (gz) {
    if (!startsWith(bytes, [0x1F, 0x8B])) fail('.gz 파일인데 압축 형식이 아니에요.');
    try { data = gunzipSync(bytes, { maxOutputLength: L.unpackedBytes }); }
    catch (e) { fail(e && e.code === 'ERR_BUFFER_TOO_LARGE' ? `압축을 풀면 ${Math.round(L.unpackedBytes / 1024 / 1024)}MB를 넘어서 받지 않아요.` : '압축 파일이 깨져 있어요.'); }
    if (!data.length) fail('압축을 풀었더니 비어 있어요.');
  }
  sniffBinary(data);
  const notes = [];
  const text = decodeText(data, notes);

  const errors = []; let errorTotal = 0;
  const addErr = (line, reason) => { errorTotal++; if (errors.length < L.errorSamples) errors.push({ line, reason }); };
  const counters = { typeFallback: 0, badValues: 0, headingsSkipped: 0, limits: L };

  const format = ext === 'ndjson' ? 'jsonl' : ext === 'markdown' ? 'md' : ext;
  let parsed;
  if (format === 'json') parsed = parseJsonDoc(text);
  else if (format === 'jsonl') parsed = parseJsonl(text, addErr, L.rows);
  else if (format === 'csv' || format === 'tsv') parsed = parseCsvDoc(text, format, notes, addErr, L.rows);
  else if (format === 'md' && /^# O-Brain 기억 내보내기/m.test(text) && /^## #\d+ \[/m.test(text)) parsed = parseStructuredMd(text);
  else parsed = parseFreeText(text, { md: format === 'md', split: split === 'line' ? 'line' : 'paragraph' }, counters);
  if (parsed.overflow) fail(`기억이 ${L.rows.toLocaleString('ko-KR')}건을 넘어요. 파일을 나눠서 올려 주세요.`); // 끝까지 읽기 전에 멈춘 경우(정확한 건수는 모름)
  if (parsed.items.length > L.rows) fail(`기억이 ${L.rows.toLocaleString('ko-KR')}건을 넘어요(${parsed.items.length.toLocaleString('ko-KR')}건). 파일을 나눠서 올려 주세요.`);

  const rows = []; let emptyRows = 0;
  for (const it of parsed.items) {
    const r = normalizeItem(it.raw, counters);
    if (r.empty) { emptyRows++; continue; }
    if (r.err) { addErr(it.line, r.err); continue; }
    rows.push({ ...r.row, line: it.line });
  }
  if (counters.headingsSkipped) notes.push(`제목만 있는 단락 ${counters.headingsSkipped}개는 기억이 아니라서 건너뛰었어요.`);
  if (counters.typeFallback) notes.push(`알 수 없는 유형 ${counters.typeFallback}건은 '지식'으로 넣어요.`);
  if (counters.badValues) notes.push(`읽을 수 없는 숫자·날짜 ${counters.badValues}곳은 기본값으로 바꿨어요.`);
  return {
    filename: cleanFilename(filename), format, formatLabel: FORMAT_LABEL[format] || format, gz, rows,
    relations: parsed.relations.filter(r => Number.isInteger(r.from) && Number.isInteger(r.to) && REL_TYPES.includes(r.type)),
    relationsInFile: parsed.relations.length, errors, errorTotal, emptyRows, notes,
  };
}

// ── 5. 미리보기(드라이런) — 시크릿 제거·중복 판정까지, DB는 아직 안 바꿈 ──────
const previews = new Map();
const keyOf = (project, text) => (project || '') + '\u0000' + text;
const baseName = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '(미지정)';

export function makePreview(db, parsed) {
  const existing = new Map();
  for (const r of db.prepare("SELECT id, content, IFNULL(project,'') p FROM memory").iterate()) existing.set(keyOf(r.p, r.content.trim()), r.id);
  const items = [], firstNew = new Map();
  let redactedRows = 0, redactedHits = 0, dupDb = 0, dupFile = 0, nNew = 0;
  const extraErrors = [];
  for (const row of parsed.rows) {
    const { clean, hits } = redact(row.content);
    const text = String(clean).trim();
    if (!text) { extraErrors.push({ line: row.line, reason: '내용이 비어 있어요' }); continue; }
    if (hits) { redactedRows++; redactedHits += hits; }
    const key = keyOf(row.project, text);
    const item = { ...row, content: text, hits, status: 'new', refId: null, refIndex: null };
    if (existing.has(key)) { item.status = 'dupDb'; item.refId = existing.get(key); dupDb++; }
    else if (firstNew.has(key)) { item.status = 'dupFile'; item.refIndex = firstNew.get(key); dupFile++; }
    else { firstNew.set(key, items.length); nNew++; }
    items.push(item);
  }
  const byOldId = new Map();
  items.forEach((it, i) => { if (it.oldId != null && !byOldId.has(it.oldId)) byOldId.set(it.oldId, i); });
  let relUsable = 0;
  for (const r of parsed.relations) {
    const a = byOldId.get(r.from), b = byOldId.get(r.to);
    if (a != null && b != null && a !== b && (items[a].status === 'new' || items[b].status === 'new')) relUsable++;
  }
  const errorTotal = parsed.errorTotal + extraErrors.length;
  const errors = parsed.errors.concat(extraErrors).slice(0, LIMITS.errorSamples);
  const id = randomBytes(12).toString('hex');
  const now = Date.now();
  for (const [k, v] of previews) if (now - v.createdAt > PREVIEW_TTL_MS) previews.delete(k);
  while (previews.size >= 5) previews.delete(previews.keys().next().value); // 가장 오래된 것부터 비움
  const summary = {
    previewId: id, filename: parsed.filename, format: parsed.format, formatLabel: parsed.formatLabel, gz: parsed.gz,
    counts: { parsed: items.length, new: nNew, dupDb, dupFile, invalid: errorTotal, empty: parsed.emptyRows, redactedRows, redactedHits, relationsUsable: relUsable, relationsInFile: parsed.relationsInFile },
    errors: errors.slice(0, 20), errorTotal,
    samples: items.filter(i => i.status === 'new').slice(0, 8).map(i => ({ type: i.type, content: i.content.slice(0, 140), importance: i.importance, project: i.project ? baseName(i.project) : null })),
    notes: parsed.notes, embedAvailable: embedMode() === 'all-MiniLM-L6-v2', limits: { rows: LIMITS.rows, fileMB: LIMITS.fileBytes / 1024 / 1024 },
  };
  previews.set(id, { id, createdAt: now, filename: parsed.filename, format: parsed.format, items, byOldId, relations: parsed.relations, summary });
  return summary;
}
export const getPreview = id => { const p = previews.get(String(id)); return p && Date.now() - p.createdAt <= PREVIEW_TTL_MS ? p : null; };
export const dropPreview = id => previews.delete(String(id));

// ── 6. 실제 가져오기(작업 job) — 자동 백업 → 임베딩 → 단일 트랜잭션 ──────
const jobs = new Map();
let activeJob = null;
const publicJob = j => ({ id: j.id, phase: j.phase, done: j.done, total: j.total, result: j.result || null, error: j.error || null });
export const getJob = id => { const j = jobs.get(String(id)); return j ? publicJob(j) : null; };

export function startImport(db, { previewId, keepTrust = false }) {
  const p = getPreview(previewId);
  if (!p) fail('미리보기가 만료됐어요(15분). 파일을 다시 올려 주세요.');
  if (activeJob && activeJob.phase !== 'done' && activeJob.phase !== 'error') fail('다른 가져오기가 진행 중이에요. 끝난 뒤에 다시 해 주세요.');
  const total = p.items.filter(i => i.status === 'new').length;
  if (!total) fail('새로 가져올 기억이 없어요(모두 이미 있는 기억이에요).');
  dropPreview(p.id); // 같은 미리보기로 두 번 실행되지 않게
  const job = { id: randomBytes(8).toString('hex'), phase: 'backup', done: 0, total };
  jobs.set(job.id, job); activeJob = job;
  while (jobs.size > 5) jobs.delete(jobs.keys().next().value);
  runImport(db, p, job, keepTrust === true).catch(e => {
    console.error('[import]', e);
    if (job.phase === 'backup') previews.set(p.id, p);   // 백업 단계에서 멈췄다면 아무것도 안 바뀐 것 — 미리보기를 되살려 다시 시도할 수 있게
    job.phase = 'error';
    job.error = e && e.code === 'IMPORT' ? e.message : '가져오기에 실패했어요. 기억은 바뀌지 않았어요.';
  });
  return { jobId: job.id, total };
}

async function runImport(db, p, job, keepTrust) {
  await backupOnce({ tag: 'before-import' });   // 실패하면 여기서 중단 — 백업 없이는 시작하지 않는다
  job.phase = 'embedding';
  const newItems = p.items.filter(i => i.status === 'new');
  const vecs = new Array(newItems.length).fill(null);
  let vecOk = true;
  for (let i = 0; i < newItems.length; i++) {
    if (vecOk) { try { vecs[i] = toBlob(await embed(newItems[i].content)); } catch (e) { if (e?.code !== 'EMBED_UNAVAILABLE') throw e; vecOk = false; } }
    job.done = i + 1;
  }
  job.phase = 'saving';
  job.result = db.transaction(() => insertBatch(db, p, newItems, vecs, keepTrust))();
  job.phase = 'done';
}

function insertBatch(db, p, newItems, vecs, keepTrust) {
  const existing = new Map();                    // 미리보기 이후 다른 곳(훅·MCP)이 같은 기억을 넣었을 수 있어 트랜잭션 안에서 다시 확인
  for (const r of db.prepare("SELECT id, content, IFNULL(project,'') p FROM memory").iterate()) existing.set(keyOf(r.p, r.content.trim()), r.id);
  const label = '가져오기 · ' + p.filename.slice(0, 60);
  const sess = Number(db.prepare("INSERT INTO session(project, tool, summary) VALUES (?, 'import', ?)").run(label, `${p.summary.formatLabel} ${newItems.length}건`).lastInsertRowid);
  const ins = db.prepare(`INSERT INTO memory(content,type,importance,confidence,source,project,category,scope,session_id,valid_from,valid_until,created_at)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))`);
  const insFts = db.prepare('INSERT INTO memory_fts(rowid, content) VALUES (?, ?)');
  const insVec = db.prepare('INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)');
  const today = new Date().toISOString().slice(0, 10);
  const idOf = new Map();                        // item → 새 id
  const created = new Set();
  let inserted = 0, dupAtCommit = 0, vectorSkipped = 0;
  newItems.forEach((it, i) => {
    const key = keyOf(it.project, it.content);
    if (existing.has(key)) { it.status = 'dupDb'; it.refId = existing.get(key); dupAtCommit++; return; }
    const source = keepTrust ? (it.source || 'import') : 'import';
    const confidence = keepTrust ? (it.confidence ?? 0.8) : 0.4;   // 0.4 = "검토 필요"(0.5 미만) — 새 대화 자동 주입에서 제외됨(inject.mjs)
    const id = Number(ins.run(it.content, it.type, it.importance, confidence, source, it.project, it.category || classify(it.content),
      it.scope || (it.project ? 'project' : 'global'), sess, (keepTrust && it.valid_from) || (it.created_at || today).slice(0, 10),
      keepTrust ? it.valid_until : null, it.created_at).lastInsertRowid);
    insFts.run(id, it.content);
    if (vecs[i]) insVec.run(BigInt(id), vecs[i]); else vectorSkipped++;
    idOf.set(it, id); created.add(it); existing.set(key, id); inserted++;
  });
  const resolve = it => (it.status === 'new' ? idOf.get(it) : it.status === 'dupDb' ? it.refId : resolve(p.items[it.refIndex]));
  const isCreated = it => created.has(it) || (it.status === 'dupFile' && created.has(p.items[it.refIndex]));
  let relationsAdded = 0;
  const addRel = db.prepare('INSERT OR IGNORE INTO relation(from_id, to_id, type) VALUES (?,?,?)');
  const supersede = db.prepare("UPDATE memory SET valid_until = COALESCE(valid_until, date('now')), invalidated_by = COALESCE(invalidated_by, ?) WHERE id = ?");
  for (const r of p.relations) {
    const a = p.byOldId.get(r.from), b = p.byOldId.get(r.to);
    if (a == null || b == null || a === b) continue;
    const A = p.items[a], B = p.items[b];
    const aNew = isCreated(A), bNew = isCreated(B);
    if (!aNew && !bNew) continue;                // 새로 들어온 기억과 이어진 관계만 — 되돌리기가 정확히 원복되도록
    if (r.type === 'SUPERSEDES' && !bNew) continue; // 기존 기억을 가져오기로 "번복 처리"하지 않는다
    const fa = resolve(A), fb = resolve(B);
    if (!fa || !fb || fa === fb) continue;
    if (addRel.run(fa, fb, r.type).changes) { relationsAdded++; if (r.type === 'SUPERSEDES') supersede.run(fa, fb); }
  }
  if (keepTrust) {                                // 신뢰해서 가져온 경우에만 파일의 "무효화한 기억" 표시를 옮긴다
    const setInv = db.prepare('UPDATE memory SET invalidated_by = ? WHERE id = ? AND valid_until IS NOT NULL AND invalidated_by IS NULL');
    for (const it of created) {
      if (it.invalidatedByOld == null) continue;
      const k = p.byOldId.get(it.invalidatedByOld);
      if (k != null) { const by = resolve(p.items[k]); if (by) setInv.run(by, idOf.get(it)); }
    }
  }
  const c = p.summary.counts;
  return { inserted, duplicates: dupAtCommit + c.dupDb + c.dupFile, relationsAdded, vectorSkipped, batchId: sess, keepTrust };
}

// ── 7. 되돌리기 — 가져오기 직후 30분 안, 그 묶음(session_id)으로 들어온 기억만 ─────
export async function undoImport(db, batchId) {
  const id = strictId(batchId);
  if (id === null) fail('되돌릴 가져오기를 찾지 못했어요.');
  const s = db.prepare("SELECT id, ended_at FROM session WHERE id = ? AND tool = 'import'").get(id);
  if (!s) fail('되돌릴 가져오기를 찾지 못했어요(이미 되돌렸을 수 있어요).');
  const at = new Date(String(s.ended_at).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(at) || Date.now() - at > UNDO_WINDOW_MS)
    fail('가져온 지 30분이 지나 자동 되돌리기를 막았어요(그 사이 고친 기억을 지우지 않기 위해). 필요하면 터미널에서 npm run restore 로 "가져오기 직전 백업"으로 되돌릴 수 있어요.');
  await backupOnce({ tag: 'before-undo' });
  const ids = db.prepare('SELECT id FROM memory WHERE session_id = ?').all(id).map(r => r.id);
  db.transaction(() => { for (const mid of ids) deleteMemory(db, mid); db.prepare('DELETE FROM session WHERE id = ?').run(id); })();
  return { deleted: ids.length };
}
