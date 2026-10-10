import { docOpenRouter, doiChieuTong, danhGia, docNhaCungCapKenh, docNguong } from "../../server/services/chi-phi.js";
import { query } from "../../server/db.js";
const ai = await docOpenRouter();
const dc = await doiChieuTong(ai);
console.log("ĐỐI CHIẾU", JSON.stringify(dc));
console.log("CẢNH BÁO", JSON.stringify(danhGia(ai, await docNhaCungCapKenh(), await docNguong(), dc).map((c) => c.tomTat)));
console.log("CHỜ", JSON.stringify((await query(`SELECT id, viec, cost_usd::text, so_lan_tra FROM ai_usage WHERE ma_ncc IS NOT NULL AND doi_chieu_at IS NULL ORDER BY id`)).rows));
process.exit(0);
