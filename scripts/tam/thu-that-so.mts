// Chạy thật qua đúng hàm của app: 1 chat, 1 ảnh, 1 video rẻ nhất (worker của server sẽ chốt và ghi sổ).
import { query } from "../../server/db.js";
import { chat } from "../../server/services/ai.js";
import { taoAnhChoBai } from "../../server/services/image-ai.js";
import { guiViecVideo, layDanhSachModel, giaMoiGiay, lyDoKhongHop } from "../../server/services/video-ai.js";
const tk = 5;
const trang = (await query(`SELECT id FROM trang WHERE user_id = $1 ORDER BY id LIMIT 1`, [tk])).rows[0]?.id;
const c = await chat({ task: "sales", viec: "thu_ai", userId: tk, model: "google/gemini-3.7-flash", maxTokens: 400, messages: [{ role: "user", content: "Chào shop" }] });
console.log("CHAT", c.usage.costUsd);
const a = await taoAnhChoBai({ userId: tk, trangId: trang, noiDung: "Một ly cà phê sữa đá trên bàn gỗ" });
console.log("ANH", a.costUsd);
let re: { m: any; lc: any; gia: number } | null = null;
for (const m of await layDanhSachModel()) for (const g of m.soGiay) for (const d of m.doNet) for (const k of m.khung) {
  const lc = { soGiay: g, doNet: d, khung: k, coTieng: false, coAnhMoDau: false };
  if (lyDoKhongHop(m, lc)) continue;
  const mg = giaMoiGiay(m, lc);
  if (mg !== null && (!re || mg * g < re.gia)) re = { m, lc, gia: mg * g };
}
console.log("VIDEO RẺ NHẤT", re?.m.id, JSON.stringify(re?.lc), re?.gia);
const v = await guiViecVideo({ userId: tk, trangId: trang, model: re!.m, loiMoTa: "Hơi nước bốc lên từ ly cà phê nóng, ánh nắng sớm", lc: re!.lc });
console.log("VIDEO GỬI", JSON.stringify(v).slice(0, 160));
process.exit(0);
