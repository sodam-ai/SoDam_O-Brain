// SessionEnd 훅 — 세션이 끝나면 대화에서 기억을 자동 추출·저장.
// 항상 exit(0): 실패해도 세션 종료를 막지 않는다. 대신 결과를 _last_capture.json에 남겨 `status`가 드러낸다(은폐 아님).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appUrl, dataDir, rootProblem } from './_root.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let hookVersion = 'unknown';
try { hookVersion = JSON.parse(readFileSync(join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch {}

// "훅이 불렸는가"가 아니라 "저장까지 성공했는가"를 남긴다(조용한 실패 가시화 — PRD 05 §3, R9).
// 설치된 훅이 구버전이면 이 파일이 아예 생기지 않아, status가 구버전도 알아챌 수 있다.
function record(rec) {
  try {
    const dir = dataDir(); if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '_last_capture.json'), JSON.stringify({ at: new Date().toISOString(), hookVersion, ...rec }));
  } catch {}
}

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  try {
    const problem = rootProblem();
    if (problem) { console.error('[o-brain] ' + problem); process.exit(0); }
    const payload = JSON.parse(input || '{}');
    // 프로브: 실제로 받은 stdin 형식을 남겨 둠(스키마 확인용).
    try {
      const dir = dataDir();
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '_probe.json'), JSON.stringify({ keys: Object.keys(payload), payload }, null, 2));
    } catch {}

    const transcriptPath = payload.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH;
    if (!transcriptPath) { console.error('[o-brain] transcript_path 없음 — 건너뜀'); record({ ok: false, error: 'transcript_path 없음' }); process.exit(0); }

    const { captureSession } = await import(appUrl('extract-session.mjs'));
    const r = await captureSession({ transcriptPath, projectPath: payload.cwd });
    record({ ok: true, exchanges: r.exchanges, candidates: r.candidates, saved: r.saved.length, skipped: r.skipped || null });
    if (r.skipped) console.error('[o-brain] 프로그램이 호출한(sdk) 세션 — 기억 후보 추출을 건너뜀 (켜려면 app/.env.local에 OBRAIN_CAPTURE_SDK=1)');
    else console.error(`[o-brain] 캡처: 대화 ${r.exchanges} → 후보 ${r.candidates} → 저장 ${r.saved.length}건`);
    // 무엇이 왜 제외됐는지 숨기지 않는다(PRD 05 §3). 알 수 없는 origin 종류는 사람으로 간주해 통과시킨 것.
    const fmt = (o) => Object.entries(o || {}).map(([k, v]) => `${k} ${v}`).join(', ');
    if (fmt(r.dropped)) console.error(`[o-brain] 사람이 쓴 글이 아니라 제외한 턴: ${fmt(r.dropped)}`);
    if (fmt(r.unknownOrigins)) console.error(`[o-brain] 알 수 없는 origin 종류(사람으로 간주해 통과): ${fmt(r.unknownOrigins)}`);
  } catch (e) {
    console.error('[o-brain] 캡처 실패(무시하고 종료):', e?.message || e);
    record({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
  process.exit(0);
});
