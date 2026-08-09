// 세션 캡처 — transcript .jsonl → user/assistant text → 시크릿제거 → 추출 → 저장.
import { readFileSync, existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, parse as parsePath } from 'node:path';
import { ruleExtract } from './extract.mjs';
import { redact } from './redact.mjs';
import { openDb } from './db.mjs';
import { addMemory } from './store.mjs';

// 대용량 transcript(수백MB~1GB+)를 통째로 메모리에 올리면 Node 문자열 한도(≈512MB) 초과로 크래시하거나
// (실측: 967MB 파일에서 ERR_STRING_TOO_LONG), 그 전에도 동기 전체읽기가 수 초 걸려 Stop 훅 타임아웃
// 위험(PRD 05 §1 "백그라운드 처리, 사용자 대기 없음" 위반). 파일 끝 20MB만 읽어 최근 대화를 안전하게
// 확보한다(작은 파일은 기존과 동일하게 전체를 읽음 — 회귀 없음).
const MAX_TAIL_BYTES = 20 * 1024 * 1024;
function readTail(path, maxBytes = MAX_TAIL_BYTES) {
  const size = statSync(path).size;
  if (size <= maxBytes) return readFileSync(path, 'utf-8');
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(maxBytes);
    readSync(fd, buf, 0, maxBytes, size - maxBytes);
    const text = buf.toString('utf-8');
    const nl = text.indexOf('\n'); // 첫 줄은 경계에서 잘렸을 수 있으니 버림
    return nl === -1 ? text : text.slice(nl + 1);
  } finally { closeSync(fd); }
}

// 파일이 속한 '프로젝트 루트' = .git 가 있는 폴더(최우선·진짜 저장소 루트).
// .git 이 없으면 package.json/.PRD 가 있는 가장 바깥 폴더로 폴백(app/ 같은 하위서 멈추지 않게).
function projectRootOf(filePath, cache) {
  let dir = dirname(filePath);
  const fsRoot = parsePath(dir).root;
  const start = dir;
  if (cache && cache.has(start)) return cache.get(start);
  let gitRoot = null, pkgRoot = null, d = dir;
  for (let i = 0; i < 14 && d && d !== fsRoot; i++) {
    try {
      const e = readdirSync(d);
      if (e.includes('.git')) { gitRoot = d; break; }                                  // git 루트 = 진짜 프로젝트 루트
      if (!pkgRoot && (e.includes('package.json') || e.includes('.PRD'))) pkgRoot = d;  // 폴백 후보(계속 위로 탐색)
    } catch {}
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  const root = gitRoot || pkgRoot;
  if (cache) cache.set(start, root);
  return root;
}
// 자동 프로젝트 탐지 — 이 세션에서 '실제 파일 작업(tool_use)'한 파일들이 속한 프로젝트 중 가장 많이 만진 곳.
// 단순 '언급된 경로'가 아니라 Read/Edit/Write 등 실제 파일조작만 셈(편집은 가중↑). 못 찾으면 fallback(cwd).
export function detectProject(transcriptPath, fallback = null) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return fallback;
    let lines = readTail(transcriptPath).split('\n').filter(l => l.trim());
    if (lines.length > 1500) lines = lines.slice(-1500);
    const skip = /\\node_modules\\|\\AppData\\|\\\.git\\|\\Temp\\|\\O-Brain\\app\\data\b/i;
    const cache = new Map(), rootCount = {};
    const add = (p, w) => {
      if (!p || typeof p !== 'string' || !/^[A-Za-z]:\\/.test(p) || skip.test(p)) return;
      const r = projectRootOf(p, cache); if (r) rootCount[r] = (rootCount[r] || 0) + w;
    };
    for (const line of lines) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      const c = o && o.message && o.message.content;
      if (!Array.isArray(c)) continue;
      for (const it of c) {
        if (it && it.type === 'tool_use' && it.input) {
          const w = /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(it.name || '') ? 3 : 1; // 편집>조회
          add(it.input.file_path, w); add(it.input.path, w); add(it.input.notebook_path, w);
        }
      }
    }
    let best = null, bestN = 0;
    for (const r in rootCount) if (rootCount[r] > bestN) { bestN = rootCount[r]; best = r; }
    return best || fallback;
  } catch { return fallback; }
}

// transcript .jsonl(줄별 JSON) → user/assistant 텍스트 교환 목록.
// tool_use/tool_result 등 잡음 제외, {type:'text'}만 취함(Explore 확인 스키마).
export function parseTranscript(path, { tailLines = 600 } = {}) {
  let lines = readTail(path).split('\n').filter(l => l.trim());
  if (lines.length > tailLines) lines = lines.slice(-tailLines); // 대용량 방지: 최근 위주
  const exchanges = [];
  for (const line of lines) {
    let o;
    try { o = JSON.parse(line); } catch { continue; } // 마지막 줄 불완전 대비
    if (o.type !== 'user' && o.type !== 'assistant') continue;
    const msg = o.message;
    if (!msg) continue;
    let text = '';
    if (typeof msg.content === 'string') text = msg.content;
    else if (Array.isArray(msg.content)) {
      text = msg.content.filter(p => p && p.type === 'text').map(p => p.text).join('\n');
    }
    text = (text || '').trim();
    if (text) exchanges.push({ role: msg.role || o.type, text });
  }
  return exchanges;
}

// 주입/시스템 텍스트 제거 — 클로드코드 전사의 user 턴에는 훅 주입·system-reminder·스킬/페르소나 마커·코드펜스가
// 섞여 들어온다. 이를 추출 대상에서 빼서 '실제 사용자가 타이핑한 결정'만 남긴다(노이즈 기억 방지).
// 사용자의 진짜 발화는 이 마커들과 무관하므로 안전(과필터 위험 낮음).
export function stripInjected(text) {
  let t = String(text || '');
  t = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, ' '); // 훅/리마인더 블록
  t = t.replace(/```[\s\S]*?```/g, ' ');                                 // 코드펜스(설정·로그 등)
  t = t.replace(/<command-[\s\S]*?<\/command-[a-z]*>/gi, ' ');           // 슬래시명령 래퍼
  const drop = /(📌|O-Brain 자동 주입|O-Brain 로컬 기억|페르소나 v5|\[페르소나|persona_core|MANDATORY SKILL|hookSpecificOutput|additionalContext|UserPromptSubmit hook|SessionStart hook|SessionEnd hook|Skill\()/i;
  // 대화 인용 노이즈(2026-07-26 실DB 감사: 노이즈 표본 20/20이 이 형태) — 압축요약/전사에 박힌
  // "**Claude:**"/"Assistant:"/"User:" 인용은 '지금 사용자가 한 말'이 아니라 세션 요약 조각이 user 턴에
  // 섞여 들어온 것(2026-08-09 190개 실transcript 재검증: 인용 줄 25건 표본 전부 AI 자기서술·문서조각으로
  // 확인, 과필터 없음). 줄 전체를 버림.
  const dropQuote = /^\*{0,2}(Claude|Assistant|User|사용자|어시스턴트)\*{0,2}\s*[:：]/i;
  // 헤딩 마커(#)는 줄 전체를 버리지 않고 마커만 제거 — 2026-08-09 190개 실transcript 재검증에서
  // "비공개 저장소가 아니거나 확인할 수 없으면 commit/push 하지 마" 같은 사용자의 실제 지시문이
  // "#"로 시작한다는 이유만으로 통째로 삭제되는 오탐(30/720건, 4.2%)을 확인. 순수 문서 헤딩(마커
  // 제거 후 내용이 없거나 짧음)은 ruleExtract의 길이(6~160자)·CUES 매칭에서 자연히 걸러짐.
  const headingPrefix = /^#{1,6}\s+/;
  const dropTableRow = /\|.*\|/;
  t = t.split('\n')
    .filter(line => !drop.test(line))
    .map(line => line.replace(headingPrefix, ''))
    .filter(line => {
      const trimmed = line.trim();
      return !dropQuote.test(trimmed) && !dropTableRow.test(trimmed);
    }).join('\n');         // 주입 마커·인용·표 든 줄 제거(헤딩은 마커만 제거)
  return t.replace(/[ \t]{2,}/g, ' ').trim();
}

export async function captureSession({ transcriptPath, projectPath } = {}) {
  // 입력 검증(방어) — 실제 .jsonl 파일만 읽음(임의 파일 읽기 차단)
  if (!transcriptPath || !String(transcriptPath).endsWith('.jsonl') || !existsSync(transcriptPath)) {
    return { exchanges: 0, candidates: 0, saved: [] };
  }
  const exchanges = parseTranscript(transcriptPath);
  // 시크릿은 '추출(=AI 전송 가능) 전'에 제거 — 보안 발견사항 반영.
  for (const ex of exchanges) {
    ex.text = redact(ex.text).clean;
    if (ex.role === 'user') ex.text = stripInjected(ex.text); // 주입/시스템 텍스트 제거(노이즈 추출 방지)
  }
  const memories = ruleExtract(exchanges);
  // 프로젝트 = 실제 편집한 파일 기준 자동 탐지(없으면 클로드코드 시작 폴더 cwd).
  const project = detectProject(transcriptPath, projectPath || null);
  const db = openDb();
  // 세션 레코드 생성(PRD 02) — 기억의 출처 세션을 추적한다.
  let session_id = null;
  try {
    const sessRow = db.prepare(
      "INSERT INTO session(project, tool, ended_at) VALUES (?, 'claude-code', datetime('now'))"
    ).run(project || null);
    session_id = Number(sessRow.lastInsertRowid) || null;
  } catch {}
  // scope: project 탐지 시 'project', 없으면 'global' (PRD 02 확정: Phase 1은 전부 project)
  const scope = project ? 'project' : 'global';
  const saved = [];
  for (const m of memories) {
    const r = await addMemory(db, { ...m, project, scope, session_id });
    saved.push({ id: r.id, type: m.type, content: m.content });
  }
  db.close();
  return { exchanges: exchanges.length, candidates: memories.length, saved, project, session_id };
}
