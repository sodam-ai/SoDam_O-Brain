# O-Brain — 리서치 출처 (PRD 작성에 탐색한 자료)

> 11 — PRD 작성에 조사한 사이트·저장소·자료 모음 + **출처→PRD 반영 추적표**.
> 생성일 2026-06-20 · 갱신 v13 · 조사 도구: WebFetch(직접 정독) / WebSearch(검색).
> 정직성 표기: **[정독]** 페이지를 직접 가져와 분석함 · **[검색]** 검색 결과 제목·요약만 확인(전문 미독, 인용 전 재확인 필요).

## 조사 요약
- **직접 정독한 저장소: 9개** (핵심 4 + 유사 5) — 사실 신뢰도 높음.
- **검색만 한 자료: 다수** (유사 저장소 6 + 기술글 13) — 배경 파악용, 세부는 재확인 필요.
- 시점: 2026년 6월(미국 기준 검색). 스타수·라이선스·기능은 변동 가능.

---

## A. 핵심 참고 저장소 (사용자 지정 · **[정독]**)

| 저장소 | URL | 핵심(정독 확인) |
|--------|-----|----------------|
| claude-mem | https://github.com/thedotmack/claude-mem | 훅 5종·토큰 절약 점진공개·SQLite/Chroma·플러그인 |
| memory-bank | https://github.com/jung-wan-kim/memory-bank | 온톨로지·타입관계 4종·sqlite-vec·3D·`/plugin install` |
| Revka | https://github.com/KumihoIO/Revka | 오케스트레이션·Kumiho(관리형 서버 → 로컬과 불일치, 배제) |
| agentmemory | https://github.com/rohitg00/agentmemory | 순수 SQLite·보안필터·4-tier·RRF 검색융합 |

---

## B-1. 유사 저장소 — **[정독]** (이번에 직접 정독, 5개)

| 저장소 | URL | 정독 핵심 → 반영 |
|--------|-----|------------------|
| Cognee | https://github.com/topoteretes/cognee | 온톨로지 진화·자동라우팅 / 단 Kuzu·무거움 → 차별점(가벼움) 확인 |
| Graphiti | https://github.com/getzep/graphiti | bi-temporal·자동무효화·episode sprawl 경고 → 원문 미저장(05) |
| Memento MCP | https://github.com/gannonh/memento-mcp | confidence(0~1)+반감기 감쇠(30일)+strength → confidence 필드(02·07) |
| claude-knowledge-graph | https://github.com/NodeNestor/claude-knowledge-graph | 랭킹 `sim×0.7+imp×0.2+rec×0.1`·dedup 0.92·7훅 → 07·03 반영 |
| codegraph | https://github.com/colbymchenry/codegraph | 로컬 SQLite/FTS5·MCP 4툴 / 네트워크드라이브 SQLite 락 → 05·08 경고 |

---

## B-2. 유사 저장소 — **[검색]** (제목·요약만, 미정독)

| 저장소/도구 | URL | 메모 |
|--------|-----|------|
| memory-graph | https://github.com/memory-graph/memory-graph | 관계 추적 MCP |
| Memory-KG-3D | https://github.com/TheSethRose/Memory-Knowledge-Graph-3D | Force-Graph 3D 검증(06 참고) |
| buildautomata 3D viz | https://glama.ai/mcp/servers/@brucepro/buildautomata_memory_mcp | 3D 시각화 사양(크기·글로우·필터 → 06 참고) |
| claude-graph-memory | https://github.com/amarodeabreu/claude-graph-memory | 100% 로컬 그래프 |
| mcp-knowledge-graph | https://github.com/shaneholloman/mcp-knowledge-graph | 로컬 KG MCP |
| awesome-ai-agents-2026 | https://github.com/ARUNAGIRINATHAN-K/awesome-ai-agents-2026 | 도구 목록 |
| Logseq-Obsidian | https://github.com/Logseq-Obsidian | 그래프뷰(로컬↔글로벌·고아노드 → 06 디자인) |
| InfraNodus(PKM 그래프) | https://infranodus.com/use-case/visualize-knowledge-graphs-pkm | 지식그래프 시각화 사례 |

---

## C. 시각화 라이브러리 (선택 근거)

| 라이브러리 | URL | 결론 |
|------|-----|------|
| react-force-graph | https://github.com/vasturiano/react-force-graph | **채택**(2D+3D·WebGL) |
| Cytoscape.js | https://js.cytoscape.org/ | Phase 3 분석 보조(SVG, ~1만노드 한계로 본체 탈락) |
| vis-timeline | https://github.com/visjs/vis-timeline | 타임라인 채택 |
| 비교글(Cytoscape/vis/Sigma) | https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-javascript-2026 | [검색] 교체 근거 |
| Neo4j 시각화 도구 정리 | https://neo4j.com/blog/graph-visualization/neo4j-graph-visualization-tools/ | [검색] 개요 |

---

## D. 기술 스택 · 표준 (공식 문서는 출시 전 라이선스 재확인 — 09 참조)

- SQLite / FTS5 / sqlite-vec — 로컬 저장·검색
- @huggingface/transformers (transformers.js) + 모델 `all-MiniLM-L6-v2` — 로컬 임베딩(384)
- React · Vite · Tailwind CSS · shadcn/ui · lucide — UI
- better-sqlite3 · express · @anthropic-ai/sdk
- OWASP ASVS Level 1 — 보안 기준

---

## E. 정보 기사 · 비교글 ([검색] · 배경 파악용)

- https://www.augmentcode.com/learn/claude-mem-74k-stars-agent-memory
- https://www.producthunt.com/products/agent-memory-dev
- https://knightli.com/en/2026/05/19/agentmemory-persistent-memory-ai-coding-agents/
- https://agentpedia.codes/blog/agentmemory-persistent-memory-ai-coding-agents
- https://www.mindstudio.ai/blog/persistent-memory-system-claude-code-agents
- https://www.mindstudio.ai/blog/obsidian-3d-agent-memory-graph-gemini-video-api-claude-code
- https://fast.io/resources/best-knowledge-graph-tools-rag/
- https://mem0.ai/blog/graph-memory-solutions-ai-agents
- https://atlan.com/know/best-ai-agent-memory-frameworks-2026/
- https://www.mempalace.tech/blog/best-ai-memory-frameworks-2026
- https://fountaincity.tech/resources/blog/agent-memory-knowledge-systems-compared/
- marktechpost.com — "Meet Memory OS"(2026-06-01)  *[부분 URL — 재검색 필요]*
- dev.to/mir_mursalin_ankur — "Graphify + code-review-graph"  *[부분 URL — 재검색 필요]*

---

## F. 출처 → PRD 반영 추적표 (어느 자료가 어디에 반영됐나)

| 출처 | 반영된 PRD 위치 |
|------|----------------|
| memory-bank | 01/02 온톨로지·타입관계 · 04 sqlite-vec · 06 3D |
| agentmemory | 08 보안필터 · 04 순수 SQLite · 05 RRF |
| claude-mem | 07 훅·토큰절약 · 10 플러그인 배포 |
| Revka(배제) | 01/10 관리형 서버 회피 근거 |
| Cognee | 02 온톨로지 진화 · 차별점(가벼움) |
| Graphiti | 02 bi-temporal · 05 원문 미저장 |
| Memento | 02 confidence·source · 07 신뢰도 감쇠 |
| claude-knowledge-graph | 07 랭킹 공식 · 03 dedup 0.92 |
| codegraph | 05·08 네트워크 드라이브 락 경고 |
| buildautomata · TheSethRose · Obsidian | 06 3D 시각화·로컬↔글로벌·고아노드 |
| react-force-graph · pkgpulse 비교글 | 04·06 시각화 라이브러리 결정 |
| OWASP ASVS | 08 보안 기준 |

---

## G. 비고 (정확도 한계 — 정직)

- **[정독]은 9개**(핵심 4 + 유사 5). 나머지 [검색] 항목은 전문 미독 → 세부 사실 인용 전 재확인 필요.
- 정독본도 README/요약 기준이라 **코드 레벨(스타수·정확 수치)은 미검증**.
- 일부 도구(Supermemory·Recallium·basic-memory·mem0 등)는 검색 요약에 이름만 등장, 확정 URL 미수집.
- E의 *[부분 URL]* 2건은 끝부분이 잘려 그대로 클릭 불가 — 정확 인용 시 재검색 필요.
