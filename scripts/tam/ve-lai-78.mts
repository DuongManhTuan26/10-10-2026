import { query, queryOne } from "../../server/db.js";
import { duaLenKho } from "../../server/services/video-cong-cu.js";
const mau = await duaLenKho(process.argv[2], "image/jpeg", "nhan-vat-9.jpg");
const loai = await query(
  `UPDATE video_ai SET bo_qua = true, kiem_dinh = 'loi: cảnh đêm sai kịch bản "buổi sáng" (vẽ lại)'
    WHERE du_an_id = 9 AND thu_tu IN (6, 7) AND NOT bo_qua RETURNING thu_tu, gia_thuc`);
const tien = loai.rows.reduce((t: number, x: any) => t + Number(x.gia_thuc || 0), 0);
const d = await queryOne<any>(
  `UPDATE du_an_video SET anh_nhan_vat = $1,
          phan_canh = jsonb_set(jsonb_set(phan_canh, '{6,soGiay}', '6'), '{7,soGiay}', '6'),
          chi_phi_them = chi_phi_them + $2, so_lan_ve_lai = 2,
          trang_thai = 'dang_tao', loi = NULL, url = NULL, xong_at = NULL, dang_xu_ly_tu = NULL, updated_at = now()
    WHERE id = 9 RETURNING co_tieng, (phan_canh->6->>'soGiay') g7, (phan_canh->7->>'soGiay') g8, so_lan_ve_lai`,
  [mau, tien]);
console.log("loại cảnh:", loai.rows.map((x: any) => x.thu_tu + 1), "tiền chuyển:", tien, "| dự án:", d);
process.exit(0);
