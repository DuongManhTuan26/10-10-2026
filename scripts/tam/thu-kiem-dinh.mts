import { query } from "../../server/db.js";
import { kiemDinhCanh } from "../../server/services/kiem-dinh-video.js";
// Đáp án soi bằng mắt: true = cảnh có lỗi.
const DAP_AN: Record<string, boolean> = {
  "8-0": true, "8-1": true, "8-2": false, "8-3": true, "8-4": false, "8-5": true, "8-6": true, "8-7": true,
  "9-0": false, "9-1": false, "9-2": false, "9-3": false,
  "7-0": false, "7-1": false, "7-2": false,
  "6-0": true, "6-1": false, "6-2": true,
};
let dung = 0, tong = 0;
for (const id of [8, 9, 7, 6]) {
  const d = (await query("SELECT user_id, phan_canh FROM du_an_video WHERE id = $1", [id])).rows[0];
  for (const c of (await query("SELECT thu_tu, url FROM video_ai WHERE du_an_id = $1 AND trang_thai = 'xong' ORDER BY thu_tu", [id])).rows) {
    const k = `${id}-${c.thu_tu}`;
    const canh = d.phan_canh[c.thu_tu];
    const kq = await kiemDinhCanh({ userId: d.user_id, url: c.url, moTa: canh.moTa, soGiay: canh.soGiay });
    const ok = kq.dat === !DAP_AN[k];
    tong++; if (ok) dung++;
    console.log(`${ok ? "✓" : "✗"} #${k} đáp án ${DAP_AN[k] ? "LỖI" : "sạch"} → ${kq.dat ? "đạt" : "LỖI"}${kq.coHoiAi ? " (AI xem)" : ""} | cắt ${kq.soDo.catMax.toFixed(3)} sáng ${Math.round(kq.soDo.sangDau)}→${Math.round(kq.soDo.sangCuoi)} | ${kq.lyDo ?? ""}`);
  }
}
console.log(`ĐÚNG ${dung}/${tong}`);
process.exit(0);
