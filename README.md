<!-- 한국어: 이 파일 · English: README.en.md · 상세 가이드: GUIDE.md · (이 문서와 README.pdf 내용 동일) -->

# 소담 오브레인 (SoDam O-Brain) — AI 기억 시스템

> **AI와 나눈 대화에서 중요한 결정·약속을 자동으로 저장하고, 지식 그래프로 시각화하는 완전 로컬 기억 도구.**

**비유 한 줄:** AI는 천재지만 대화가 끝나면 모든 걸 잊어버립니다.
O-Brain은 그 AI 옆에 두는 **자동 메모 노트**예요. 중요한 말을 알아서 적어두고, 언제든 꺼내줍니다.

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **100% 로컬** | 모든 기억이 내 PC에만 저장됩니다. 외부 서버·클라우드 전송 없음 |
| **하이브리드 검색** | 키워드(FTS5) + 의미 유사도(벡터 검색)를 동시에 사용 |
| **지식 그래프** | 기억들을 2D/3D 점과 선으로 시각화 |
| **시간여행** | 날짜 지정으로 그 날 기준 살아있던 기억만 조회 |
| **신뢰도 감쇠** | AI 추출 기억은 30일 반감기로 신뢰도 자동 감소 |
| **보안 필터** | API 키·비밀번호 자동 제거 후 저장 (`[REDACTED]`) |
| **자동 백업** | 서버 시작 시·일괄 삭제 전 스냅샷 자동 생성 |
| **MCP 연동** | Claude Code에서 7개 도구로 기억 저장·검색·관계 관리 |
| **고아 노드 시각화** | 관계 없는 기억에 점선 테두리 표시 |

---

## 사전 준비물

| 항목 | 요구 사항 |
|------|-----------|
| 운영체제 | Windows 10 / 11 (64-bit) |
| Node.js | 20.x LTS 이상 ([nodejs.org](https://nodejs.org)에서 무료 설치) |
| 저장 공간 | 500 MB 이상 (임베딩 모델 ~90 MB 포함) |
| RAM | 4 GB 이상 (8 GB 이상 권장) |
| 브라우저 | Chrome, Edge, Firefox 등 |

> Claude Code는 MCP 도구 연동 시에만 필요. 웹 대시보드는 Claude Code 없이도 사용 가능.

---

## 설치 (2단계)

**1단계: 의존성 설치 (터미널에서)**

```bash
cd D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app
npm install
```

**2단계: 서버 시작**

```bash
npm start
```

→ `O-Brain 로컬 서버 ▶ http://127.0.0.1:7740` 메시지가 나오면 성공.

**브라우저에서 열기:**

```
http://127.0.0.1:7740
```

> **첫 실행 시**: AI 임베딩 모델(약 90 MB)을 자동 다운로드합니다. 1~3분 소요. 이후 실행부터는 즉시 시작.

---

## Claude Code 플러그인 방식 (선택)

Claude Code를 사용 중이라면 플러그인으로도 설치 가능합니다:

```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\plugin
/plugin install o-brain@o-brain-local
```

설치 후 Claude Code 재시작 → 슬래시 명령어 사용 가능:

| 명령 | 하는 일 |
|------|---------|
| `/o-brain:status` | 현재 기억 수·상태 조회 |
| `/o-brain:selftest` | 저장·검색·보안 일괄 점검 (✅✅✅이면 정상) |
| `/o-brain:remember` | 현재 대화에서 결정 추출·저장 |
| `/o-brain:link` | 기억끼리 관계 연결 |
| `/o-brain:backup` | 수동 백업 생성 |
| `/o-brain:open` | 브라우저로 대시보드 열기 |

---

## MCP 도구 연동 (Claude Code)

Claude Code `settings.json`에 등록하면 대화 중 기억을 바로 저장·검색할 수 있습니다:

```json
{
  "mcpServers": {
    "o-brain": {
      "command": "node",
      "args": ["C:/절대경로/app/src/mcp-server.mjs"]
    }
  }
}
```

사용 가능한 MCP 도구: `save_memory`, `search_memory`, `get_memory`, `get_related`, `get_timeline`, `add_relation`, `list_categories`

---

## 주요 명령어

```bash
# app/ 폴더에서 실행
npm start          # 서버 시작 (포트 7740)
npm run selftest   # 자가 진단
npm run backup     # 수동 백업
npm run status     # DB 상태 조회
npm run seed       # 예제 데이터 입력 (테스트용)
```

---

## 파일·데이터 위치

| 항목 | 위치 |
|------|------|
| 기억 데이터베이스 | `app/data/obrain.db` |
| 자동 백업 | `app/data/backups/` (최신 10개 보관) |
| API 토큰 파일 | `app/data/.api-token` (실행마다 갱신) |
| 개인 설정 | `app/.env.local` (없으면 기본값 사용) |

### 환경 변수 (`app/.env.local`)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OBRAIN_PORT` | `7740` | 서버 포트 번호 |
| `OBRAIN_DATA_DIR` | `./data` | 데이터 저장 폴더 |

---

## 보안 개요

- 서버는 **127.0.0.1(내 PC 전용)**에만 바인딩 — 외부 기기에서 접근 불가
- 기억 저장 전 **API 키·비밀번호 자동 제거** (redact.mjs 처리)
- 서버 실행마다 새로운 **로컬 API 토큰** 자동 생성 (crypto.randomBytes)
- `data/`, `.env.local`, `*.sqlite`는 `.gitignore`에 포함 — Git에 절대 올라가지 않음
- 외부 클라우드 통신 없음. 임베딩 모델도 완전 로컬 실행

---

## 아키텍처 요약

```
[Claude Code / 브라우저]
        ↓
[Express 서버 127.0.0.1:7740]
        ↓
[보안 필터] → [임베딩(로컬 AI)] → [SQLite DB]
                                    ├── FTS5 (키워드 검색)
                                    └── sqlite-vec (벡터 검색)
```

기술 스택: Node.js ES Modules · Express.js v5 · SQLite (better-sqlite3) · sqlite-vec · @huggingface/transformers (all-MiniLM-L6-v2) · force-graph / 3d-force-graph · @modelcontextprotocol/sdk

---

## 문제해결 빠른 참조

| 증상 | 해결 |
|------|------|
| `'node'은 명령이 아닙니다` | [nodejs.org](https://nodejs.org)에서 LTS 설치 → **터미널 새로 열기** |
| `EADDRINUSE :::7740` | `.env.local`에 `OBRAIN_PORT=7741` 추가 후 재시작 |
| 그래프가 비어 있음 | `npm run seed`로 예제 데이터 추가 |
| 브라우저 접속 안 됨 | `npm start` 실행 확인 → 주소가 `http://127.0.0.1:7740`인지 확인 |
| 임베딩 다운로드 실패 | 인터넷 연결 확인 · 방화벽에서 Node.js 허용 |
| 기억 실수 삭제 | `app/data/backups/` 에서 최신 `.db` 파일 복원 |

상세 가이드: **[GUIDE.md](./GUIDE.md)** (한국어) · **[GUIDE.en.md](./GUIDE.en.md)** (영문)

---

## 라이선스 · 저작권 · 상업적 용도

**Apache License 2.0 © SoDam AI Studio, 2026**

| 항목 | 내용 |
|------|------|
| 개인 사용 | 자유롭게 사용 가능 |
| 수정 · 복제 | 허용 (저작권 고지 보존 필수) |
| 상업적 사용 | Apache-2.0 조건 하에 허용 |
| 보증 | **없음 (AS-IS)** — 사용 결과 책임은 사용자에게 있음 |
| 외부 서비스 | Claude / Anthropic 등 외부 서비스 약관은 별도 적용 |

- 내장 오픈소스 라이브러리(better-sqlite3, sqlite-vec, @huggingface/transformers, force-graph 등)는 **각자의 라이선스**(MIT/Apache-2.0)를 따릅니다
- "Claude", "Anthropic"은 해당 회사의 상표입니다. O-Brain은 이들과 공식 제휴 관계가 없습니다
- 라이선스 전문: `LICENSE` 파일

---

*이 문서와 README.pdf의 내용은 동일합니다.*
*상세 가이드: [GUIDE.md](./GUIDE.md) (한국어) · [GUIDE.en.md](./GUIDE.en.md) (영문)*
