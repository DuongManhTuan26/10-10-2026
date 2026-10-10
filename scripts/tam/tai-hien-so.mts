import { query } from "../../server/db.js";
import { ghiLuotAi, doiChieuLuotAi } from "../../server/services/so-ai.js";
const don = () => query(`DELETE FROM ai_usage WHERE ma_ncc LIKE 'gen-gia-%'`);
await don();
try {
  // 1. Số lẻ
  await ghiLuotAi({ userId: null, task: "sales", viec: "thu_ai", model: "x", maNcc: "gen-gia-sole", costUsd: 0.000000975 });
  console.log("1. ghi 0.000000975 →", (await query(`SELECT cost_usd::text FROM ai_usage WHERE ma_ncc='gen-gia-sole'`)).rows[0]);
  // 2. Ghi trùng
  await ghiLuotAi({ userId: null, task: "sales", viec: "thu_ai", model: "x", maNcc: "gen-gia-trung", costUsd: 0.001 });
  await ghiLuotAi({ userId: null, task: "sales", viec: "thu_ai", model: "x", maNcc: "gen-gia-trung", costUsd: 0.001 });
  console.log("2. ghi 2 lần cùng mã → số dòng:", (await query(`SELECT count(*)::int n FROM ai_usage WHERE ma_ncc='gen-gia-trung'`)).rows[0].n);
  await query(`DELETE FROM ai_usage WHERE ma_ncc IN ('gen-gia-sole','gen-gia-trung')`);
  // 3. Nghẽn: 1 lượt mãi không ra số, cũ hơn 1 lượt thật đang chờ; bộ đối chiếu lấy 1 lượt/lần
  await query(`INSERT INTO ai_usage (task, viec, model, ma_ncc, cost_usd, created_at) VALUES ('sales','thu_ai','x','gen-gia-ket', 0.001, now() - interval '1 day')`);
  await query(`UPDATE ai_usage SET doi_chieu_at = NULL, cost_ncc = NULL WHERE id = 22`);
  for (let i = 1; i <= 3; i++) {
    const n = await doiChieuLuotAi(1);
    const r = (await query(`SELECT doi_chieu_at IS NOT NULL da FROM ai_usage WHERE id = 22`)).rows[0];
    console.log(`3. lần ${i}: đối chiếu được ${n} lượt; lượt thật #22 đã đối chiếu? ${r.da}`);
  }
} finally {
  await don();
  await doiChieuLuotAi(5);
  console.log("dọn xong; #22:", (await query(`SELECT cost_usd::text, cost_ncc::text, doi_chieu_at IS NOT NULL da FROM ai_usage WHERE id = 22`)).rows[0]);
}
process.exit(0);
