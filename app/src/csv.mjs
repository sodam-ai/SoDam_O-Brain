// CSV 읽기/쓰기 — 순수 함수(파일·DB 접근 없음). 새 의존성 없이 RFC 4180 + 엑셀 현실(UTF-8 BOM·CRLF·세미콜론)을 다룬다.
// 쓰기: 수식 주입 방어(= + - @ 탭 CR로 시작하는 칸 앞에 ' 를 붙임 — OWASP "CSV Injection"). 읽기: 같은 규칙으로 붙인 ' 를 되돌린다.

const FORMULA_START = /^[=+\-@\t\r]/;

// 한 칸을 CSV 문자열로. 숫자·null은 그대로/빈칸, 문자열은 수식 방어 후 필요할 때만 따옴표로 감싼다.
export function csvCell(v) {
  if (v == null) return '';
  let s = typeof v === 'number' ? String(v) : String(v);
  if (typeof v !== 'number' && FORMULA_START.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) || s !== s.trim() ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 엑셀이 기대하는 CRLF 줄바꿈. BOM은 호출부가 파일 맨 앞에 붙인다(여기서는 본문만).
export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

// 읽을 때: 수식 방어용으로 붙은 선행 ' 제거(그 뒤 글자가 위험 문자일 때만 — 일반 따옴표 글은 건드리지 않음).
export function unguardCell(s) {
  return typeof s === 'string' && s.length > 1 && s[0] === "'" && FORMULA_START.test(s[1]) ? s.slice(1) : s;
}

// 첫 줄(따옴표 밖)에서 가장 많이 나온 구분자를 고른다. 동률/없음이면 쉼표.
export function detectDelimiter(text) {
  let inQ = false, c = 0, sc = 0, tc = 0;
  for (let i = 0; i < text.length && i < 20000; i++) {
    const ch = text[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ',') c++; else if (ch === ';') sc++; else if (ch === '\t') tc++;
    }
  }
  if (tc > c && tc >= sc) return '\t';
  if (sc > c) return ';';
  return ',';
}

// 파싱 결과: { rows: [{ cells, line }], unterminated } — line은 그 행이 시작한 물리적 줄 번호(1부터), 오류 안내용.
// 따옴표 안의 줄바꿈·"" 이스케이프·\r\n/\n/\r 모두 처리. 완전히 빈 줄은 건너뛴다.
// maxRows(선택): 행이 이보다 많아지면 거기서 멈추고 overflow:true를 돌려준다 — 한도를 넘는 파일을 끝까지 읽어 메모리를 낭비하지 않기 위해
// (2026-10-21: 20MB로 풀리는 작은 .gz가 순간 1~2GB를 쓰던 문제).
export function parseCsv(text, delimiter = ',', maxRows = Infinity) {
  const rows = [];
  let row = [], cell = '', inQ = false, line = 1, rowLine = 1, quotedCell = false;
  const n = text.length;
  const endRow = () => {
    row.push(cell);
    if (!(row.length === 1 && row[0] === '' && !quotedCell)) rows.push({ cells: row, line: rowLine });
    row = []; cell = ''; quotedCell = false;
  };
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '' && !quotedCell) { inQ = true; quotedCell = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ''; quotedCell = false; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow(); line++; rowLine = line;
      if (rows.length > maxRows) return { rows, unterminated: false, overflow: true };
      continue;
    }
    cell += ch;
  }
  const unterminated = inQ;
  if (cell !== '' || row.length || quotedCell) endRow();
  return { rows, unterminated };
}
