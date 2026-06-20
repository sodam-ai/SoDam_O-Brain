// (선택) 독립 프로브 — 훅 stdin 형식만 확인하고 종료. hooks.json에서 임시로 가리켜 사용.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './_root.mjs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '_probe.json'), JSON.stringify({ rawStdin: input, env: Object.keys(process.env).filter(k => /SESSION|TRANSCRIPT|CLAUDE|CWD|PROJECT/i.test(k)) }, null, 2));
  } catch {}
  process.exit(0);
});
