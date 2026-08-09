// SessionStart 훅 — 이전 기억을 새 세션에 자동 주입.
// stdout으로 {"continue":true,"hookSpecificOutput":{...}} JSON 출력해야 주입됨.
import { appUrl } from './_root.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  const out = { continue: true };
  try {
    let project = '';
    let query = '';
    try {
      const p = JSON.parse(input || '{}');
      project = p.cwd || '';
      // 저장 시점(SessionEnd)과 동일한 detectProject로 프로젝트 키 정합 — cwd≠편집프로젝트 불일치 완화(resume 시 효과).
      if (p.transcript_path) {
        try {
          const { detectProject, parseTranscript } = await import(appUrl('extract-session.mjs'));
          project = detectProject(p.transcript_path, project) || project;
          // 재개(resume) — PRD 07 §5 "관련성: 현재 작업/프롬프트와의 의미 유사도"를 실제로 반영.
          // 새 세션(startup)은 아직 대화가 없어 관련성을 계산할 근거 자체가 없으므로 query 없이(기존 동작 유지),
          // 재개는 직전 대화 마지막 사용자 발화를 query로 써서 "하던 얘기"에 맞는 기억을 우선 주입.
          try {
            const { redact } = await import(appUrl('redact.mjs'));
            const exchanges = parseTranscript(p.transcript_path);
            const lastUser = [...exchanges].reverse().find(e => e.role === 'user' && e.text);
            if (lastUser) {
              const clean = redact(String(lastUser.text)).clean.trim().slice(0, 300);
              if (clean.length >= 6) query = clean; // 너무 짧은 발화("네"류)는 신호가 없어 기존 경로로 폴백
            }
          } catch {}
        } catch {}
      }
    } catch {}
    const { buildInjection } = await import(appUrl('inject.mjs'));
    const ctx = await buildInjection({ project, query, max: 8 });
    if (ctx) out.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: ctx };
  } catch (e) {
    // 조용히 폴백(주입 실패가 세션을 막으면 안 됨). 로그는 stderr.
    console.error('[o-brain] 주입 실패(무시):', e?.message || e);
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
});
