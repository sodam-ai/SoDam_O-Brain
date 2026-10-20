// SessionEnd 훅 — 세션이 끝나면 대화에서 기억을 자동 추출·저장.
// 항상 exit(0): 실패해도 세션 종료를 막지 않는다(은폐 아님 — stderr 로그 남김).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appUrl, dataDir } from './_root.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(input || '{}');
    // 프로브: 실제로 받은 stdin 형식을 남겨 둠(스키마 확인용).
    try {
      const dir = dataDir();
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '_probe.json'), JSON.stringify({ keys: Object.keys(payload), payload }, null, 2));
    } catch {}

    const transcriptPath = payload.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH;
    if (!transcriptPath) { console.error('[o-brain] transcript_path 없음 — 건너뜀'); process.exit(0); }

    const { captureSession } = await import(appUrl('extract-session.mjs'));
    const r = await captureSession({ transcriptPath, projectPath: payload.cwd });
    if (r.skipped) console.error('[o-brain] 프로그램이 호출한(sdk) 세션 — 기억 후보 추출을 건너뜀 (켜려면 app/.env.local에 OBRAIN_CAPTURE_SDK=1)');
    else console.error(`[o-brain] 캡처: 대화 ${r.exchanges} → 후보 ${r.candidates} → 저장 ${r.saved.length}건`);
    // 무엇이 왜 제외됐는지 숨기지 않는다(PRD 05 §3). 알 수 없는 origin 종류는 사람으로 간주해 통과시킨 것.
    const fmt = (o) => Object.entries(o || {}).map(([k, v]) => `${k} ${v}`).join(', ');
    if (fmt(r.dropped)) console.error(`[o-brain] 사람이 쓴 글이 아니라 제외한 턴: ${fmt(r.dropped)}`);
    if (fmt(r.unknownOrigins)) console.error(`[o-brain] 알 수 없는 origin 종류(사람으로 간주해 통과): ${fmt(r.unknownOrigins)}`);
  } catch (e) {
    console.error('[o-brain] 캡처 실패(무시하고 종료):', e?.message || e);
  }
  process.exit(0);
});
