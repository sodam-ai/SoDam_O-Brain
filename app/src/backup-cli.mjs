// 수동 백업 실행 — npm run backup
import { backupOnce } from './backup.mjs';
const r = await backupOnce({ tag: 'manual' });
console.log(`✅ 백업 저장: ${r.dest}`);
console.log(`   (보관 위치: ${r.dir} · 총 ${r.total}개 유지)`);
