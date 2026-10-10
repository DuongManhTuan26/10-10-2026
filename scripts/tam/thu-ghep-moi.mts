// Ghép lại 3 clip thật của dự án #6 bằng lệnh mới, trên máy, không tốn tiền.
import path from "node:path";
import { chayFfmpeg, demKhung, lenhGhep, thongTin } from "../../server/services/video-cong-cu.js";
const d = process.argv[2];
const tep = [0, 1, 2].map((i) => path.join(d, `canh-${i}.mp4`));
const info = await Promise.all(tep.map(thongTin));
const soKhung = await Promise.all(tep.map(demKhung));
console.log("số khung:", soKhung);
console.log("khung/giây đọc được:", info.map((x) => x.khungMoiGiay), "| có tiếng:", info.map((x) => x.coTieng));
for (const coTieng of [false, true]) {
  const ra = path.join(d, `ghep-moi-${coTieng ? "tieng" : "cam"}.mp4`);
  await chayFfmpeg(lenhGhep(tep, info, soKhung, coTieng, ra));
  const log = await chayFfmpeg(["-i", ra, "-f", "null", "-"]);
  const khung = Number([...log.matchAll(/frame= *(\d+)/g)].pop()?.[1]);
  const t = await thongTin(ra);
  console.log(`${coTieng ? "có tiếng" : "không tiếng"}: ${khung} khung (cần 124+123+123=370), dài ${t.soGiay}s, tiếng=${t.coTieng}`);
  if (coTieng) {
    const a = await chayFfmpeg(["-i", ra, "-map", "0:a", "-f", "null", "-"]);
    console.log("  độ dài tiếng:", /time=(\S+)/g.exec([...a.matchAll(/time=(\S+)/g)].pop()![0])?.[1], "| hình:", (khung / 24).toFixed(3) + "s");
  }
}
process.exit(0);
