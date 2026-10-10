import fs from "node:fs";
import path from "node:path";
import { query } from "../../server/db.js";
import { taoAnhNhanVat, taoKhungVideo } from "../../server/services/khung-video.js";
import { taiVe } from "../../server/services/video-cong-cu.js";
const thu = process.argv[2];
fs.mkdirSync(thu, { recursive: true });
const d = (await query("SELECT user_id, nhat_quan, phan_canh, khung, do_net FROM du_an_video WHERE id = 9")).rows[0];
const mau = await taoAnhNhanVat({ userId: d.user_id, nhatQuan: d.nhat_quan, khung: d.khung, doNet: d.do_net, anhThamChieu: [], ten: "thu-nhan-vat-9.jpg" });
await taiVe(mau.url, path.join(thu, "mau.jpg"));
console.log("ảnh mẫu:", mau.tien);
for (const i of [6, 7]) {
  const k = await taoKhungVideo({ userId: d.user_id, nhatQuan: d.nhat_quan, moTa: d.phan_canh[i].moTa, khung: d.khung, doNet: d.do_net, anhMau: [mau.url], ten: `thu-khung-9-${i}.jpg` });
  await taiVe(k.url, path.join(thu, `khung-${i}.jpg`));
  console.log(`khung cảnh ${i + 1}:`, k.tien, "|", d.phan_canh[i].moTa.slice(0, 100));
}
process.exit(0);
