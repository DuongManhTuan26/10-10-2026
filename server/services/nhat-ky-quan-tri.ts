/**
 * Nhật ký các việc quản trị: ai đụng vào tài khoản nào, lúc nào.
 *
 * Tách ra khỏi routes/admin.ts vì nay có HAI tầng cùng ghi: quản trị tổng và
 * admin con quản lý chuỗi trang. Hai bản chép riêng thì sớm muộn một bên thêm
 * trường mà bên kia không có, và nhật ký mất tác dụng đúng lúc cần tra nhất.
 */

import { query } from "../db.js";

export async function ghiNhatKyQuanTri(params: {
  adminId: number;
  targetId: number | null;
  targetEmail: string;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO admin_audit (admin_id, target_id, target_email, action, detail)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      params.adminId,
      params.targetId,
      params.targetEmail,
      params.action,
      JSON.stringify(params.detail ?? {}),
    ]
  ).catch((error) => {
    // Nhật ký hỏng thì không được làm hỏng việc chính.
    console.error("[quản trị] Không ghi được nhật ký:", error);
  });
}
