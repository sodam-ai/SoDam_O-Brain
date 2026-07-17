// plugin/과 app/은 항상 형제 폴더 — 이 파일 자신의 위치 기준 상대경로로 app/을 찾는다(어느 컴퓨터에 설치돼도 동작).
// 두 폴더를 따로 떨어뜨려 둔 특수한 경우에만 OBRAIN_ROOT 환경변수로 덮어쓰면 됨.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OBRAIN_ROOT = process.env.OBRAIN_ROOT || join(HERE, '..', '..');
export const appUrl = (rel) => pathToFileURL(join(OBRAIN_ROOT, 'app', 'src', rel)).href;
export const dataDir = () => join(OBRAIN_ROOT, 'app', 'data');
