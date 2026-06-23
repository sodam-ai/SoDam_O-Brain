// SessionStart 훅 — 이전 기억을 새 세션에 자동 주입.
// stdout으로 {"continue":true,"hookSpecificOutput":{...}} JSON 출력해야 주입됨.
import { appUrl } from './_root.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  const out = { continue: true };
  try {
    let project = '';
    try {
      const p = JSON.parse(input || '{}');
      project = p.cwd || '';
      // 저장 시점(SessionEnd)과 동일한 detectProject로 프로젝트 키 정합 — cwd≠편집프로젝트 불일치 완화(resume 시 효과).
      if (p.transcript_path) {
        try {
          const { detectProject } = await import(appUrl('extract-session.mjs'));
          project = detectProject(p.transcript_path, project) || project;
        } catch {}
      }
    } catch {}
    const { buildInjection } = await import(appUrl('inject.mjs'));
    const ctx = await buildInjection({ project, max: 8 });
    if (ctx) out.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: ctx };
  } catch (e) {
    // 조용히 폴백(주입 실패가 세션을 막으면 안 됨). 로그는 stderr.
    console.error('[o-brain] 주입 실패(무시):', e?.message || e);
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});
