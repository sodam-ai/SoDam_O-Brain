# 목록 불러오기 개수 조절 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 목록/타임라인/개요가 항상 100개씩만 불러오던 것을, 사용자가 50/100/200/500 중 고르거나 직접 숫자를 입력해 조절할 수 있게 한다. (그래프 탭은 `/api/graph`를 별도로 써서 이 범위 밖 — `initGraph()` 확인됨)

**Architecture:** 하드코딩된 `limit=100` 3곳을 새 전역 상태 `pageSize`로 교체하고, 필터바에 개수 선택 드롭다운(+커스텀 숫자 입력)을 추가해 값이 바뀌면 `all=[]` 후 `softRefresh()`로 처음부터 다시 불러온다. 서버는 이미 1~500 범위로 클램프하므로 서버 코드 변경 없음.

**Tech Stack:** 순수 JS(모듈 없음), `app/web/index.html` 단일 파일. 이 프로젝트엔 자동 테스트 프레임워크가 없어 `app/src/selftest.mjs`(회귀) + chrome-devtools MCP를 통한 실제 브라우저 클릭 검증으로 대체한다(이 프로젝트의 기존 검증 관례).

## Global Constraints

- 서버가 이미 `/api/memories`의 `limit`을 1~500으로 클램프함(`app/src/server.mjs`) — 클라이언트도 1~500으로 제한해 서버와 일치시킬 것.
- 이 프로젝트는 94KB 단일 `index.html` 파일이라 회귀 위험이 있음 — 작은 단위로 수정 후 매번 selftest + 브라우저 시각 확인(CHECKPOINT.md 관례).
- 기존 필터(중요도/기간/프로젝트/범위)는 새로고침 시 초기화되는 세션 한정 방식 — pageSize도 동일하게 세션 한정으로 만들 것(localStorage 사용 금지, 사용자 확정 사항).
- 기존 코드 스타일 그대로 따를 것: `sortsel` 클래스, `sb.querySelector('#id').addEventListener('change', ...)` 패턴(`app/web/index.html:719-724`).

---

### Task 1: pageSize 상태 추가 + 3곳의 하드코딩된 limit=100 교체

**Files:**
- Modify: `app/web/index.html:550` (상태 변수 추가)
- Modify: `app/web/index.html:559` (loadMore)
- Modify: `app/web/index.html:1227` (초기 로드)
- Modify: `app/web/index.html:1236` (softRefresh)

**Interfaces:**
- Consumes: 없음(신규 전역 변수)
- Produces: 전역 변수 `pageSize`(숫자, 기본 100), `pageSizeCustomMode`(불리언, 기본 false) — Task 2가 UI에서 이 값들을 읽고 씀

- [ ] **Step 1: `pageSize` 전역 상태 추가**

`app/web/index.html:550` 현재:
```js
    let statTotal = 0, listLoading = false; const _memCache = {}; // 대량 대비: 전체 총계 + 목록 더보기 + 단건 캐시
```
다음으로 교체:
```js
    let statTotal = 0, listLoading = false; const _memCache = {}; // 대량 대비: 전체 총계 + 목록 더보기 + 단건 캐시
    let pageSize = 100; // 목록/타임라인/개요 초기 로드 개수(사용자 조절 가능, 세션 한정 — 새로고침 시 100으로 초기화). 그래프 탭은 /api/graph 별도 사용, 영향 없음.
    let pageSizeCustomMode = false; // "직접 입력…" 선택 시 숫자칸을 펼쳐두기 위한 UI 상태(Task 2에서 사용)
```

- [ ] **Step 2: `loadMore()`의 하드코딩된 100을 pageSize로 교체**

`app/web/index.html:559` 현재:
```js
      try{ const next=await get('/api/memories?limit=100&offset='+all.length+(travelDate?'&at='+travelDate:''));
```
다음으로 교체:
```js
      try{ const next=await get('/api/memories?limit='+pageSize+'&offset='+all.length+(travelDate?'&at='+travelDate:''));
```

- [ ] **Step 3: 초기 로드의 하드코딩된 100을 pageSize로 교체**

`app/web/index.html:1227` 현재:
```js
    Promise.all([ get('/api/memories?limit=100&offset=0'+(travelDate?'&at='+travelDate:'')), get('/api/relations').catch(()=>[]), get('/api/stats').catch(()=>null) ])
```
다음으로 교체:
```js
    Promise.all([ get('/api/memories?limit='+pageSize+'&offset=0'+(travelDate?'&at='+travelDate:'')), get('/api/relations').catch(()=>[]), get('/api/stats').catch(()=>null) ])
```

- [ ] **Step 4: softRefresh()의 하드코딩된 100을 pageSize로 교체**

`app/web/index.html:1236` 현재:
```js
        const [m,r,s] = await Promise.all([ get('/api/memories?limit=100&offset=0'+(travelDate?'&at='+travelDate:'')), get('/api/relations').catch(()=>[]), get('/api/stats').catch(()=>null) ]);
```
다음으로 교체:
```js
        const [m,r,s] = await Promise.all([ get('/api/memories?limit='+pageSize+'&offset=0'+(travelDate?'&at='+travelDate:'')), get('/api/relations').catch(()=>[]), get('/api/stats').catch(()=>null) ]);
```

- [ ] **Step 5: 브라우저에서 아직 아무 변화 없는지 확인(순수 리팩터링 단계)**

`npm start`로 서버 기동 중이면 재시작 불필요(정적 파일이라 새로고침만). chrome-devtools MCP로 `http://127.0.0.1:7740/` 새로고침 후 콘솔 에러 0건, 그래프/목록 탭이 이전과 동일하게(기본 100개) 보이는지 확인. `pageSize`가 아직 100 고정이라 동작 변화가 없어야 정상.

- [ ] **Step 6: 회귀 확인**

Run: `cd app && node src/selftest.mjs`
Expected: `✅ 1. 기억이 저장됨` / `✅ 2. 시크릿(sk-...) 자동 가림` / `✅ 3. 한국어 검색으로 다시 찾음` 3개 모두 통과

- [ ] **Step 7: Commit**

```bash
git add app/web/index.html
git commit -m "refactor: 목록 불러오기 limit=100을 pageSize 변수로 교체(동작 변화 없음, 다음 커밋의 기반)"
```

---

### Task 2: 개수 선택 드롭다운 + 직접입력 UI 추가

**Files:**
- Modify: `app/web/index.html:709-724` (renderSubbar 함수 — 드롭다운 렌더링 + change 이벤트 wiring)

**Interfaces:**
- Consumes: 전역 변수 `pageSize`, `pageSizeCustomMode`(Task 1에서 생성), 전역 함수 `softRefresh()`(기존)
- Produces: 없음(UI 종단 기능)

- [ ] **Step 1: scopeSel/travelDate 렌더링 뒤에 개수 선택 드롭다운 추가**

`app/web/index.html:709-713` 현재:
```js
      html+=`<select class="sortsel" id="scopeSel" aria-label="범위 필터">
        <option value=""${scopeFilter===''?' selected':''}>범위 전체</option>
        <option value="global"${scopeFilter==='global'?' selected':''}>전역(global)</option>
        <option value="project"${scopeFilter==='project'?' selected':''}>프로젝트(project)</option></select>
      <input type="date" id="travelDate" class="sortsel" title="시간여행: 이 날짜 기준으로 살아있던 기억만 표시" value="${travelDate}" max="${new Date().toISOString().slice(0,10)}">`;
```
다음으로 교체(마지막 줄 뒤에 pageSize 드롭다운 추가):
```js
      html+=`<select class="sortsel" id="scopeSel" aria-label="범위 필터">
        <option value=""${scopeFilter===''?' selected':''}>범위 전체</option>
        <option value="global"${scopeFilter==='global'?' selected':''}>전역(global)</option>
        <option value="project"${scopeFilter==='project'?' selected':''}>프로젝트(project)</option></select>
      <input type="date" id="travelDate" class="sortsel" title="시간여행: 이 날짜 기준으로 살아있던 기억만 표시" value="${travelDate}" max="${new Date().toISOString().slice(0,10)}">`;
      const pageSizePreset=[50,100,200,500];
      const pageSizeShowCustom = pageSizeCustomMode || !pageSizePreset.includes(pageSize);
      html+=`<select class="sortsel" id="pageSizeSel" aria-label="한 번에 불러올 개수" title="목록·타임라인·개요에 한 번에 불러올 기억 개수(1~500). 그래프 탭에는 적용되지 않음.">
        <option value="50"${pageSize===50?' selected':''}>50개씩</option>
        <option value="100"${pageSize===100?' selected':''}>100개씩</option>
        <option value="200"${pageSize===200?' selected':''}>200개씩</option>
        <option value="500"${pageSize===500?' selected':''}>500개(최대)</option>
        <option value="custom"${pageSizeShowCustom?' selected':''}>직접 입력…</option></select>`;
      if(pageSizeShowCustom){
        html+=`<input type="number" id="pageSizeCustom" class="sortsel" min="1" max="500" step="1" value="${pageSize}" title="1~500 사이 원하는 개수" style="width:72px">`;
      }
```

**왜 `pageSizeCustomMode`가 별도로 필요한가**: `pageSize` 하나만으로 "숫자칸을 보여줄지" 판단하면(`!pageSizePreset.includes(pageSize)`), 이미 100(preset)인 상태에서 드롭다운의 "직접 입력…"을 막 선택한 시점에도 `pageSize`는 여전히 100(=preset)이라 조건이 거짓이 되어 숫자칸이 안 뜨고 드롭다운이 "100개씩"으로 즉시 되돌아가는 버그가 생긴다. "적용된 값"과 "펼침 의도"는 서로 다른 상태라 따로 관리해야 한다.

- [ ] **Step 2: change 이벤트 wiring 추가**

`app/web/index.html:724` 현재(마지막 wiring 줄):
```js
      const _td=sb.querySelector('#travelDate'); if(_td) _td.addEventListener('change', async e=>{ travelDate=e.target.value; all=[]; await softRefresh(); });
    }
```
다음으로 교체(travelDate 줄 뒤에 pageSize wiring 2개 추가):
```js
      const _td=sb.querySelector('#travelDate'); if(_td) _td.addEventListener('change', async e=>{ travelDate=e.target.value; all=[]; await softRefresh(); });
      const _pgs=sb.querySelector('#pageSizeSel'); if(_pgs) _pgs.addEventListener('change', async e=>{
        if(e.target.value==='custom'){ pageSizeCustomMode=true; renderSubbar(); return; } // 숫자칸만 펼치고, 실제 반영은 그 칸의 change에서
        pageSizeCustomMode=false; pageSize=Number(e.target.value); all=[]; await softRefresh();
      });
      const _pgc=sb.querySelector('#pageSizeCustom'); if(_pgc) _pgc.addEventListener('change', async e=>{
        const n=Math.min(500,Math.max(1,Number(e.target.value)||100));
        pageSizeCustomMode=false; pageSize=n; all=[]; await softRefresh();
      });
    }
```

- [ ] **Step 3: 브라우저 실제 클릭으로 정상흐름 확인**

chrome-devtools MCP로 `http://127.0.0.1:7740/` 새로고침 → 목록 탭 이동 → "한 번에 불러올 개수" 드롭다운에서 "200개씩" 선택 → `evaluate_script`로 `all.length`가 200(또는 전체 데이터가 200 미만이면 전체 개수)인지 확인, 콘솔 에러 0건.

- [ ] **Step 4: 브라우저 실제 클릭으로 "직접 입력" 흐름 확인**

같은 드롭다운에서 "직접 입력…" 선택 → 숫자 입력창이 나타나는지 스냅샷으로 확인 → 그 칸에 `37` 입력 후 change(엔터 또는 포커스 아웃) → `all.length`가 37인지(또는 전체 데이터가 37 미만이면 전체) 확인.

- [ ] **Step 5: 경계값 확인 — 직접입력에 범위 밖 값**

`evaluate_script`로 pageSizeCustom 입력값을 `9999`로 설정 후 change 이벤트 강제 발생 → `pageSize`가 500으로 클램프되는지 확인(서버 상한과 일치). `0`이나 빈 문자열도 시도 → 기본값 100으로 안전하게 폴백되는지 확인(코드의 `Number(e.target.value)||100` 로직).

- [ ] **Step 6: 회귀 확인**

Run: `cd app && node src/selftest.mjs`
Expected: 3개 모두 `✅` 통과, 이전 커밋과 동일

- [ ] **Step 7: "전체" 칩 툴팁이 새 pageSize 기준으로 정확히 갱신되는지 확인**

목록 탭에서 "전체 N" 칩에 마우스를 올려(또는 스냅샷의 description 필드로) "지금까지 불러온 기억이에요(X/Y)" 문구의 X가 방금 고른 pageSize와 일치하는지 확인. 이 툴팁은 2026-07-06 커밋(`bfe8b91`)에서 이미 만들어져 있어 코드 변경 없이 자동으로 올바른 값을 보여줘야 함 — 아니라면 버그이므로 원인 재조사 필요.

- [ ] **Step 8: Commit**

```bash
git add app/web/index.html
git commit -m "feat: 목록/타임라인/개요 불러오기 개수를 화면에서 직접 조절 가능하게 함 (50/100/200/500/직접입력)"
```

---

## Self-Review (계획 작성자가 직접 점검)

1. **스펙 커버리지**: 사용자가 승인한 디자인(드롭다운+직접입력, 세션 한정, 1~500 클램프) 전부 Task 1~2에 반영됨. 누락 없음.
2. **플레이스홀더 스캔**: "TODO"/"나중에"/"적절히 처리" 같은 표현 없음 — 모든 스텝에 실제 코드 포함.
3. **타입/이름 일관성**: `pageSize`/`pageSizeCustomMode`(Task 1에서 정의) → Task 2에서 동일 이름으로만 참조. `pageSizePreset`/`pageSizeShowCustom`은 Task 2 내부 지역 변수로만 사용, 다른 태스크가 참조하지 않음.
4. **위험 반영**: 서버 클램프와의 정합성(Global Constraints), 세션 한정 원칙(사용자 확정), 94KB 파일 회귀 관례(Global Constraints) 전부 명시됨.

## 실행 직전 재검토에서 잡은 결함 2건 (초안 대비 수정 완료)

1. **그래프 탭 오적용 표기**: 초안은 "목록/그래프 모두에 적용"으로 썼으나, `initGraph()`(index.html:1134)가 `/api/graph`를 별도 호출한다는 걸 확인해 실제로는 이 기능이 그래프 탭에 전혀 영향을 주지 않음을 발견. UI 라벨/툴팁/커밋 메시지에서 "그래프" 표기를 전부 제거하고 "그래프 탭에는 적용되지 않음"을 명시했다. 그대로 뒀다면 사용자가 그래프가 안 바뀐다고 오인하고 버그로 오해했을 것.
2. **"직접 입력" 선택 시 즉시 원복되는 결함**: 초안 로직(`!pageSizePreset.includes(pageSize)`)은 "적용된 값"만으로 숫자칸 노출을 판단해서, `pageSize`가 이미 preset(예 100)일 때 드롭다운에서 "직접 입력…"을 선택해도 조건이 거짓이 되어 숫자칸이 안 뜨고 드롭다운이 즉시 "100개씩"으로 되돌아가는 버그가 있었다. `pageSizeCustomMode`라는 별도 UI 상태를 추가해 "적용된 값"과 "펼침 의도"를 분리함으로써 해결.

## 검토했지만 손대지 않기로 한 위험 (범위 밖 판단 — 본래 목적 보호)

- **레이스 컨디션**: pageSize를 빠르게 두 번 바꾸면 늦게 도착한 응답이 먼저 도착한 걸 덮어쓸 가능성이 이론상 있다. 하지만 이미 존재하는 `travelDate` 핸들러(`app/web/index.html:724`)도 동일한 패턴(요청 취소/순서 보장 없음)이라 이번 기능이 새로 만드는 문제가 아니라 기존 코드 전체의 공통 특성이다. "요청받은 부분만 변경"(Minimal Impact) 원칙에 따라 이번 범위에서 별도 해결책을 만들지 않는다 — 실사용에서 실제로 문제가 보고되면 그때 travelDate 포함 전체를 함께 고친다.
