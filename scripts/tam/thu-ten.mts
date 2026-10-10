import { query } from "../../server/db.js";
import { chuanBiDoc, docThanhGiong, ngheThanhChu } from "../../server/services/am-thanh-ai.js";
const u = (await query("SELECT user_id FROM du_an_video WHERE id = 9")).rows[0].user_id;
const loi = "Nhắn tin cho BrewManager AI ngay để được tư vấn và cài đặt.";
console.log("gửi giọng đọc:", chuanBiDoc(loi));
for (let k = 0; k < 2; k++) {
  const b = await docThanhGiong({ userId: u, loiDoc: loi });
  console.log(`lần ${k + 1} nghe ra:`, await ngheThanhChu({ userId: u, am: b, dinhDang: "wav" }));
}
process.exit(0);
