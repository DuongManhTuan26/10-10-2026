// Đo mối nối của một dự án video dài: độ chênh giữa 2 khung liền nhau ở MỐI NỐI
// so với độ chênh bình thường bên trong một cảnh. Mối nối liền mạch thì 2 số này ngang nhau.
import fs from "node:fs";
import path from "node:path";
import { query, queryOne } from "../../server/db.js";
import { chayFfmpeg, taiVe, thongTin } from "../../server/services/video-cong-cu.js";
const id = Number(process.argv[2]);
const thuMuc = process.argv[3];
fs.mkdirSync(thuMuc, { recursive: true });
const d = (await queryOne<{ url: string; model: string }>("SELECT url, model FROM du_an_video WHERE id = $1", [id]))!;
const canh = (await query<{ url: string; thu_tu: number; gia_thuc: string; anh_mo_dau: string | null }>(
  "SELECT url, thu_tu, gia_thuc, anh_mo_dau FROM video_ai WHERE du_an_id = $1 ORDER BY thu_tu", [id])).rows;
const { anDiaChiKho } = await import("../../server/services/media-proxy.js");
const ghep = path.join(thuMuc, "ghep.mp4");
const goc = (u: string) => (u.startsWith("/media/") ? "http://127.0.0.1:3000" + u : u);
await taiVe(goc(d.url), ghep);
const soKhung: number[] = [];
for (const c of canh) {
  const t = path.join(thuMuc, `canh-${c.thu_tu}.mp4`);
  await taiVe(c.url, t);
  const i = await thongTin(t);
  soKhung.push(Math.round((i.soGiay ?? 0) * 24));
  console.log(`cảnh ${c.thu_tu + 1}: ${i.rong}x${i.cao} ${i.soGiay}s tiếng=${i.coTieng} giá thật $${c.gia_thuc} ảnh đầu=${c.anh_mo_dau ? "có" : "không"}`);
}
const tt = await thongTin(ghep);
console.log(`video ghép: ${tt.rong}x${tt.cao} ${tt.soGiay}s`);
// Độ chênh từng khung (scene score 0..1) của video ghép.
// Ghi ra tệp: log của chayFfmpeg chỉ giữ 20.000 ký tự cuối (đã đo: mất 231/372 khung).
const tepDiem = path.join(thuMuc, "diem.txt");
await chayFfmpeg(["-i", ghep, "-vf", `select='gte(scene,0)',metadata=print:file=${tepDiem}`, "-an", "-f", "null", "-"]);
const diem = [...fs.readFileSync(tepDiem, "utf8").matchAll(/lavfi\.scene_score=([\d.]+)/g)].map((m) => Number(m[1]));
console.log("số khung đo:", diem.length);
let moc = 0;
const moiNoi: number[] = [];
for (const k of soKhung.slice(0, -1)) { moc += k; moiNoi.push(moc); }
const trong = diem.filter((_, i) => !moiNoi.some((m) => Math.abs(i - m) <= 2));
const tb = trong.reduce((a, b) => a + b, 0) / trong.length;
const sx = [...trong].sort((a, b) => a - b);
console.log(`bên trong cảnh: trung bình ${tb.toFixed(4)}, 95% ${sx[Math.floor(sx.length * 0.95)].toFixed(4)}, lớn nhất ${sx[sx.length - 1].toFixed(4)}`);
for (const m of moiNoi) {
  console.log(`mối nối ở khung ${m}: ` + [-2, -1, 0, 1, 2].map((o) => `${o >= 0 ? "+" : ""}${o}:${diem[m + o]?.toFixed(4)}`).join("  "));
  // Ảnh 4 khung quanh mối nối để nhìn bằng mắt.
  await chayFfmpeg(["-i", ghep, "-vf", `select='between(n\\,${m - 2}\\,${m + 1})',scale=240:-2,tile=4x1`, "-frames:v", "1", "-vsync", "0", path.join(thuMuc, `moi-noi-${m}.jpg`)]);
}
// Toàn cảnh: 1 khung mỗi giây.
await chayFfmpeg(["-i", ghep, "-vf", "fps=1,scale=160:-2,tile=8x2", "-frames:v", "1", path.join(thuMuc, "toan-canh.jpg")]);
process.exit(0);
