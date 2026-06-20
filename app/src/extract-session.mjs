// 세션 캡처 — transcript .jsonl → user/assistant text → 시크릿제거 → 추출 → 저장.
import { readFileSync, existsSync } from 'node:fs';
import { ruleExtract } from './extract.mjs';
import { redact } from './redact.mjs';
import { openDb } from './db.mjs';
import { addMemory } from './store.mjs';

// transcript .jsonl(줄별 JSON) → user/assistant 텍스트 교환 목록.
// tool_use/tool_result 등 잡음 제외, {type:'text'}만 취함(Explore 확인 스키마).
export function parseTranscript(path, { tailLines = 600 } = {}) {
  let lines = readFileSync(path, 'utf-8').split('\n').filter(l => l.trim());
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

export async function captureSession({ transcriptPath, projectPath } = {}) {
  // 입력 검증(방어) — 실제 .jsonl 파일만 읽음(임의 파일 읽기 차단)
  if (!transcriptPath || !String(transcriptPath).endsWith('.jsonl') || !existsSync(transcriptPath)) {
    return { exchanges: 0, candidates: 0, saved: [] };
  }
  const exchanges = parseTranscript(transcriptPath);
  // 시크릿은 '추출(=AI 전송 가능) 전'에 제거 — 보안 발견사항 반영.
  for (const ex of exchanges) ex.text = redact(ex.text).clean;
  const memories = ruleExtract(exchanges);
  const db = openDb();
  const saved = [];
  for (const m of memories) {
    const r = await addMemory(db, { ...m, project: projectPath || null });
    saved.push({ id: r.id, type: m.type, content: m.content });
  }
  db.close();
  return { exchanges: exchanges.length, candidates: memories.length, saved };
}
