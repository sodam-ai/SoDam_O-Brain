// 로컬 임베딩 — 진짜 all-MiniLM-L6-v2(384) 시도 + 실패 시 해시 폴백(배관 보장).
import { DIM } from './db.mjs';

let _extractor = null;
let _mode = 'pending';

export async function initEmbedder() {
  if (_mode !== 'pending') return _mode;
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = true; // 최초 1회 모델 다운로드 허용
    _extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    _mode = 'all-MiniLM-L6-v2';
  } catch (e) {
    _extractor = null;
    _mode = 'fallback-hash';
  }
  return _mode;
}

// 임시 폴백: 결정적 해시 384벡터(의미 X — 배관 검증용)
function hashEmbed(text) {
  const v = new Float32Array(DIM);
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    v[(c + i) % DIM] += ((c % 17) - 8) / 8;
  }
  let n = 0; for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

export async function embed(text) {
  if (_mode === 'pending') await initEmbedder();
  if (_extractor) {
    const out = await _extractor(String(text), { pooling: 'mean', normalize: true });
    return Float32Array.from(out.data);
  }
  return hashEmbed(text);
}

export function embedMode() { return _mode; }
export function toBlob(vec) { return new Uint8Array(Float32Array.from(vec).buffer); }
