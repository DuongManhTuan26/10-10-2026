import { query } from "../../server/db.js";
import { hoanDiaChiKho } from "../../server/services/media-proxy.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
const ff = createRequire(import.meta.url)("ffmpeg-static") as string;
for (let i = 0; i < 30; i++) {
  const r = (await query(`SELECT id, khung, trang_thai, url, gia_uoc_tinh::float uoc, gia_thuc::float thuc, loi FROM video_ai WHERE id IN (13, 14) ORDER BY id`)).rows;
  if (r.every((x: any) => x.trang_thai !== "dang_tao")) {
    for (const v of r) {
      if (!v.url) { console.log("KẾT QUẢ", v.khung, v.trang_thai, v.loi); continue; }
      const p = `/private/tmp/claude-501/-Users-mac/980857a1-af64-4180-80b9-71cccadaf19f/scratchpad/v${v.id}.mp4`;
      fs.writeFileSync(p, Buffer.from(await (await fetch(hoanDiaChiKho(v.url))).arrayBuffer()));
      let log = ""; try { execFileSync(ff, ["-hide_banner", "-i", p], { encoding: "utf8", stdio: "pipe" }); } catch (e: any) { log = String(e.stderr); }
      const kt = /Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/.exec(log); const t = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
      console.log("KẾT QUẢ", v.khung, `${kt?.[1]}x${kt?.[2]}`, "điểm ảnh", Number(kt?.[1]) * Number(kt?.[2]), "giây", t?.[3], "ước", v.uoc, "thật", v.thuc);
    }
    process.exit(0);
  }
  await new Promise((x) => setTimeout(x, 30_000));
}
console.log("HẾT GIỜ"); process.exit(1);
