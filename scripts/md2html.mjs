// README/GUIDE(한/영) 4개 마크다운을 "내용 100% 동일한" HTML로 변환합니다.
// 사용법: cd app && npm install --no-save marked (한 번만) → node ../scripts/md2html.mjs (프로젝트 루트에서 실행)
// marked는 여기서만 쓰는 문서 생성 도구라 package.json에는 저장하지 않습니다(--no-save).
//
// 주의(2026-07-06 실측): GitHub 스타일 헤딩 앵커(#목차-링크)를 만들 때 "·" 같은 특수문자를
// 제거하면 앞뒤 공백이 남는데, 이 공백들을 하나로 뭉치면(\s+ → -) 목차의 "--"(더블 하이픈)
// 표기와 어긋나 링크가 깨집니다. 그래서 아래 slugFromRawHeading은 공백을 뭉치지 않고
// 각각 개별 하이픈으로 바꿉니다(\s → -, +없이). 이 방식을 바꾸면 목차 링크가 전부 깨지니
// 수정 후 반드시 브라우저에서 목차 링크 전수 클릭(또는 아래 스크립트로 앵커 id 대조) 검증할 것.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const require = createRequire(import.meta.url);
const { marked } = require(path.join(ROOT, 'app', 'node_modules', 'marked'));

function slugFromRawHeading(raw) {
  const s = raw
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const renderer = new marked.Renderer();
const usedSlugs = new Map();
renderer.heading = function (token) {
  const { tokens, depth, text } = token;
  const html = this.parser.parseInline(tokens);
  let slug = slugFromRawHeading(text);
  const count = usedSlugs.get(slug) || 0;
  usedSlugs.set(slug, count + 1);
  if (count > 0) slug = `${slug}-${count}`;
  return `<h${depth} id="${slug}">${html}</h${depth}>\n`;
};

marked.setOptions({ gfm: true, breaks: false, renderer });

const CSS = `
:root { color-scheme: light dark; }
body { max-width: 920px; margin: 0 auto; padding: 32px 20px 80px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; color: #1b1f24; background: #ffffff; }
@media (prefers-color-scheme: dark) { body { color: #e6edf3; background: #0d1117; } }
h1, h2, h3, h4 { line-height: 1.3; margin-top: 1.8em; margin-bottom: 0.6em; scroll-margin-top: 16px; }
h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
h3 { font-size: 1.2em; }
@media (prefers-color-scheme: dark) { h1, h2 { border-color: #30363d; } }
a { color: #0969da; text-decoration: none; }
@media (prefers-color-scheme: dark) { a { color: #58a6ff; } }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; display: block; overflow-x: auto; }
th, td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
@media (prefers-color-scheme: dark) { th, td { border-color: #30363d; } }
th { background: #f6f8fa; font-weight: 600; }
@media (prefers-color-scheme: dark) { th { background: #161b22; } }
code { background: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; font-size: 85%; font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace; }
pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
@media (prefers-color-scheme: dark) { pre { background: #161b22; } }
pre code { background: none; padding: 0; }
blockquote { border-left: 4px solid #d0d7de; margin: 0; padding: 0 1em; color: #59636e; }
@media (prefers-color-scheme: dark) { blockquote { border-color: #30363d; color: #9198a1; } }
hr { border: none; border-top: 1px solid #d0d7de; margin: 2em 0; }
@media (prefers-color-scheme: dark) { hr { border-color: #30363d; } }
details { border: 1px solid #d0d7de; border-radius: 6px; padding: 10px 16px; margin: 0.8em 0; }
@media (prefers-color-scheme: dark) { details { border-color: #30363d; } }
summary { cursor: pointer; font-weight: 600; }
img { max-width: 100%; }
`.trim();

function wrap(title, bodyHtml) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

const files = [
  { md: 'README.md', html: 'README.html', title: '소담 오브레인 (SoDam O-Brain) — README' },
  { md: 'README.en.md', html: 'README.en.html', title: 'SoDam O-Brain — README' },
  { md: 'GUIDE.md', html: 'GUIDE.html', title: '소담 오브레인 (SoDam O-Brain) — 완전 가이드' },
  { md: 'GUIDE.en.md', html: 'GUIDE.en.html', title: 'SoDam O-Brain — Complete Guide' },
];

for (const f of files) {
  usedSlugs.clear();
  const mdRaw = fs.readFileSync(path.join(ROOT, f.md), 'utf8');
  const bodyHtml = marked.parse(mdRaw);
  const finalHtml = wrap(f.title, bodyHtml);
  fs.writeFileSync(path.join(ROOT, f.html), finalHtml, 'utf8');
  console.log('wrote', f.html, finalHtml.length, 'bytes');
}
