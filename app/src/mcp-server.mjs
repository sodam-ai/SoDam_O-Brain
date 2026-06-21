// O-Brain MCP 서버(stdio) — AI가 기억을 직접 검색.  도구: search_memory, get_memory.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { openDb } from './db.mjs';
import { search } from './search.mjs';
import { getRelated, getTimeline } from './store.mjs';

const db = openDb();
const server = new Server({ name: 'o-brain', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_memory',
      description: '과거 기억을 의미+키워드 하이브리드로 검색해 소량 반환한다.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  if (name === 'search_memory') {
    const res = await search(db, String(args.query || '').slice(0, 200), Math.min(50, Math.max(1, Number(args.limit) || 8)));
    const slim = res.map(m => ({ id: m.id, type: m.type, importance: m.importance, content: m.content }));
    return { content: [{ type: 'text', text: JSON.stringify(slim) }] };
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
  throw new Error('unknown tool: ' + name);
});

await server.connect(new StdioServerTransport());
