// Chấm video quảng cáo theo các phép đo khách quan được (tiêu chí 3, 4, 5, 9, 10).
import fs from "node:fs";
import path from "node:path";
import { query, queryOne } from "../../server/db.js";
import { chayFfmpeg, demKhung, doDaiTungCanh, taiVe, thongTin } from "../../server/services/video-cong-cu.js";
import { ngheThanhChu } from "../../server/services/am-thanh-ai.js";
const id = Number(process.argv[2]);
const thu = process.argv[3];
fs.mkdirSync(thu, { recursive: true });
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const d = (await queryOne<any>("SELECT url, phan_canh, am_thanh FROM du_an_video WHERE id = $1", [id]))!;
const canh = (await query<any>("SELECT url, thu_tu, gia_thuc, anh_mo_dau FROM video_ai WHERE du_an_id = $1 ORDER BY thu_tu", [id])).rows;
const ghep = path.join(thu, "ghep.mp4");
await taiVe(d.url.startsWith("/media/") ? "http://127.0.0.1:3000" + d.url : d.url, ghep);
const tepCanh: string[] = [];
for (const c of canh) {
  const t = path.join(thu, `canh-${c.thu_tu}.mp4`);
  await taiVe(c.url, t);
  tepCanh.push(t);
  if (c.anh_mo_dau) await taiVe(c.anh_mo_dau, path.join(thu, `khung-${c.thu_tu}.jpg`));
}
const info = await Promise.all(tepCanh.map(thongTin));
const soKhung = await Promise.all(tepCanh.map(demKhung));
const doDai = doDaiTungCanh(info, soKhung);
const tt = await thongTin(ghep);
console.log(`[10] tệp: ${tt.rong}x${tt.cao}, ${tt.soGiay}s, ${tt.khungMoiGiay} fps, tiếng=${tt.coTieng}`);
// [3][5] độ chênh từng khung
const tepDiem = path.join(thu, "diem.txt");
await chayFfmpeg(["-i", ghep, "-vf", `select='gte(scene,0)',metadata=print:file=${tepDiem}`, "-an", "-f", "null", "-"]);
const diem = [...fs.readFileSync(tepDiem, "utf8").matchAll(/lavfi\.scene_score=([\d.]+)/g)].map((m) => Number(m[1]));
const moc: number[] = [];
let k = 0;
for (const x of doDai.slice(0, -1)) { k += Math.round(x * 24); moc.push(k); }
const trong = diem.filter((_, i) => !moc.some((m) => Math.abs(i - m) <= 2));
const sx = [...trong].sort((a, b) => a - b);
console.log(`[3][5] bên trong cảnh (${trong.length} khung): trung bình ${(trong.reduce((a, b) => a + b, 0) / trong.length).toFixed(4)}, 95% ${sx[Math.floor(sx.length * 0.95)].toFixed(4)}, 99% ${sx[Math.floor(sx.length * 0.99)].toFixed(4)}, lớn nhất ${sx[sx.length - 1].toFixed(4)}`);
const lon = diem.map((v, i) => [i, v] as const).filter(([i, v]) => v > 0.15 && !moc.some((m) => Math.abs(i - m) <= 2));
console.log(`   cú nhảy lớn (>0,15) bên trong cảnh: ${lon.length ? lon.map(([i, v]) => `khung ${i} (${(i / 24).toFixed(1)}s): ${v.toFixed(3)}`).join("; ") : "không có"}`);
d.phan_canh.slice(1).forEach((c: any, j: number) => {
  const m = moc[j];
  const v = Math.max(...[-1, 0, 1].map((o) => diem[m + o] ?? 0));
  console.log(`   mối ${j + 1}→${j + 2} (${c.noiTiep ? "NỐI" : "CẮT"}) khung ${m}: ${v.toFixed(4)}`);
});
// [9] âm thanh
const a = await chayFfmpeg(["-i", ghep, "-af", "ebur128=framelog=quiet,volumedetect", "-f", "null", "-"]);
console.log(`[9] độ to: ${/ I:\s+(-?[\d.]+) LUFS/.exec(a)?.[1]} LUFS, LRA ${/ LRA:\s+([\d.]+) LU/.exec(a)?.[1]}, đỉnh ${/max_volume: (-?[\d.]+) dB/.exec(a)?.[1]} dB`);
const wav = path.join(thu, "tieng.wav");
await chayFfmpeg(["-i", ghep, "-vn", "-ac", "1", "-ar", "24000", wav]);
const nghe = await ngheThanhChu({ userId: cu.chuId, am: fs.readFileSync(wav), dinhDang: "wav" });
fs.writeFileSync(path.join(thu, "nghe.txt"), nghe);
console.log("[9] máy nghe lại toàn bộ tiếng:\n   " + nghe);
console.log("[9] lời đọc trong kịch bản:\n   " + d.phan_canh.map((c: any) => c.loiDoc).join(" "));
// Ảnh kiểm bằng mắt
await chayFfmpeg(["-i", ghep, "-vf", "fps=1,scale=150:-2,tile=8x8", "-frames:v", "1", path.join(thu, "toan-canh.jpg")]);
let t = 0;
for (const [i, x] of doDai.entries()) {
  await chayFfmpeg(["-ss", (t + Math.min(4, x / 2)).toFixed(2), "-i", ghep, "-frames:v", "1", "-update", "1", path.join(thu, `giua-${i}.jpg`)]);
  t += x;
}
process.exit(0);
