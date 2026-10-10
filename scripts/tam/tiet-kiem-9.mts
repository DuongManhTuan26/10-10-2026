import { query, queryOne } from "../../server/db.js";
const n8 = await queryOne<{ nhac_url: string | null }>("SELECT nhac_url FROM du_an_video WHERE id = 8");
if (!n8?.nhac_url) { console.log("dự án 8 không có nhạc lưu sẵn"); process.exit(1); }
// Chỉ đổi khi dự án đang lỗi (chưa chạy) — không đụng dự án đang tạo.
const r = await queryOne<any>(
  "UPDATE du_an_video SET co_tieng = false, nhac_url = $1 WHERE id = 9 AND trang_thai = 'loi' RETURNING co_tieng, nhac_url IS NOT NULL AS co_nhac, tu_kiem, so_lan_ve_lai",
  [n8.nhac_url]);
console.log("dự án 9:", r);
const v = await query("SELECT thu_tu, kiem_dinh, bo_qua FROM video_ai WHERE du_an_id = 9 ORDER BY thu_tu");
console.log("cảnh:", v.rows.map((x: any) => `${x.thu_tu + 1}:${x.kiem_dinh ?? "chưa kiểm"}`).join(" "));
process.exit(0);
