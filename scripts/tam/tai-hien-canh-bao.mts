import { danhGia, NGUONG_MAC_DINH } from "../../server/services/chi-phi.js";
const ai = { ok: true, conLaiUsd: 2.5, tuanNayUsd: 7, homNayUsd: 0.2, daNapUsd: 10, daTieuUsd: 7.5 };
const kenh = { ok: true, conHoatDong: true, canTraUsd: 12 };
for (const c of danhGia(ai, kenh, NGUONG_MAC_DINH)) {
  console.log("ĐẦY ĐỦ:", c.noiDung);
  console.log("HIỆN Ở DÒNG CHÍNH:", c.noiDung.split(".")[0]);
}
process.exit(0);
