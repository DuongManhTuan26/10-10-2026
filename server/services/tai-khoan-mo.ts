/**
 * KHOÁ TÀI KHOẢN = AI DỪNG HẲN (mục f — chủ dự án chốt 18/10/2026; luật mở khoá chốt 19/10/2026; thiết kế duyệt cùng
 * phiên kiểm duyệt). Một chỗ chung cho cả hai lớp:
 *
 *  Lớp 1 — chọn việc: mọi bộ chạy nền thay người dùng lọc tài khoản đang mở bằng DK_TAI_KHOAN_MO ngay trong câu chọn.
 *  Lớp 2 — lưới tiền: mọi điểm gọi AI trả phí gọi chanNeuTaiKhoanKhoa(userId) trước khi gửi yêu cầu. Lọt lớp 1 cũng
 *          không tiêu được tiền AI. Lỗi TaiKhoanKhoaError ở bộ chạy nền = BỎ QUA lặng lẽ (không ghi failed, không
 *          Telegram, không đếm lần thử).
 *
 *  Mở khoá: dọn việc quá hạn TRONG CÙNG GIAO DỊCH, TRƯỚC khi bật is_active — không để worker chen vào giữa đăng bài
 *  quá hạn. Nhắc khách / vớt tin bỏ sót / rà soát hộp thư bỏ mọi thứ tới hạn trước mo_khoa_luc (DK_SAU_MO_KHOA /
 *  sauMoKhoa — PHẢI có nhánh NULL: tài khoản chưa từng khoá vẫn chạy bình thường).
 */
import type pg from "pg";
import { queryOne, transaction } from "../db.js";
import { GHI_CHU_DUNG_DO_KHOA } from "../../src/lib/tai-khoan-khoa.js";

export class TaiKhoanKhoaError extends Error {
  readonly status = 423;
  constructor() {
    super("Tài khoản đang bị khoá — AI tạm dừng.");
    this.name = "TaiKhoanKhoaError";
  }
}

/** Điều kiện SQL "tài khoản của dòng này đang mở" — ghép vào câu chọn việc của bộ chạy nền. */
export const DK_TAI_KHOAN_MO = (cotUserId: string) =>
  `EXISTS (SELECT 1 FROM users u_mo WHERE u_mo.id = ${cotUserId} AND u_mo.is_active)`;

/**
 * Điều kiện SQL "mốc này nằm SAU lần mở khoá gần nhất". Nhánh NULL bắt buộc: tài khoản chưa từng khoá
 * (mo_khoa_luc NULL) thì mọi mốc đều hợp lệ — thiếu nhánh này là nhắc khách / vớt tin của MỌI tài khoản dừng hết.
 */
export const DK_SAU_MO_KHOA = (cotUserId: string, cotMoc: string) =>
  `EXISTS (SELECT 1 FROM users u_mk WHERE u_mk.id = ${cotUserId} AND (u_mk.mo_khoa_luc IS NULL OR ${cotMoc} >= u_mk.mo_khoa_luc))`;

/** Bản JS của DK_SAU_MO_KHOA (rà soát hộp thư so mốc tin trong bộ nhớ). Cùng nhánh NULL. */
export function sauMoKhoa(moc: Date | number, moKhoaLuc: Date | null | undefined): boolean {
  if (moKhoaLuc == null) return true;
  return new Date(moc).getTime() >= moKhoaLuc.getTime();
}

/** Kênh này thuộc tài khoản đang khoá? (kênh lạ / đã xoá → false: để luồng thường tự xử lý như cũ). */
export async function kenhThuocTaiKhoanKhoa(accountId: string | null): Promise<boolean> {
  if (!accountId) return false;
  const r = await queryOne<{ khoa: boolean }>(
    "SELECT NOT u.is_active AS khoa FROM social_accounts s JOIN users u ON u.id = s.user_id WHERE s.id = $1",
    [accountId]
  );
  return r?.khoa === true;
}

/** Lưới tiền: ném TaiKhoanKhoaError nếu tài khoản đang khoá. userId null (việc chung của hệ thống) → không chặn. */
export async function chanNeuTaiKhoanKhoa(
  userId: number | null | undefined,
  doc: (id: number) => Promise<boolean | null> = docDangMo
): Promise<void> {
  if (userId == null) return;
  const dangMo = await doc(userId);
  if (dangMo === false) throw new TaiKhoanKhoaError();
}

async function docDangMo(id: number): Promise<boolean | null> {
  const r = await queryOne<{ is_active: boolean }>("SELECT is_active FROM users WHERE id = $1", [id]);
  return r ? r.is_active : null;
}

/**
 * Các câu dọn việc quá hạn lúc mở khoá — hàm thuần (bộ kiểm tra soi từng câu có kẹp đúng tài khoản).
 *  - bài tự đăng quá giờ → gỡ mốc tự đăng, bài ở lại mục Chờ duyệt;
 *  - bài đang chờ video → video xong thì vào Chờ duyệt (không tự đăng);
 *  - video dài đang tạo → dừng ở trạng thái có nút "Tạo tiếp", ghi chú rõ lý do (không phải lỗi thật);
 *  - tin riêng / trả lời công khai bình luận đã hẹn mà quá giờ → bỏ, ghi lý do.
 */
export function cauLenhDonQuaHan(userId: number): { sql: string; thamSo: unknown[] }[] {
  return [
    {
      sql: `UPDATE posts SET auto_publish_at = NULL, updated_at = now()
             WHERE user_id = $1 AND status = 'pending_approval' AND auto_publish_at IS NOT NULL AND auto_publish_at <= now()`,
      thamSo: [userId],
    },
    {
      sql: `UPDATE posts SET cho_video_guard = 'approve', updated_at = now()
             WHERE user_id = $1 AND cho_video_id IS NOT NULL`,
      thamSo: [userId],
    },
    {
      sql: `UPDATE du_an_video SET trang_thai = 'loi', loi = $2, dang_xu_ly_tu = NULL, xong_at = now(), updated_at = now()
             WHERE user_id = $1 AND trang_thai = 'dang_tao'`,
      thamSo: [userId, GHI_CHU_DUNG_DO_KHOA],
    },
    {
      // Tin riêng / trả lời bình luận đã hẹn mà tới giờ lúc đang khoá: bỏ, không gửi bù.
      sql: `UPDATE comments SET dm_due_at = NULL, pending_dm_text = NULL, skipped_reason = $2
             WHERE user_id = $1 AND dm_due_at IS NOT NULL AND dm_due_at <= now() AND private_replied_at IS NULL`,
      thamSo: [userId, LY_DO_BO_BINH_LUAN],
    },
    {
      sql: `UPDATE comments SET public_reply_due_at = NULL, pending_reply_text = NULL, skipped_reason = $2
             WHERE user_id = $1 AND public_reply_due_at IS NOT NULL AND public_reply_due_at <= now() AND public_replied_at IS NULL`,
      thamSo: [userId, LY_DO_BO_BINH_LUAN],
    },
  ];
}
const LY_DO_BO_BINH_LUAN = "Tới giờ gửi lúc tài khoản đang khoá — không gửi bù";

/** Kiểu của db.transaction — truyền bản giả được để bộ kiểm tra soi thứ tự câu lệnh. */
type ChayGiaoDich = (fn: (k: Pick<pg.PoolClient, "query">) => Promise<void>) => Promise<void>;

/** Khoá: chặn đăng nhập (giết mọi phiên, kể cả phiên admin mở vào) + ghi mốc khoá. Một giao dịch. */
export async function khoaTaiKhoan(userId: number, giaoDich: ChayGiaoDich = transaction): Promise<void> {
  await giaoDich(async (k) => {
    // Khoá lại tài khoản đang khoá thì giữ mốc khoá cũ.
    await k.query(
      "UPDATE users SET khoa_luc = CASE WHEN is_active THEN now() ELSE khoa_luc END, is_active = FALSE, updated_at = now() WHERE id = $1",
      [userId]
    );
    await k.query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [userId]);
  });
}

/**
 * Mở khoá: BEGIN → giữ dòng tài khoản → dọn quá hạn → is_active = TRUE + mo_khoa_luc → COMMIT (một giao dịch, dọn
 * TRƯỚC khi mở). Tài khoản vốn đang mở thì KHÔNG dọn gì (bấm nhầm "Mở khoá" không được gỡ lịch tự đăng của người ta).
 */
export async function moKhoaTaiKhoan(userId: number, giaoDich: ChayGiaoDich = transaction): Promise<void> {
  await giaoDich(async (k) => {
    const r = await k.query<{ is_active: boolean }>("SELECT is_active FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!r.rows[0] || r.rows[0].is_active) return;
    for (const l of cauLenhDonQuaHan(userId)) await k.query(l.sql, l.thamSo);
    await k.query("UPDATE users SET is_active = TRUE, mo_khoa_luc = now(), updated_at = now() WHERE id = $1", [userId]);
  });
}
