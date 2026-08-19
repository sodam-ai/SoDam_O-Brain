// 기억 추출 — 규칙 기반(무료·오프라인) 자동 캡처.
// AI 고품질 추출은 유료 API가 아니라 호스트 LLM(클로드코드/코덱스)이 save_memory/remember로 수행(키·과금 0).

// 유형 단서(한국어). 위에 있을수록 우선.
const CUES = [
  { type: '제약', importance: 4, re: /(금지|하지\s*마|하지\s*말|절대|안\s*된다|쓰지\s*마|넣지\s*마|피한다|커밋\s*금지)/ },
  { type: '결정', importance: 4, re: /(하자|쓰자|하기로|정했|정한다|결정|채택|확정|사용한다|쓴다|기본값?은|포트는|이름은|로\s*간다)/ },
  { type: '선호', importance: 3, re: /(선호|좋아|우선|대신|보다는|편이|스타일|컨벤션|규칙은)/ },
  { type: '패턴', importance: 3, re: /(항상|매번|보통|방식|패턴|절차|순서는)/ },
  { type: '지식', importance: 2, re: /(경로는|위치는|버전은|때문에|이유는|구조는)/ },
];

// 대화/문서 인용 백스톱 — stripInjected가 줄 단위로 거르고 남은 조각이 문장분리 후에도
// 인용/표/헤더 형태면 2차 방어(2026-07-26 실측: 노이즈 20/20 일치, 이중 방어로 누락 방지).
const QUOTE_RE = /^\*{0,2}(Claude|Assistant|User|사용자|어시스턴트)\*{0,2}\s*[:：]|^#{1,6}\s|\|.*\|/i;

// 대화 텍스트(주로 사용자 발화)에서 기억 후보를 뽑는다.
export function ruleExtract(exchanges, { max = 8 } = {}) {
  const out = [];
  const seen = new Set();
  for (const ex of exchanges) {
    if (ex.role !== 'user') continue; // 결정·선호·제약은 대개 사용자 지시에서 나옴
    const parts = String(ex.text)
      .split(/[.!?。\n·]|(?<=다)\s|(?<=요)\s/)
      .map(s => s.trim())
      .filter(s => s.length >= 6 && s.length <= 160 && !QUOTE_RE.test(s));
    for (const s of parts) {
      const hit = CUES.find(c => c.re.test(s));
      if (!hit) continue;
      const key = s.replace(/\s+/g, '').slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ content: s, type: hit.type, importance: hit.importance, source: 'rule', confidence: 0.5 });
      if (out.length >= max) return out;
    }
  }
  return out;
}
