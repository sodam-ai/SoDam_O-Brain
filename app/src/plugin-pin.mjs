// 플러그인 포인터 기록 — `/plugin`으로 설치한 플러그인은 파일이 캐시 폴더로 복사돼 옆에서 app/을 찾을 수 없다.
// 이 명령이 이 컴퓨터의 O-Brain 위치를 ~/.obrain/root에 적어 두면, 훅·MCP·슬래시 명령이 어디에 설치돼 있든 app/을 찾는다.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!existsSync(join(root, 'app', 'src', 'db.mjs'))) {
  console.error('⚠️ O-Brain 폴더 구조가 예상과 달라 기록하지 않았어요: ' + root);
  process.exit(1);
}
const file = join(homedir(), '.obrain', 'root');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, root + '\n');
console.log(`✅ 기록했어요: ${file}\n   → ${root}`);
console.log('이제 클로드코드에서 /plugin 으로 o-brain 플러그인을 업데이트(또는 재설치)해도 app 폴더를 찾아요.');
