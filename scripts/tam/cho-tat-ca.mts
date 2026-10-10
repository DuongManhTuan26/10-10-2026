import { query } from "../../server/db.js";
import { docOpenRouter, doiChieuTong } from "../../server/services/chi-phi.js";
for (let i = 0; i < 40; i++) {
  const v = (await query(`SELECT trang_thai, gia_thuc::text, loi FROM video_ai WHERE id = 12`)).rows[0];
  const cho = (await query(`SELECT count(*)::int n FROM ai_usage WHERE created_at > now() - interval '1 hour' AND ma_ncc IS NOT NULL AND doi_chieu_at IS NULL`)).rows[0].n;
  const coVideo = (await query(`SELECT count(*)::int n FROM ai_usage WHERE viec = 'tao_video' AND created_at > now() - interval '1 hour'`)).rows[0].n;
  if (v.trang_thai !== "dang_tao" && coVideo > 0 && cho === 0) {
    const dc = await doiChieuTong(await docOpenRouter());
    console.log("XONG video:", JSON.stringify(v), "| đối chiếu:", JSON.stringify(dc));
    process.exit(0);
  }
  if (v.trang_thai === "loi") { console.log("VIDEO LỖI", JSON.stringify(v)); }
  await new Promise((x) => setTimeout(x, 60_000));
}
console.log("HẾT GIỜ"); process.exit(1);
