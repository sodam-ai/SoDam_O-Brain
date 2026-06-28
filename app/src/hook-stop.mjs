// Claude Code Stop 훅 — 세션 종료 시 대화 → 기억 자동 추출·저장 (PRD 07_AGENT_INTEGRATION §3)
// 항상 {"continue": true} 반환 — 오류가 나도 세션 중단 X
import { captureSession } from './extract-session.mjs';

const chunks = [];
try {
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) chunks.push(chunk);
} catch {}

let input = {};
try { input = JSON.parse(chunks.join('') || '{}'); } catch {}

try {
  await captureSession({
    transcriptPath: input.transcript_path || '',
    projectPath: input.cwd || ''
  });
} catch {}

process.stdout.write(JSON.stringify({ continue: true }));
