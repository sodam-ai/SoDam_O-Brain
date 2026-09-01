# O-Brain — 구현 작업 브리핑 (AGENTS.md)

> 설계 정본 = `.PRD\` 13문서. 이 파일은 그 위에서 **확정 결정 + 실측 검증 사실 + 다음 할 일**만 1장으로 압축.
> 새 세션은 **이 파일부터** 읽고 시작(PRD 전체 재독 불필요).
> 작성: 2026-06-20 (Step 0 확정 + Step 1 스파이크 + **수직 슬라이스 완료** 시점)
> [정정, 2026-09-01] 이후 M1~M44(44개 마일스톤) 진행됨 — §1·§2·§4의 낡은 부분은 정정 표시
> 해뒀지만, **최신 진행상황의 정본은 `CHECKPOINT.md`**. 이 파일은 여전히 "확정 결정 요약"
> 용도로만 신뢰할 것.

## 0. 한 줄
클로드코드·코덱스 대화에서 기억을 **자동 저장** → **2D/3D 지식그래프+타임라인**으로 보고 검색하는 **100% 로컬 1인용** 도구. 차별점=쌓기가 아니라 "잇고 보여주기".

## 1. 확정된 결정 (Step 0 — lock)
- **구조** = 모노레포: `app/`(로컬 웹앱: DB·검색·서버·웹) + `plugin/`(클로드코드 플러그인: 훅+MCP). 근거: 10(배포 단위).
- **기본 포트** = **7740** (`.env.local`의 `OBRAIN_PORT`로 변경 가능). 기존 1601/7719/8809와 비충돌.
- **바인딩** = `127.0.0.1` 전용(외부 차단, 08).
- **DB 드라이버** = `better-sqlite3`(1순위·prebuilt OK) / 폴백 `node:sqlite`(Node22 내장). 둘 다 sqlite-vec 로드 검증됨.
- **라이선스** = 보류(로컬이라 불필요). 공개 시 Apache-2.0 © SoDam AI Studio (09).
- ~~언어 Node22+TS · 그래프 react-force-graph(2D/3D) · UI Tailwind+shadcn/ui~~ → [정정, 2026-09-01]
  실제 구현: **순수 JS ESM**(`.mjs`, TypeScript 미사용) · Node **26.7.0**(`package.json` engines,
  실측) · 그래프 `force-graph`/`3d-force-graph`(React 아닌 순수 JS 버전 — React 자체 미사용) ·
  UI **순수 CSS + 디자인 토큰**(Tailwind·shadcn/ui 미채택, `06_UI_WIREFRAMES.md` §1과 일치).
  임베딩 `all-MiniLM-L6-v2`(384)만 원안과 동일하게 유지.

## 2. 실측으로 검증된 사실 (스파이크 — 증거)
> [정정, 2026-09-01] 이 표는 2026-06-20 스파이크 시점의 동결 기록. Node 버전만 이후 26.7.0으로
> 올라감(실측) — 나머지(better-sqlite3·sqlite-vec·FTS5·훅 구조·시크릿 필터)는 지금도 유효.

| 항목 | 결과 | 증거 |
|---|---|---|
| Node/플랫폼 | v22.19.0 · win32 x64 · 인터넷 OK | `node -v` |
| better-sqlite3 빌드 | **컴파일러 없이 2초 설치(prebuilt)** → R5 위험 낮음 | npm "added 40 packages in 2s" |
| sqlite-vec(벡터) | v0.1.9 로드 · 384 KNN 검색 OK(0.44ms) | `app/spike/db-spike.mjs` PASS |
| FTS5(키워드) | 동작 | 동 |
| node:sqlite 폴백 | sqlite-vec 확장 로드 OK | 동 |
| 플러그인=훅+MCP (R8) | **가능** — memory-bank가 SessionEnd 추출 + SessionStart 주입 + MCP 동시 운용 | memory-bank `hooks/hooks.json` · discord `.mcp.json` |
| 훅 데이터(자동캡처) | 훅이 `transcript_path`(.jsonl) 제공 · 줄단위 JSON 파싱 가능. 주입 훅은 `{"hookSpecificOutput":{...}}` JSON **출력** 필요 | 실 transcript `.jsonl` |
| 로컬 임베딩(all-MiniLM) | **실제 로드·실행 OK(폴백 아님)** → 의미검색 실동작(속도 정밀측정은 1b) | `npm run seed` → "임베딩 엔진: all-MiniLM-L6-v2" |
| 수직 슬라이스 e2e | 저장(시크릿제거→임베딩→SQLite) → 한국어 하이브리드검색 → HTTP(127.0.0.1:7740) → HTML **전구간 통과** | seed/search/서버 스모크 |
| 시크릿 필터 | 가짜 `sk-` 키 → `[REDACTED:api-key]`로 저장 확인 | seed #4 "시크릿 1건 제거" |

> vec0 주의(실측): rowid는 **`BigInt`**, 임베딩은 **float32 LE blob**(`Uint8Array(Float32Array.buffer)`)로 바인딩해야 함. number/JSON텍스트는 PK 거부.

## 3. ⚠️ 반드시 반영할 발견 (스파이크에서 새로 나옴)
1. **한국어 키워드 검색 함정** — FTS5 기본(unicode61)은 `포트`로 `포트는`을 못 찾음(조사 결합으로 토큰이 달라짐).
   - ✅ 해결(검증): 검색어에 **접두 `*` 자동 부착**(`포트`→`포트*`) → 2자·조사 케이스 모두 매칭.
   - 보조: trigram 토크나이저는 **3자 이상만** 동작(2자 한글 미스) → 보조 인덱스로만 한정.
   - **의미(벡터) 검색이 토큰 빈틈을 보완** → 하이브리드(키워드+벡터+RRF)가 정답. (02·05·07 강화)
2. **시크릿은 'AI 추출 호출 *전*'에도 제거** — PRD는 "저장 전 제거"만 명시(05). 추출 시 대화가 Anthropic으로 전송되므로, **전송 전에도** 시크릿 스캔/마스킹하거나 감지 시 `rule` 모드로 전환. (보안·R2 — "100% 로컬 안심" 보호)

## 4. 다음 할 일 (강력 추천 순서)
> [정정, 2026-09-01] 아래 1~5번은 2026-06-20~23 시점 기록(역사 보존용, 삭제 안 함). 이후
> M1~M44 진행됐고 **최신 상태는 `CHECKPOINT.md`가 정본** — 예: 4번의 "영문 README"는
> `README.en.md`/`README.en.html`로 이미 완료됨.

1. ✅ **[완료] 얇은 수직 슬라이스** — `app/src`(db·redact·embed·search·store·server) + `app/web/index.html`. 저장→한국어 하이브리드검색→localhost(7740)→HTML 전구간 실동작. 실행: `npm run seed` → `npm start` → 브라우저 `http://127.0.0.1:7740`.
2. ✅ **[Phase 1a — 실기기 자동캡처 확인 완료(2026-06-20)]** 실세션에서 결정문장 말하고 `/clear`(=SessionEnd) → **자동저장 성공**(#6 [결정] "포트 7740", 총 6건). SessionEnd stdin 스키마 확정 = `{session_id, transcript_path, cwd, hook_event_name, reason}`. `/clear`도 SessionEnd 발화. **미확인**: SessionStart 주입(되읽기) 실사용 · MCP 도구 실사용. ↓아래는 구현 이력:
   🔄 **[코어 구현·자체검증]** `plugin/`(훅+MCP 선언·런처) + `app/src`(`extract.mjs`·`extract-session.mjs`·`inject.mjs`·`mcp-server.mjs`). 자체검증 통과: 전사파싱→시크릿제거(전송 전)→규칙추출→저장 / SessionStart 주입문 / MCP `search_memory`·`get_memory`. **남은 1건(사용자 실행)**: 클로드코드 ①`/plugin marketplace add <plugin폴더>` ②`/plugin install o-brain@o-brain-local` → 실세션 종료로 자동캡처 + `app/data/_probe.json`(SessionEnd stdin 스키마) 확정 → 새 세션 주입 확인. (아키텍처: 무거운 코드/의존성=app/, 플러그인=절대경로 동적 import → 설치복사에도 견고. 폴더 이동 시 `OBRAIN_ROOT` 환경변수)
3. ✅ **[Phase 1b + 갈무리 완료(2026-06-20)]** 그래프 2D/3D(react-force-graph, **브라우저 직접 검증**·의미유사도 엣지) + 타임라인 + **대시보드**(목록·그래프·타임라인 탭+검색+상세, `app/web/index.html`) + **자동백업**(`backup.mjs`, 시작시+수동, data/backup 7개 회전) + **README.md**(비개발자 사용설명서) + 슬래시명령 `/o-brain:status·selftest·backup`. → **v0.1 end-to-end 작동, 실사용 단계.**
4. **(다음 · 실사용 후 결정)** 되읽기 충돌 근본수리(기억에 project 스코프 = 스키마) · 그래프 폴리시(과확대) · 라이선스 확정(공개 시) · 영문 README.
5. **(결정 변경 2026-06-23)** AI 추출은 유료 Haiku API가 아니라 **호스트 LLM(save_memory/remember) 재활용**으로 구현 — 사용자 지시(무과금) 반영, PRD의 Haiku 기본 결정 폐기.

## 5. 관통 원칙 (처음~끝)
실제 SQLite(목업 X) · 시크릿 **저장 전 + 전송 전** 제거 · AI 호출 가시화 · 100% 로컬 · 비가역=확인 게이트 · 백업 day1 · 친절한 한국어 에러.

## 6. 미해결(차단 아님)
- 코덱스 로그 경로/형식 → Phase 2 · react-force-graph 3D 성능 실측 → 1b · 라이선스 확정 → 공개 시점.

## 7. 폴더 메모
- `app/spike/`(`db-spike.mjs`, `fts-korean.mjs`) = 검증용 버리는 코드. 패턴은 본체로 승격됨 → **삭제 가능**.
- `app/node_modules/` = better-sqlite3 + sqlite-vec(실 의존성, 유지).
