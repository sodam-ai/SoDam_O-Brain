// 규칙 기반 분류(온톨로지 v1) — 키워드로 기억을 주제 카테고리 1개에 매핑. AI·키·비용 0.
// PRD 02(데이터모델 category)·06§5(분류색)의 Phase 1 슬라이스. (N:N 다중분류는 다음 단계)
export const CATEGORIES = ['보안', '데이터/DB', '배포/인프라', 'AI/모델', 'UI/UX', '설정/환경', '규칙/문서', '기타'];

// 우선순위 순서 — 위에서부터 먼저 맞으면 그 분류로 확정(겹침 시 더 구체적인 쪽 우선).
const RULES = [
  ['보안',       /보안|시크릿|secret|비밀번호|암호|토큰|token|인증|권한|키\s*노출|api\s*키|\.env|redact|개인정보|민감/i],
  ['데이터/DB',  /\bdb\b|데이터베이스|sqlite|쿼리|스키마|마이그레이션|백업|임베딩|벡터|fts|테이블/i],
  ['배포/인프라', /배포|deploy|포트|\bport\b|도메인|호스팅|서버|vercel|netlify|railway|인프라|\bci\b|빌드|커밋|푸시/i],
  ['AI/모델',    /\bai\b|모델|llm|claude|gpt|haiku|프롬프트|추론|에이전트|mcp/i],
  ['UI/UX',      /\bui\b|\bux\b|디자인|화면|대시보드|컴포넌트|shadcn|버튼|css|레이아웃|테마|그래프|폰트/i],
  ['설정/환경',  /설정|환경|config|경로|변수|옵션|기본값/i],
  ['규칙/문서',  /금지|규칙|약속|결정|문서|readme|가이드|정책|하지\s*마|말아|지켜|과장/i],
];

export function classify(text) {
  const s = String(text || '');
  for (const [cat, re] of RULES) if (re.test(s)) return cat;
  return '기타';
}
