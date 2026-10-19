/**
 * BÁO CÁO CHỈ ĐỌC trước khi làm A2 (hội thoại + khách hàng tách theo cửa hàng) — chỉ ĐẾM, không in tên / số điện thoại /
 * nội dung tin, không ghi gì (giao dịch READ ONLY).
 *
 * Trả lời: hội thoại suy ra cửa hàng qua kênh được không; khách nào đang dính hội thoại / đơn của NHIỀU cửa hàng (sẽ phải
 * tách thành nhiều bản ghi khi khách thành "riêng theo cửa hàng") — đúng chỗ phiên kiểm duyệt dặn coi chừng trùng / gộp nhầm.
 *
 *   npx tsx scripts/bao-cao-a2.mts
 */
import { pool } from "../server/db.js";

const c = await pool.connect();
try {
  await c.query("BEGIN TRANSACTION READ ONLY");

  const hoiThoai = await c.query(`
    SELECT c.user_id,
           CASE WHEN c.social_account_id IS NULL THEN '0. không còn kênh'
                WHEN s.trang_id IS NULL THEN '1. kênh chưa gắn cửa hàng'
                ELSE '2. có cửa hàng' END AS loai,
           s.trang_id, c.status, COUNT(*)::int AS so
      FROM conversations c LEFT JOIN social_accounts s ON s.id = c.social_account_id
     GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`);
  console.log("\nHội thoại theo tài khoản × cửa hàng (qua kênh) × trạng thái:");
  console.table(hoiThoai.rows);

  // Mỗi khách → các cửa hàng của hội thoại + của đơn + của kênh ghi trên bản ghi khách.
  const theoKhach = `
    SELECT cu.id, cu.user_id,
           (SELECT COUNT(DISTINCT s.trang_id) FROM conversations c JOIN social_accounts s ON s.id = c.social_account_id
             WHERE c.customer_id = cu.id) AS ch_hoi_thoai,
           (SELECT COUNT(*) FROM conversations c WHERE c.customer_id = cu.id) AS so_hoi_thoai,
           (SELECT COUNT(*) FROM orders o WHERE o.customer_id = cu.id) AS so_don,
           (SELECT s.trang_id FROM social_accounts s WHERE s.id = cu.social_account_id) AS ch_kenh_khach
      FROM customers cu`;
  const khach = await c.query(`
    SELECT user_id,
           COUNT(*)::int AS tong_khach,
           COUNT(*) FILTER (WHERE ch_hoi_thoai = 1)::int AS mot_cua_hang,
           COUNT(*) FILTER (WHERE ch_hoi_thoai > 1)::int AS nhieu_cua_hang,
           COUNT(*) FILTER (WHERE so_hoi_thoai = 0)::int AS khong_hoi_thoai,
           COUNT(*) FILTER (WHERE so_hoi_thoai = 0 AND ch_kenh_khach IS NULL)::int AS khong_hoi_thoai_khong_cua_hang,
           COUNT(*) FILTER (WHERE so_don > 0)::int AS co_don
      FROM (${theoKhach}) x GROUP BY user_id ORDER BY user_id`);
  console.log("\nKhách theo tài khoản (mot_cua_hang / nhieu_cua_hang: theo hội thoại):");
  console.table(khach.rows);

  // Khoá khách mới (cửa hàng, nền tảng, mã người dùng) — có đụng nhau không nếu tách theo cửa hàng.
  const dung = await c.query(`
    SELECT COUNT(*)::int AS so_nhom_trung FROM (
      SELECT s.trang_id, cu.platform, cu.participant_id
        FROM customers cu JOIN conversations c ON c.customer_id = cu.id
        JOIN social_accounts s ON s.id = c.social_account_id
       GROUP BY 1, 2, 3 HAVING COUNT(DISTINCT cu.id) > 1) x`);
  console.log("\nNhóm (cửa hàng, nền tảng, mã người dùng) đang có >1 bản ghi khách:", dung.rows[0]?.so_nhom_trung);

  const don = await c.query(`
    SELECT o.user_id,
           CASE WHEN o.conversation_id IS NULL THEN 'đơn không có hội thoại' ELSE 'đơn có hội thoại' END AS loai,
           COUNT(*)::int AS so
      FROM orders o GROUP BY 1, 2 ORDER BY 1, 2`);
  console.log("\nĐơn theo tài khoản:");
  console.table(don.rows);

  const tuChu = await c.query(`
    SELECT user_id, COUNT(*)::int AS so_cua_hang_bat_tu_chu
      FROM ai_configs WHERE kind = 'sales' AND settings->'tuChu'->>'bat' = 'true'
     GROUP BY user_id ORDER BY user_id`);
  console.log("\nCửa hàng bật tự chủ, theo tài khoản:");
  console.table(tuChu.rows);

  // Điều kiện 2 của phiên kiểm duyệt (19/10): kênh chưa gắn cửa hàng → khách của kênh đó không có cửa hàng để gán.
  const kenhRong = await c.query(`
    SELECT COUNT(*)::int AS tong, COUNT(*) FILTER (WHERE trang_id IS NULL)::int AS chua_gan,
           COUNT(*) FILTER (WHERE trang_id IS NULL AND connected)::int AS chua_gan_dang_noi
      FROM social_accounts`);
  console.log("\nKênh (social_accounts): tổng / chưa gắn cửa hàng / chưa gắn mà đang nối:", kenhRong.rows[0]);

  await c.query("ROLLBACK");
} finally {
  c.release();
  await pool.end();
}
