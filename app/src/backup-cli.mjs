// 수동 백업 실행 — npm run backup            (빠른 복구용 .db, 직접 만든 백업은 10개까지 보관)
//                  npm run backup -- --portable (이식용 .json.gz — 다른 PC로 옮길 때, 화면의 "가져오기"로 읽힘)
import { backupOnce, portableBackup } from './backup.mjs';
if (process.argv.includes('--portable')) {
  try {
    const r = portableBackup();
    console.log(`✅ 이식용 백업 저장: ${r.dest}`);
    console.log(`   (기억 ${r.count}건 · ${Math.round(r.size / 1024)}KB · 새 PC의 O-Brain 화면 → 데이터 → 가져오기에서 이 파일을 올리세요 · 이식용은 ${r.total}개까지 보관)`);
  } catch (e) {
    console.log('❌ ' + (e && /[가-힣]/.test(e.message) ? e.message : '이식용 백업을 만들지 못했어요.'));
    process.exitCode = 1;
  }
} else {
  const r = await backupOnce({ tag: 'manual' });
  console.log(`✅ 백업 저장: ${r.dest}`);
  console.log(`   (보관 위치: ${r.dir} · 직접 만든 백업 총 ${r.total}개 유지)`);
}
