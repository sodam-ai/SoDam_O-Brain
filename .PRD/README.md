# O-Brain — 디자인 문서

> Show Me The PRD로 생성됨 (2026-06-20, v13 — 이름 O-Brain 확정 + 사용자 문서(README/가이드) 요구사항 추가)
> 제품명: **O-Brain** (O=Ontology/기억 두뇌. 공개 전 상표 확인은 09)

클로드코드·코덱스의 대화에서 중요한 기억을 **자동으로 저장**하고, **2D/3D 지식그래프 + 타임라인으로 풍부하게 시각화·탐색·검색**하는 **100% 로컬 1인용** 도구.

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 무엇을·누가·핵심가치 + **§8 시각화 사양** | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조(프로젝트·세션·기억·연결·분류 + 시각화/시간 필드) | DB 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | 단계별 계획(Phase 1~3) | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택 + 시각화 규칙 + AI 규칙 | AI에게 코드 시킬 때마다 |
| [05_SPEC_DETAIL.md](./05_SPEC_DETAIL.md) | 비기능·보안·에러·백업·테스트·리스크·KPI·용어집 | 품질·안전 점검할 때 |
| [06_UI_WIREFRAMES.md](./06_UI_WIREFRAMES.md) | 화면 와이어프레임 + UI/UX 요구사항(디자인시스템·타이포·반응형·상태·접근성·MoSCoW) | UI 만들 때 |
| [07_AGENT_INTEGRATION.md](./07_AGENT_INTEGRATION.md) | AI가 기억을 되읽는 법(자동 주입·MCP 도구·토큰 절약) | AI 연동 만들 때 |
| [08_SECURITY.md](./08_SECURITY.md) | 보안 요구사항(ASVS L1·시크릿·인젝션·로컬 접근통제·MoSCoW) | 만들기 전·내내 |
| [09_LICENSE_LEGAL.md](./09_LICENSE_LEGAL.md) | 법률·저작권·라이선스·상업적 용도(법률자문 아님, 결정/검토 구분) | 공개·배포·납품 전 |
| [10_DEPLOYMENT_INSTALL.md](./10_DEPLOYMENT_INSTALL.md) | 통합·배포(클로드코드=플러그인·코덱스=MCP·GUI=로컬서버), 설치/업데이트/제거 | 설치/배포 만들 때 |
| [11_RESEARCH_SOURCES.md](./11_RESEARCH_SOURCES.md) | PRD 작성에 탐색한 저장소·라이브러리·기사 출처(정독/검색 구분) | 근거 확인할 때 |
| [12_USER_DOCS_GUIDE.md](./12_USER_DOCS_GUIDE.md) | 사용자 문서(README·가이드) 요구사항 + 초보자 오류 카탈로그 | 문서 만들 때(구현 후) |

## 핵심 결정 요약 (확정됨)

- **목적**: 클로드코드·코덱스 로컬 메모리 + **지식그래프 시각화** (1인용)
- **차별점(핵심)**: 기억을 '쌓는' 게 아니라 '잇고 보여주는' 도구 — **2D/3D 그래프 + 타임라인**
- **기술**: Node·TypeScript 올인원 + SQLite(sqlite-vec/FTS5) + ~~React~~ → **[확인됨, 2026-08-03 갱신] 바닐라 JS** + force-graph/3d-force-graph(2D/3D·WebGL)
- **로그인**: 없음 (로컬 전용)
- **기억 추출**: 규칙기반이 기본(완전 로컬·무과금), 필요 시 호스트 LLM(클로드코드/코덱스) 수동 호출도 가능·외부 영구저장 없음
- **보안**: 저장 전 민감정보(비밀번호 등) 자동 제거 — Phase 1 포함

## v2 변경점 (시각화 격상)

- 시각화를 **Phase 1 핵심**으로 격상 (이전엔 2D 기본·3D는 Phase 3였음).
- 그래프 라이브러리 **Cytoscape.js → force-graph/3d-force-graph**(WebGL·2D+3D 통합, ~1만 노드 한계 극복) — 2026-08-03: React 미사용 확정에 맞춰 non-React 버전으로 재확정.
- **타임라인 뷰** + 시각화/시간 필드(access_count·valid_from/until·invalidated_by) 추가.
- 유사 저장소 6개(Cognee·Graphiti·Memento·buildautomata 3D·TheSethRose·Obsidian) 장점 흡수.

## 다음 단계

Phase 1을 시작하려면 [03_PHASES.md](./03_PHASES.md)의 **"Phase 1 시작 프롬프트"**를 복사해 AI에게 주세요.
시작 전 권장: 그래프 라이브러리(force-graph/3d-force-graph)·임베딩·코덱스 훅 1회 손검증.

## 확정된 결정 (v3 — 모두 Resolved)

- [x] 그래프: ~~react-force-graph~~ → **force-graph/3d-force-graph**(2D+3D) + 타임라인 ~~vis-timeline~~ → **커스텀 HTML/CSS**(2026-08-03 갱신)
- [x] 임베딩: **transformers.js `all-MiniLM-L6-v2` (384)** 기본
- [x] 코덱스: ~~훅 + 세션 로그 파일 폴백(미성숙 위험을 설계로 낮춤)~~ → **미착수·의도적 보류**(코덱스 실사용 근거 없음, 2026-08-03 CHECKPOINT 확정)
- [x] 추출: ~~기본 claude-haiku-4-5(유료 API)~~ → **규칙기반이 기본**(완전 로컬·무과금, 2026-08-03 갱신) + 규칙기반 폴백
- [x] scope 기본 `project` / 분류 시드 제공 / 이름 **O-Brain**(변경 가능)

### 빌드 중 1회 수치 실측만 남음 (결정 X, 수치 확인 O)
- ~~react-force-graph~~ force-graph/3d-force-graph 3D 프레임 · all-MiniLM 속도 · 코덱스 로그 경로(코덱스 캡처는 보류 중이라 미실측)
