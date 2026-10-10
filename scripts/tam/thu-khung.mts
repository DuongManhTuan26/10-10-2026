import { query } from "../../server/db.js";
import { guiViecVideo, layDanhSachModel } from "../../server/services/video-ai.js";
const m = (await layDanhSachModel()).find((x) => x.id === "bytedance/seedance-1-5-pro")!;
const trang = (await query(`SELECT id FROM trang WHERE user_id = 5 ORDER BY id LIMIT 1`)).rows[0].id;
for (const khung of ["21:9", "3:4"]) {
  const v = await guiViecVideo({ userId: 5, trangId: trang, model: m, loiMoTa: "Hơi nước bốc lên từ ly cà phê nóng, ánh nắng sớm", lc: { soGiay: 4, doNet: "480p", khung, coTieng: false, coAnhMoDau: false } });
  console.log("GỬI", khung, "#" + v.id, "ước", v.gia_uoc_tinh);
}
process.exit(0);
