// 내보내기 — JSON · JSON Lines · CSV · Markdown · TXT · HTML (+ 선택 gzip). 읽기 전용(기존 데이터 무변경).
// 저장 위치는 data/export/ 고정 — 사용자 지정 경로를 받지 않아 경로조작(08 §3/§4) 자체가 불가능함.
// 새 의존성 없음(Node 내장 zlib만). 범위: 전체 / id 목록(화면에 불러온 것·선택한 것) / 프로젝트 하나.
// 응답 본문에 전체를 싣는 경로(buildExport → 내려받기)와 서버가 파일로 쓰는 경로(exportMemories)를 모두 제공한다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DATA_DIR } from './db.mjs';
import { toCsv } from './csv.mjs';

const EXPORT_DIR = join(DATA_DIR, 'export');
const NOTE = '이 파일의 project 항목에는 이 컴퓨터의 로컬 폴더 경로가 그대로 포함될 수 있습니다. 다른 사람과 공유하기 전에 확인하세요.';
const NOTE_STRIPPED = '프로젝트(폴더 경로) 항목은 뺐어요. 그래도 기억 내용 안에 경로·이름 같은 개인정보가 남아 있을 수 있으니 공유 전에 확인하세요.';
const MAX_IDS = 100000;

export const FORMATS = {
  json:  { ext: 'json',  mime: 'application/json',      label: 'JSON' },
  jsonl: { ext: 'jsonl', mime: 'application/x-ndjson',  label: 'JSON Lines' },
  csv:   { ext: 'csv',   mime: 'text/csv',              label: 'CSV' },
  md:    { ext: 'md',    mime: 'text/markdown',         label: '마크다운' },
  txt:   { ext: 'txt',   mime: 'text/plain',            label: '텍스트' },
  html:  { ext: 'html',  mime: 'text/html',             label: 'HTML' },
};

const COLS = `id, content, type, importance, confidence, source, project, category, scope,
              access_count, created_at, valid_from, valid_until, invalidated_by`;

// ── 선택(범위) ──────────────────────────────────────────────
export function selectMemories(db, scope = { mode: 'all' }) {
  const mode = scope && scope.mode;
  if (mode === 'ids') {
    const ids = [...new Set((Array.isArray(scope.ids) ? scope.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS);
    const out = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      out.push(...db.prepare(`SELECT ${COLS} FROM memory WHERE id IN (${chunk.map(() => '?').join(',')})`).all(...chunk));
    }
    return out.sort((a, b) => a.id - b.id);
  }
  if (mode === 'project') {
    return db.prepare(`SELECT ${COLS} FROM memory WHERE IFNULL(project,'') = ? ORDER BY id`).all(String(scope.project ?? ''));
  }
  return db.prepare(`SELECT ${COLS} FROM memory ORDER BY id`).all();
}
// 관계는 양 끝이 모두 선택 범위 안일 때만 포함(범위 밖 기억을 가리키는 끊긴 관계를 만들지 않음).
export function selectRelations(db, memories) {
  const ids = new Set(memories.map(m => m.id));
  return db.prepare('SELECT id, from_id, to_id, type, created_at FROM relation ORDER BY id').all()
    .filter(r => ids.has(r.from_id) && ids.has(r.to_id));
}

// ── 직렬화(순수) ────────────────────────────────────────────
const REL_KO = { SUPERSEDES: '번복', SUPPORTS: '뒷받침', INFLUENCES: '영향', CONTRADICTS: '충돌' };
const oneLine = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const noteOf = stripped => (stripped ? NOTE_STRIPPED : NOTE);
const localStamp = iso => { const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

function toJson({ memories, relations, exportedAt, stripProject }) {
  return JSON.stringify({
    format: 'obrain-export', version: 1, exportedAt, note: noteOf(stripProject),
    count: memories.length, relationCount: relations.length, projectsIncluded: !stripProject,
    memories, relations,
  }, null, 2);
}

// 한 줄에 한 객체. 기억은 필드 그대로, 관계는 {"relation":{...}} 한 줄.
function toJsonl({ memories, relations }) {
  const lines = memories.map(m => JSON.stringify(m));
  for (const r of relations) lines.push(JSON.stringify({ relation: { from_id: r.from_id, to_id: r.to_id, type: r.type, created_at: r.created_at } }));
  return lines.join('\n') + '\n';
}

// 엑셀용: 한글 머리글 + UTF-8 BOM + CRLF. 관계는 평면 표에 담기 어려워 넣지 않는다(JSON/JSONL/마크다운에는 있음).
export const CSV_HEADERS = ['번호', '유형', '내용', '중요도', '신뢰도', '출처', '프로젝트', '분류', '범위', '저장시각', '유효시작', '유효종료'];
function toCsvText({ memories }) {
  const rows = memories.map(m => [m.id, m.type, m.content, m.importance, m.confidence, m.source, m.project, m.category, m.scope, m.created_at, m.valid_from, m.valid_until]);
  return '﻿' + toCsv(CSV_HEADERS, rows);
}

// 구조는 가져오기(import.mjs)가 다시 읽을 수 있게 고정: "## #id [유형] · 분류" / 본문 / "- 중요도 …" / "- 프로젝트: `…`" / "- 관계(TYPE) → #id …"
function toMarkdown({ memories, relations, exportedAt, stripProject }) {
  const byId = new Map(memories.map(m => [m.id, m]));
  const outFrom = new Map();
  for (const r of relations) { if (!outFrom.has(r.from_id)) outFrom.set(r.from_id, []); outFrom.get(r.from_id).push(r); }
  const lines = [
    '# O-Brain 기억 내보내기',
    '',
    `- 내보낸 시각: ${exportedAt}`,
    `- 기억 ${memories.length}건 · 관계 ${relations.length}건`,
    `- ⚠️ ${noteOf(stripProject)}`,
    '',
  ];
  for (const m of memories) {
    lines.push(`## #${m.id} [${m.type}]${m.category ? ' · ' + m.category : ''}`, '', m.content, '');
    lines.push(`- 중요도 ${m.importance} · 신뢰도 ${m.confidence ?? ''} · 출처 ${m.source} · 저장 ${m.created_at}`);
    if (m.project) lines.push(`- 프로젝트: \`${m.project}\``);
    for (const r of (outFrom.get(m.id) || [])) {
      const target = byId.get(r.to_id);
      if (target) lines.push(`- 관계(${r.type}) → #${r.to_id} ${oneLine(target.content, 40)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// 읽기·복사용: "[유형] 내용" 단락을 빈 줄로 구분. 내용 안의 빈 줄은 한 줄바꿈으로 줄인다(그래야 단락 경계가 유지됨).
function toTxt({ memories }) {
  return memories.map(m => `[${m.type}] ${String(m.content).replace(/\n\s*\n+/g, '\n').trim()}`).join('\n\n') + '\n';
}

// 자체완결 HTML — 스크립트 없음 + CSP로 실행 차단 + 모든 값 이스케이프. 브라우저 "인쇄 → PDF로 저장"이 PDF 대용.
function toHtml({ memories, relations, exportedAt, stripProject }) {
  const byType = {};
  for (const m of memories) byType[m.type || '기타'] = (byType[m.type || '기타'] || 0) + 1;
  const outFrom = new Map();
  for (const r of relations) { if (!outFrom.has(r.from_id)) outFrom.set(r.from_id, []); outFrom.get(r.from_id).push(r); }
  const byId = new Map(memories.map(m => [m.id, m]));
  const items = memories.map(m => {
    const rels = (outFrom.get(m.id) || []).map(r => {
      const t = byId.get(r.to_id);
      return t ? `<li>${h(REL_KO[r.type] || r.type)} → <a href="#m${t.id}">#${t.id}</a> ${h(oneLine(t.content, 50))}</li>` : '';
    }).join('');
    const meta = [`중요도 ${h(m.importance)}/5`, m.confidence != null ? `신뢰도 ${h(m.confidence)}` : '', `출처 ${h(m.source)}`, `저장 ${h(m.created_at)}`, m.project ? `프로젝트 ${h(m.project)}` : ''].filter(Boolean).join(' · ');
    return `<article id="m${m.id}"><h2><span class="id">#${m.id}</span> <span class="pill">${h(m.type)}</span>${m.category ? ` <span class="cat">${h(m.category)}</span>` : ''}</h2>`
      + `<p class="c">${h(m.content)}</p><p class="meta">${meta}</p>${rels ? `<ul class="rel">${rels}</ul>` : ''}</article>`;
  }).join('\n');
  const typeList = Object.entries(byType).map(([k, v]) => `<li>${h(k)} ${v}건</li>`).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>O-Brain 기억 내보내기</title>
<style>
:root{--bg:#fff;--fg:#1b1f27;--mut:#4d5666;--bd:#d3d9e3;--card:#f5f7fa;--acc:#2f5fe0}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--fg:#e8ebf1;--mut:#a9b2c1;--bd:#2c3340;--card:#1a1f28;--acc:#8aaaff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.5rem;margin:0 0 4px}
.sum{color:var(--mut);margin:0 0 12px}
.warn{border:1px solid var(--bd);border-left:4px solid var(--acc);background:var(--card);padding:10px 12px;border-radius:6px;margin:12px 0 20px}
ul.types{display:flex;flex-wrap:wrap;gap:8px 16px;padding:0;list-style:none;margin:0 0 20px;color:var(--mut)}
article{border:1px solid var(--bd);background:var(--card);border-radius:10px;padding:12px 14px;margin:12px 0;break-inside:avoid}
article h2{font-size:1rem;margin:0 0 6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.id{color:var(--mut);font-variant-numeric:tabular-nums}
.pill{border:1px solid var(--acc);color:var(--acc);border-radius:999px;padding:0 8px;font-size:.85rem}
.cat{color:var(--mut);font-size:.85rem}
.c{white-space:pre-wrap;word-break:break-word;margin:0 0 6px}
.meta{color:var(--mut);font-size:.85rem;margin:0}
.rel{margin:6px 0 0;padding-left:18px;color:var(--mut);font-size:.9rem}
a{color:var(--acc)}
@media print{body{background:#fff;color:#000}article{background:#fff;border-color:#999}.pill{border-color:#000;color:#000}}
</style>
</head>
<body>
<main>
<h1>O-Brain 기억 내보내기</h1>
<p class="sum">내보낸 시각 ${h(localStamp(exportedAt))} · 기억 ${memories.length}건 · 관계 ${relations.length}건</p>
<p class="warn" role="note">⚠️ ${h(noteOf(stripProject))}</p>
<ul class="types">${typeList}</ul>
${items}
</main>
</body>
</html>
`;
}

const SERIALIZERS = { json: toJson, jsonl: toJsonl, csv: toCsvText, md: toMarkdown, txt: toTxt, html: toHtml };

// ── 만들기 ────────────────────────────────────────────────
// 반환: { filename, mime, bytes(Buffer), count, relationCount, format, gzip }. 비어 있으면 한글 안내 오류.
export function buildExport(db, { format = 'json', scope = { mode: 'all' }, stripProject = false, gzip = false } = {}) {
  const fmt = FORMATS[format] ? format : 'json';
  const picked = selectMemories(db, scope);
  if (!picked.length) { const e = new Error('내보낼 기억이 없어요'); e.code = 'EMPTY'; throw e; }
  const relations = selectRelations(db, picked);
  const memories = stripProject ? picked.map(m => ({ ...m, project: null })) : picked;
  const exportedAt = new Date().toISOString();
  const text = SERIALIZERS[fmt]({ memories, relations, exportedAt, stripProject: !!stripProject });
  let bytes = Buffer.from(text, 'utf8');
  const ts = exportedAt.replace(/[:.]/g, '-');
  let filename = `obrain-export-${ts}.${FORMATS[fmt].ext}`;
  let mime = FORMATS[fmt].mime;
  if (gzip) { bytes = gzipSync(bytes, { level: 9 }); filename += '.gz'; mime = 'application/gzip'; }
  return { filename, mime, bytes, count: memories.length, relationCount: relations.length, format: fmt, gzip: !!gzip };
}

// 서버가 data/export/ 에 파일로 직접 저장(기존 동작 호환 — 반환의 file/dir/count/format 유지, path/size 추가).
export function exportMemories(db, opts = {}) {
  const b = buildExport(db, opts);
  mkdirSync(EXPORT_DIR, { recursive: true });
  const dest = join(EXPORT_DIR, b.filename);
  writeFileSync(dest, b.bytes);
  return { file: b.filename, dir: EXPORT_DIR, path: dest, count: b.count, relationCount: b.relationCount, format: b.format, gzip: b.gzip, size: b.bytes.length };
}
