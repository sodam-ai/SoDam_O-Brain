// O-Brain MCP 서버(stdio) — AI가 기억을 직접 검색.  도구: search_memory, get_memory.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { getRelated, getTimeline, addMemory, addRelation, listCategories } from './store.mjs';
import { CATEGORIES } from './classify.mjs';

const db = openDb();
const server = new Server({ name: 'o-brain', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_memory',
      description: '과거 기억을 의미+키워드 하이브리드로 검색한다. 기본은 brief(제목 일부 snippet)로 토큰 절약 — 전체 내용이 필요하면 detail:"full" 또는 get_memory(id). project(현재 작업 폴더 절대경로)를 주면 그 프로젝트+전역을 우선한다.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' }, project: { type: 'string' }, detail: { type: 'string', enum: ['brief', 'full'] } }, required: ['query'] },
    },
    {
      name: 'save_memory',
      description: '대화에서 나온 결정·제약·선호·패턴·지식을 기억으로 저장한다. 사용자가 또렷이 정한 것만(잡담·추측·AI 발언 금지). 저장 전 시크릿은 자동으로 가려진다. project에는 현재 작업 폴더 절대경로를 준다. category를 생략하면 내용 기반 자동분류가 적용된다.',
      inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string', enum: ['결정', '제약', '선호', '패턴', '지식'] }, importance: { type: 'number' }, project: { type: 'string' }, scope: { type: 'string', enum: ['global', 'project'] }, category: { type: 'string', enum: CATEGORIES, description: '생략 시 내용으로 자동분류됨' } }, required: ['content'] },
    },
    {
      name: 'get_memory',
      description: '기억 1건의 전체 내용을 가져온다.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
    },
    {
      name: 'get_related',
      description: '특정 기억과 직접 연결된(관계가 있는) 기억들을 관계 유형·방향과 함께 가져온다. 결정의 근거(뒷받침)·대체(번복)·충돌을 따라갈 때 쓴다.',
      inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
    },
    {
      name: 'get_timeline',
      description: '주제(키워드)에 해당하는 기억을 시간순(오래된→최신)으로 보여, 결정이 어떻게 바뀌어왔는지(대체·충돌 포함) 파악한다. query 생략 시 전체 시간순.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } },
    },
    {
      name: 'add_relation',
      description: '두 기억을 관계로 연결한다. 관계 종류는 호출자가 명시(자동판정 금지): SUPERSEDES(번복)·SUPPORTS(뒷받침)·INFLUENCES(영향)·CONTRADICTS(충돌). 사용자가 확정한 관계만 연결할 것.',
      inputSchema: { type: 'object', properties: { from_id: { type: 'number' }, to_id: { type: 'number' }, type: { type: 'string', enum: ['SUPERSEDES', 'SUPPORTS', 'INFLUENCES', 'CONTRADICTS'] } }, required: ['from_id', 'to_id', 'type'] },
    },
    {
      name: 'list_categories',
      description: '기억의 카테고리 목록과 각 카테고리의 기억 수를 반환한다. UI 필터·주제 파악에 쓴다.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  if (name === 'search_memory') {
    const detail = args.detail === 'full' ? 'full' : 'brief';   // 토큰 절약: 기본 brief, 필요시 full
    const res = await search(db, String(args.query || '').slice(0, 200), Math.min(50, Math.max(1, Number(args.limit) || 8)), args.project ? String(args.project) : null);
    const slim = detail === 'full'
      ? res.map(m => ({ id: m.id, type: m.type, importance: m.importance, content: m.content }))
      : res.map(m => ({ id: m.id, type: m.type, importance: m.importance, snippet: String(m.content).slice(0, 70) }));
    // 관련 기억이 더 있는데 잘렸으면 그 사실을 감추지 않고 알린다(silent truncation 방지).
    const payload = res.total > slim.length
      ? { results: slim, shown: slim.length, total_matches: res.total,
          note: `관련 기억이 ${res.total - slim.length}건 더 있어요 — limit을 높이거나(최대 50) 더 구체적인 검색어로 다시 찾아보세요.` }
      : { results: slim, shown: slim.length, total_matches: res.total };
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
  }
  if (name === 'save_memory') {
    const content = String(args.content || '').trim().slice(0, 1000);
    if (!content) throw new Error('content 필요');
    const type = ['결정', '제약', '선호', '패턴', '지식'].includes(args.type) ? args.type : '지식';
    const importance = Math.min(5, Math.max(1, Number(args.importance) || 3));
    const category = CATEGORIES.includes(args.category) ? args.category : null; // 목록에 없는 값은 무시하고 자동분류로 폴백(안전장치)
    const r = await addMemory(db, { content, type, importance, source: 'ai', confidence: 0.8, project: args.project ? String(args.project) : null, scope: args.scope === 'project' ? 'project' : 'global', category });
    return { content: [{ type: 'text', text: JSON.stringify({ saved: !r.skipped, id: r.id, skipped: !!r.skipped, note: r.skipped ? '동일 내용 기억이 이미 있어 새로 저장하지 않음(중복)' : undefined, redacted: r.redactedHits }) }] };
  }
  if (name === 'get_memory') {
    const m = db.prepare('SELECT * FROM memory WHERE id = ?').get(Number(args.id));
    return { content: [{ type: 'text', text: m ? JSON.stringify(m) : '해당 기억 없음' }] };
  }
  if (name === 'get_related') {
    const rows = getRelated(db, Number(args.id));
    return { content: [{ type: 'text', text: rows.length ? JSON.stringify(rows) : '연결된 기억 없음' }] };
  }
  if (name === 'get_timeline') {
    const rows = getTimeline(db, { query: String(args.query || '').slice(0, 100), limit: Math.min(50, Math.max(1, Number(args.limit) || 20)) });
    return { content: [{ type: 'text', text: rows.length ? JSON.stringify(rows) : '해당 기억 없음' }] };
  }
  if (name === 'add_relation') {
    const r = addRelation(db, { from_id: Number(args.from_id), to_id: Number(args.to_id), type: String(args.type) });
    return { content: [{ type: 'text', text: JSON.stringify({ linked: true, id: r.id, inserted: r.inserted }) }] };
  }
  if (name === 'list_categories') {
    const rows = listCategories(db);
    return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
  }
  throw new Error('unknown tool: ' + name);
});

await server.connect(new StdioServerTransport());
