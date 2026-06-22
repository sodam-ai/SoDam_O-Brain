// 플러그인이 설치 복사돼도 app/ 코어를 절대경로로 찾도록.
// 폴더를 옮기면 OBRAIN_ROOT 환경변수로 덮어쓰면 됨.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OBRAIN_ROOT = process.env.OBRAIN_ROOT || 'D:\\AI_Dev_Work\\2026y\\26y_06m_21d_SoDam_O-Brain';
export const appUrl = (rel) => pathToFileURL(join(OBRAIN_ROOT, 'app', 'src', rel)).href;
export const dataDir = () => join(OBRAIN_ROOT, 'app', 'data');
