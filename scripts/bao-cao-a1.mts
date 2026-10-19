/**
 * BÁO CÁO CHỈ ĐỌC trước khi làm A1 (bài đăng tách theo cửa hàng) — chỉ ĐẾM, không in nội dung bài, không ghi gì.
 *
 * Trả lời: mỗi bài hiện có suy ra được ĐÚNG MỘT cửa hàng từ kênh đích (target_account_ids → social_accounts.trang_id)
 * hay không. Bài không suy ra được (không kênh / kênh đã xoá / kênh thuộc nhiều cửa hàng) là phần chủ dự án phải quyết
 * trước khi migration gán cửa hàng cho bài.
 *
 *   npx tsx scripts/bao-cao-a1.mts
 *
 * Chạy trong một giao dịch READ ONLY: lỡ có câu ghi nào thì Postgres từ chối.
 */
import { pool } from "../server/db.js";

const c = await pool.connect();
try {
  await c.query("BEGIN TRANSACTION READ ONLY");

  // Mỗi bài → số cửa hàng khác nhau mà các kênh đích của nó thuộc về.
  const theoBai = `
    SELECT p.id, p.user_id, p.status,
           COUNT(DISTINCT s.trang_id) AS so_cua_hang,
           COUNT(s.id) AS so_kenh_con,
           COALESCE(array_length(p.target_account_ids, 1), 0) AS so_kenh_ghi
      FROM posts p
      LEFT JOIN social_accounts s ON s.id = ANY(p.target_account_ids) AND s.user_id = p.user_id
     GROUP BY p.id`;

  const tong = await c.query(`
    SELECT CASE
             WHEN so_kenh_ghi = 0 THEN '0. không có kênh đích'
             WHEN so_kenh_con = 0 THEN '1. kênh đích đã bị xoá hết'
             WHEN so_cua_hang = 0 THEN '2. kênh còn nhưng chưa gắn cửa hàng'
             WHEN so_cua_hang = 1 THEN '3. đúng MỘT cửa hàng (gán được)'
             ELSE '4. NHIỀU cửa hàng (phải quyết)'
           END AS loai,
           status, COUNT(*)::int AS so_bai
      FROM (${theoBai}) x
     GROUP BY 1, 2 ORDER BY 1, 2`);
  console.log("\nBài theo khả năng gán cửa hàng × trạng thái:");
  console.table(tong.rows);

  const theoTk = await c.query(`
    SELECT user_id,
           COUNT(*)::int AS tong,
           COUNT(*) FILTER (WHERE so_cua_hang = 1 AND so_kenh_con > 0)::int AS gan_duoc,
           COUNT(*) FILTER (WHERE NOT (so_cua_hang = 1 AND so_kenh_con > 0))::int AS khong_gan_duoc,
           COUNT(*) FILTER (WHERE NOT (so_cua_hang = 1 AND so_kenh_con > 0)
                              AND status IN ('pending_approval', 'scheduled', 'draft', 'failed'))::int AS khong_gan_duoc_chua_dang
      FROM (${theoBai}) x
     GROUP BY user_id ORDER BY user_id`);
  console.log("\nTheo tài khoản (chỉ mã số):");
  console.table(theoTk.rows);

  // Lịch tự đăng: tài khoản nào có từ 2 cửa hàng bật lịch → khoá ô lịch (user_id, slot_key) đang đụng nhau.
  const lich = await c.query(`
    SELECT user_id, COUNT(*)::int AS so_cua_hang_bat_lich,
           array_agg(trang_id ORDER BY trang_id) AS cua_hang
      FROM ai_configs
     WHERE kind = 'content' AND settings->'autoPilot'->>'enabled' = 'true'
     GROUP BY user_id ORDER BY user_id`);
  console.log("\nCửa hàng đang bật lịch tự đăng, theo tài khoản:");
  console.table(lich.rows);

  const oTrung = await c.query(`
    SELECT COUNT(*)::int AS so_o_bi_bo
      FROM auto_pilot_runs WHERE status = 'skipped' AND created_at > now() - interval '30 days'`);
  console.log("\nÔ lịch ghi 'skipped' 30 ngày qua (gồm mọi lý do):", oTrung.rows[0]?.so_o_bi_bo);

  // Sau migration 057: mọi bài phải có cửa hàng (mong 0 bài trang_id NULL).
  const coCot = await c.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'trang_id'"
  );
  if (coCot.rows.length) {
    const sau = await c.query(`
      SELECT p.user_id, p.trang_id, COUNT(*)::int AS so_bai,
             COUNT(*) FILTER (WHERE s.trang_id IS DISTINCT FROM p.trang_id)::int AS kenh_lech_cua_hang
        FROM posts p
        LEFT JOIN LATERAL (SELECT MIN(s.trang_id) AS trang_id FROM social_accounts s
                            WHERE s.id = ANY(p.target_account_ids) AND s.user_id = p.user_id) s ON TRUE
       GROUP BY 1, 2 ORDER BY 1, 2`);
    console.log("\nSau 057 — bài theo cửa hàng (kenh_lech_cua_hang: kênh đích suy ra cửa hàng khác / không có):");
    console.table(sau.rows);
    const rong = await c.query("SELECT COUNT(*)::int AS so FROM posts WHERE trang_id IS NULL");
    console.log("Bài trang_id NULL:", rong.rows[0]?.so);
    const saoLuu = await c.query("SELECT COUNT(*)::int AS so FROM posts_truoc_057");
    console.log("Dòng trong bảng sao lưu posts_truoc_057:", saoLuu.rows[0]?.so);
  }

  await c.query("ROLLBACK");
} finally {
  c.release();
  await pool.end();
}
