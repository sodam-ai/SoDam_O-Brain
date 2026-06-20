// SessionStart 훅 — 이전 기억을 새 세션에 자동 주입.
// stdout으로 {"continue":true,"hookSpecificOutput":{...}} JSON 출력해야 주입됨.
import { appUrl } from './_root.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  const out = { continue: true };
  try {
    const { buildInjection } = await import(appUrl('inject.mjs'));
    const ctx = await buildInjection({ max: 8 });
    if (ctx) out.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: ctx };
  } catch (e) {
    // 조용히 폴백(주입 실패가 세션을 막으면 안 됨). 로그는 stderr.
    console.error('[o-brain] 주입 실패(무시):', e?.message || e);
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});
