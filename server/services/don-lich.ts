/**
 * GỠ LỊCH BÀI HẸN GIỜ KHI KÊNH RỜI CỬA HÀNG — đợt 3 "kênh là nhân viên" (chủ dự án chốt 19/10/2026: "bài hẹn giờ của
 * cửa hàng cũ không đăng lên kênh đã chuyển đi nữa").
 *
 * Bài hẹn giờ đã giao nhà cung cấp (platform_post_ref) thì nhà cung cấp TỰ đăng đúng giờ — chốt cửa ra của mình không
 * chặn được nữa. Nên khi một kênh đích của bài không còn thuộc cửa hàng của bài → XOÁ bài phía nhà cung cấp
 * (DELETE /v1/posts/{id}; tài liệu: hợp lệ cho scheduled, xoá CẢ bài mọi kênh). Không tự tạo lại cho các kênh còn lại
 * (PUT bớt kênh không được tài liệu nói rõ; tạo lại có rủi ro media bị xoá theo bài) → bài về 'failed' kèm lý do, chủ
 * shop hẹn lại.
 *
 * Không trạng thái riêng, gọi lại bao nhiêu lần cũng an toàn: gọi SAU giao dịch đổi cửa hàng của kênh (không gọi HTTP
 * trong giao dịch) và mỗi lượt đồng bộ kênh — lỗi mạng thì lượt sau làm lại.
 */
import type pg from "pg";
import { query } from "../db.js";
import * as zernio from "./zernio.js";

/**
 * CHỈ bài hẹn giờ đã giao nhà cung cấp mà CÓ kênh đích hiện không thuộc cửa hàng của bài (phiên kiểm duyệt 19/10: chọn
 * nhầm là gỡ lịch bài thật của cửa hàng đang giữ kênh). Kênh đã xoá khỏi app (không còn dòng) không tính.
 */
export const CHON_BAI_KENH_DA_ROI = `
  SELECT p.id, p.platform_post_ref,
         ARRAY(SELECT COALESCE(NULLIF(s.display_name, ''), NULLIF(s.username, ''), s.platform)
                 FROM social_accounts s
                WHERE s.user_id = p.user_id AND s.id = ANY(p.target_account_ids)
                  AND s.trang_id IS DISTINCT FROM p.trang_id) AS kenh_roi
    FROM posts p
   WHERE p.user_id = $1 AND p.status = 'scheduled' AND p.platform_post_ref IS NOT NULL
     AND EXISTS (SELECT 1 FROM social_accounts s
                  WHERE s.user_id = p.user_id AND s.id = ANY(p.target_account_ids)
                    AND s.trang_id IS DISTINCT FROM p.trang_id)`;

/**
 * Bài đã GỠ HẾT khỏi các kênh (routes/posts.ts "Gỡ bài") → về nháp, giữ nội dung + ảnh để sửa rồi đăng lại. stats và
 * platform_urls là NOT NULL (đọc information_schema Neon 19/10/2026) → đặt '{}', KHÔNG NULL (bản cũ ghi stats = NULL:
 * gỡ thật xong thì câu cập nhật vỡ, bài đã mất khỏi Fanpage mà app vẫn ghi "đã đăng").
 */
export const BAI_VE_NHAP_SAU_GO = `
  UPDATE posts
     SET status = 'draft', platform_post_ref = NULL, platform_urls = '{}'::jsonb,
         published_at = NULL, stats = '{}'::jsonb, last_error = $2, updated_at = now()
   WHERE id = $1 RETURNING *`;

type XoaBaiNcc = (postId: string) => Promise<unknown>;
type ChayLenh = Pick<pg.PoolClient, "query">;
const KHO_CHUNG: ChayLenh = { query: ((sql: string, ts?: unknown[]) => query(sql, ts)) as never };

/** xoaBaiNcc / db: phép kiểm truyền nhà cung cấp mô phỏng và kết nối giao dịch thử; chạy thật dùng mặc định. */
export async function donLichKenhDaRoi(
  userId: number,
  xoaBaiNcc: XoaBaiNcc = zernio.deletePost,
  db: ChayLenh = KHO_CHUNG
): Promise<{ daGo: number[]; loi: number[] }> {
  const bai = await db.query<{ id: number; platform_post_ref: string; kenh_roi: string[] }>(CHON_BAI_KENH_DA_ROI, [userId]);
  const daGo: number[] = [];
  const loi: number[] = [];
  for (const b of bai.rows) {
    const tenKenh = b.kenh_roi.join(", ");
    try {
      await xoaBaiNcc(b.platform_post_ref);
    } catch (error) {
      const status = error instanceof zernio.ZernioError ? error.status : 0;
      // 404: bài không còn phía nhà cung cấp → không còn gì để đăng, coi như đã gỡ.
      if (status !== 404) {
        // 400: bài đã kịp đăng (tài liệu: "Cannot delete published posts") — webhook sẽ cập nhật trạng thái thật.
        const lyDo =
          status === 400
            ? `Kênh ${tenKenh} đã rời cửa hàng nhưng bài đã kịp đăng trước khi gỡ lịch.`
            : `Kênh ${tenKenh} đã rời cửa hàng — chưa gỡ được lịch bài này, hệ thống sẽ thử lại.`;
        await db.query("UPDATE posts SET last_error = $2, updated_at = now() WHERE id = $1", [b.id, lyDo]);
        loi.push(b.id);
        continue;
      }
    }
    await db.query(
      `UPDATE posts SET status = 'failed', platform_post_ref = NULL, last_error = $2, updated_at = now()
        WHERE id = $1 AND status = 'scheduled'`,
      [b.id, `Kênh ${tenKenh} đã rời cửa hàng — đã gỡ lịch bài này. Vui lòng hẹn lại cho các kênh còn lại.`]
    );
    daGo.push(b.id);
  }
  if (daGo.length || loi.length) console.log(`[gỡ lịch] Tài khoản ${userId}: gỡ ${daGo.length} bài, lỗi ${loi.length} bài`);
  return { daGo, loi };
}
