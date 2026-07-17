# O-Brain 플러그인 (훅 + MCP)

클로드코드 대화에서 기억을 **자동 저장**(SessionEnd)하고, 새 세션에 **자동 주입**(SessionStart)하며, AI가 직접 검색할 **MCP 도구**(`search_memory`·`get_memory`)를 제공합니다.

> 무거운 코드·의존성은 모두 `../app`에 있습니다. 이 폴더는 얇은 선언·런처입니다.
> 코어는 이 폴더 기준 상대경로(`../app`)로 자동으로 찾습니다(plugin/과 app/이 항상 형제 폴더인 한 어느 컴퓨터에서도 동작). 두 폴더를 따로 떨어뜨려 둔 경우에만 환경변수 `OBRAIN_ROOT`를 새 경로로 설정하세요.

## 설치(로컬) — 2단계
1. (한 번만) 앱 의존성: `cd ../app && npm install`
2. 클로드코드에서 **목록 등록**: `/plugin marketplace add <이 저장소를 내려받은 경로>\plugin` (예: 이 저장소를 `C:\Tools\O-Brain`에 내려받았다면 `/plugin marketplace add C:\Tools\O-Brain\plugin`)
3. 클로드코드에서 **설치**: `/plugin install o-brain@o-brain-local`
4. **클로드코드 새로 시작** → 훅·MCP 등록 완료.

> `o-brain` = 플러그인 이름, `o-brain-local` = 마켓플레이스 이름(둘 다 `.claude-plugin/marketplace.json`에 정의).
> 혹시 "git repo가 아니다"라는 이유로 2번이 막히면: 이 폴더에서 `git init && git add -A && git commit -m init` 후 재시도.

## 상태 확인
- 클로드코드에서: `/o-brain:status`  또는
- 직접: `cd ../app && npm run status`  (총 기억·최근 기억·훅 발화 여부)

## 동작
- **세션 종료** → `scripts/memory-extract-hook.mjs` → 대화 추출(기본 규칙) → `app/data/obrain.db` 저장
- **세션 시작** → `scripts/memory-inject-hook.mjs` → 이전 기억 소량 주입
- **MCP** → `app/src/mcp-server.mjs` → `search_memory` / `get_memory`

## 확인
- `app/data/_probe.json` : 실제로 받은 SessionEnd stdin 형식(스키마 확인용)
- 그래프 화면: `cd ../app && npm start` → `http://127.0.0.1:7740`
