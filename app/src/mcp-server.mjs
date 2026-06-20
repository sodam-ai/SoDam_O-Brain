// O-Brain MCP 서버(stdio) — AI가 기억을 직접 검색.  도구: search_memory, get_memory.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { openDb } from './db.mjs';
import { search } from './search.mjs';

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
  throw new Error('unknown tool: ' + name);
});

await server.connect(new StdioServerTransport());
