/**
 * HỒ SƠ KHÁCH THEO CỬA HÀNG — đợt 2b "kênh là nhân viên" (chủ dự án chốt 19/10/2026; migration 059).
 *
 * Khách thuộc CỬA HÀNG (trang_id chốt lúc tạo = cửa hàng của hội thoại / nhiệm kỳ), khoá (cửa hàng, nền tảng, mã):
 *  - kênh quay về cửa hàng cũ → dùng lại hồ sơ cũ của cửa hàng đó (chủ dự án chốt C5);
 *  - cùng một người ở cửa hàng khác → hồ sơ riêng (tên, sđt, ghi chú, tổng đơn không trộn).
 * Kênh chưa gắn cửa hàng (thoáng qua lúc nối kênh): hồ sơ trang_id NULL + trang_goc NULL; tin sau tìm lại đúng hồ sơ đó (không
 * nhân đôi). Hồ sơ mồ côi của cửa hàng ĐÃ XOÁ (trang_id NULL nhưng trang_goc còn) KHÔNG BAO GIỜ được dùng lại / nhận
 * (phiên kiểm duyệt 19/10 — dữ liệu cửa hàng cũ không được đi theo kênh).
 *
 * MỌI chỗ tạo khách đi qua hàm này (bộ kiểm tra đếm). ON CONFLICT phải khớp ĐÚNG chỉ mục có điều kiện của 059:
 * (trang_id, platform, participant_id) WHERE trang_id IS NOT NULL.
 */
import type pg from "pg";

export interface ThongTinKhach {
  userId: number;
  trangId: number | null;
  socialAccountId: string;
  platform: string;
  participantId: string;
  name: string;
  avatarUrl: string | null;
  phone?: string | null;
}

export async function layHoacTaoKhach(k: Pick<pg.PoolClient, "query">, p: ThongTinKhach): Promise<number> {
  if (p.trangId == null) {
    // Chưa có cửa hàng: dùng lại đúng hồ sơ "chưa từng thuộc cửa hàng nào" (trang_goc NULL), không đụng hồ sơ mồ côi.
    const cu = await k.query<{ id: number }>(
      `SELECT id FROM customers
        WHERE user_id = $1 AND platform = $2 AND participant_id = $3 AND trang_id IS NULL AND trang_goc IS NULL
        ORDER BY id LIMIT 1`,
      [p.userId, p.platform, p.participantId]
    );
    if (cu.rows[0]) {
      await k.query("UPDATE customers SET last_seen_at = now(), updated_at = now() WHERE id = $1", [cu.rows[0].id]);
      return cu.rows[0].id;
    }
  }
  const r = await k.query<{ id: number }>(
    `INSERT INTO customers
       (user_id, trang_id, trang_goc, social_account_id, platform, participant_id, name, avatar_url,
        phone, first_seen_at, last_seen_at)
     VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, now(), now())
     ON CONFLICT (trang_id, platform, participant_id) WHERE trang_id IS NOT NULL DO UPDATE SET
       last_seen_at = now(),
       -- Chỉ ghi đè khi bản ghi đang trống, để không xoá thông tin nhân viên đã sửa tay trước đó.
       name       = COALESCE(NULLIF(customers.name, ''), EXCLUDED.name),
       avatar_url = COALESCE(customers.avatar_url, EXCLUDED.avatar_url),
       phone      = COALESCE(customers.phone, EXCLUDED.phone),
       updated_at = now()
     RETURNING id`,
    [p.userId, p.trangId, p.socialAccountId, p.platform, p.participantId, p.name, p.avatarUrl, p.phone ?? null]
  );
  return r.rows[0].id;
}
