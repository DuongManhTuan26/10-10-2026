import { query } from "../../server/db.js";
import { docOpenRouter, doiChieuTong } from "../../server/services/chi-phi.js";
console.log(JSON.stringify((await query(`SELECT id, viec, model, cost_usd::text, cost_ncc::text, doi_chieu_at IS NOT NULL da FROM ai_usage WHERE created_at > now() - interval '3 hours' ORDER BY id`)).rows));
const dc = await doiChieuTong(await docOpenRouter()); console.log("ĐỐI CHIẾU", dc?.trangThai, "lệch", dc?.sauMoc.lechUsd, "chờ", dc?.sauMoc.soLuotCho);
process.exit(0);
