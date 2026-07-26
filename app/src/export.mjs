// 백업·내보내기(Markdown/JSON) — PRD 03 Phase 3 마지막 항목. 읽기 전용(기존 데이터 무변경).
// 저장 위치는 data/export/ 고정 — 사용자 지정 경로를 받지 않아 경로조작(08 §3/§4) 자체가 불가능함.
// 응답 본문에 전체 내용을 싣지 않고 서버가 파일로 직접 써서 경로만 반환 — 대량 내보내기 시 브라우저 프리징 방지.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './db.mjs';

const EXPORT_DIR = join(DATA_DIR, 'export');
const NOTE = '이 파일의 project 항목에는 이 컴퓨터의 로컬 폴더 경로가 그대로 포함될 수 있습니다. 다른 사람과 공유하기 전에 확인하세요.';

function allMemories(db) {
  return db.prepare(
    `SELECT id, content, type, importance, confidence, source, project, category, scope,
            access_count, created_at, valid_from, valid_until, invalidated_by
     FROM memory ORDER BY id`
  ).all();
}
function allRelations(db) {
  return db.prepare('SELECT id, from_id, to_id, type, created_at FROM relation ORDER BY id').all();
}

function toMarkdown(mems, rels) {
  const byId = new Map(mems.map(m => [m.id, m]));
  const outFrom = new Map();
  for (const r of rels) { if (!outFrom.has(r.from_id)) outFrom.set(r.from_id, []); outFrom.get(r.from_id).push(r); }
  const lines = [
    '# O-Brain 기억 내보내기',
    '',
    `- 내보낸 시각: ${new Date().toISOString()}`,
    `- 기억 ${mems.length}건 · 관계 ${rels.length}건`,
    `- ⚠️ ${NOTE}`,
    '',
  ];
  for (const m of mems) {
    lines.push(`## #${m.id} [${m.type}]${m.category ? ' · ' + m.category : ''}`, '', m.content, '');
    lines.push(`- 중요도 ${m.importance} · 신뢰도 ${m.confidence ?? ''} · 출처 ${m.source} · 저장 ${m.created_at}`);
    if (m.project) lines.push(`- 프로젝트: \`${m.project}\``);
    for (const r of (outFrom.get(m.id) || [])) {
      const target = byId.get(r.to_id);
      if (target) lines.push(`- 관계(${r.type}) → #${r.to_id} ${target.content.slice(0, 40)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function exportMemories(db, { format = 'json' } = {}) {
  const fmt = format === 'md' ? 'md' : 'json';
  mkdirSync(EXPORT_DIR, { recursive: true });
  const mems = allMemories(db);
  const rels = allRelations(db);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `obrain-export-${ts}.${fmt}`;
  const dest = join(EXPORT_DIR, file);
  if (fmt === 'json') {
    writeFileSync(dest, JSON.stringify({ exportedAt: new Date().toISOString(), note: NOTE, count: mems.length, memories: mems, relations: rels }, null, 2), 'utf8');
  } else {
    writeFileSync(dest, toMarkdown(mems, rels), 'utf8');
  }
  return { file, dir: EXPORT_DIR, count: mems.length, format: fmt };
}
