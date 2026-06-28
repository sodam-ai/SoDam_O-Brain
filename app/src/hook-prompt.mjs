// Claude Code UserPromptSubmit 훅 — 세션 시작 시 관련 기억 컨텍스트 주입 (PRD 07_AGENT_INTEGRATION §3)
// additionalContext로 기억을 AI 컨텍스트에 주입. 오류 시 {"continue": true}만 반환.
import { buildInjection } from './inject.mjs';

const chunks = [];
try {
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) chunks.push(chunk);
} catch {}

let input = {};
try { input = JSON.parse(chunks.join('') || '{}'); } catch {}

try {
  const ctx = await buildInjection({ project: input.cwd || '' });
  if (ctx) {
    process.stdout.write(JSON.stringify({
      continue: true,
      hookSpecificOutput: { additionalContext: ctx }
    }));
    process.exit(0);
  }
} catch {}

process.stdout.write(JSON.stringify({ continue: true }));
