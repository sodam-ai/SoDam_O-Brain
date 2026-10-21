// MCP 서버 실행기 — plugin.json이 이 파일을 실행한다. 설치 위치와 무관하게 app/을 찾아 mcp-server.mjs를 띄운다.
// (stdout은 MCP 프로토콜 전용이라 안내는 stderr로만 낸다.)
import { appUrl, rootProblem, OBRAIN_ROOT } from './_root.mjs';

if (!OBRAIN_ROOT) { console.error('[o-brain] ' + rootProblem()); process.exit(1); }
await import(appUrl('mcp-server.mjs'));
