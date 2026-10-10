import { query } from "../../server/db.js";
for (let i = 0; i < 40; i++) {
  const v = (await query(`SELECT trang_thai, url, gia_thuc::text, loi FROM video_ai WHERE id = 15`)).rows[0];
  if (v.trang_thai !== "dang_tao") { console.log("XONG", JSON.stringify(v)); process.exit(0); }
  await new Promise((x) => setTimeout(x, 30_000));
}
console.log("HẾT GIỜ"); process.exit(1);
