// 로컬 임베딩 — 진짜 all-MiniLM-L6-v2(384)만 쓴다.
// 모델을 못 쓰면 '의미 없는 대체 벡터'로 속이지 않고 사용 불가를 알린다(PRD 05 §3: 키워드 검색만 일시 동작 + 사용자에게 가시화).
// (이전에는 실패해도 해시 벡터로 조용히 계속해서, 의미 없는 벡터가 검색 색인에 영구 저장될 수 있었다.)
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './db.mjs';

const MODEL = 'all-MiniLM-L6-v2';
let _extractor = null;
let _mode = 'pending'; // 'all-MiniLM-L6-v2' | 'unavailable'(모델 로드 실패) | 'disabled'(OBRAIN_EMBED_DISABLE=1)
let _marked = false;   // 이 프로세스가 표식을 남겼는지(자가 치유용)

// 훅·MCP·서버는 서로 다른 프로세스라, 한쪽이 실패해도 대시보드/status가 알 수 있게 표식 파일을 둔다.
// 모델이 다시 되는 프로세스가 지워 스스로 치유된다. 사유(경로가 섞일 수 있음)는 이 파일·CLI에만 남기고 API로는 내보내지 않는다.
const markFile = () => join(DATA_DIR, '_embed_degraded.json');
function markDegraded(reason) {
  _marked = true;
  try { writeFileSync(markFile(), JSON.stringify({ since: new Date().toISOString(), reason: String(reason).slice(0, 300), pid: process.pid })); } catch {}
}
function clearDegraded() { _marked = false; try { rmSync(markFile(), { force: true }); } catch {} }
export function readEmbedDegraded() { try { return JSON.parse(readFileSync(markFile(), 'utf8')); } catch { return null; } }

export class EmbedUnavailableError extends Error {
  constructor() { super('의미검색을 쓸 수 없어요(임베딩 모델을 불러오지 못함)'); this.code = 'EMBED_UNAVAILABLE'; }
}

export async function initEmbedder() {
  if (_mode !== 'pending') return _mode;
  if (process.env.OBRAIN_EMBED_DISABLE === '1') { // 진단·저사양용: 의미검색을 일부러 끈다(키워드 검색만 사용)
    _extractor = null; _mode = 'disabled'; markDegraded('OBRAIN_EMBED_DISABLE=1');
    return _mode;
  }
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = true; // 최초 1회 모델 다운로드 허용
    _extractor = await pipeline('feature-extraction', 'Xenova/' + MODEL);
    _mode = MODEL;
    clearDegraded(); // 다른 프로세스가 남긴 실패 표식도 여기서 치유
  } catch (e) {
    _extractor = null; _mode = 'unavailable';
    markDegraded(e?.message || e);
    console.error('[o-brain] 임베딩 모델을 불러오지 못했어요 — 의미검색 없이 키워드로만 동작합니다:', e?.message || e);
  }
  return _mode;
}

export async function embed(text) {
  if (_mode === 'pending') await initEmbedder();
  if (!_extractor) throw new EmbedUnavailableError();
  let out;
  try { out = await _extractor(String(text), { pooling: 'mean', normalize: true }); }
  catch (e) { markDegraded(e?.message || e); throw new EmbedUnavailableError(); } // 한 번의 추론 실패도 숨기지 않는다
  if (_marked) clearDegraded(); // 같은 프로세스에서 다시 성공하면 표식 해제
  return Float32Array.from(out.data);
}

export function embedMode() { return _mode; }
export function toBlob(vec) { return new Uint8Array(Float32Array.from(vec).buffer); }
