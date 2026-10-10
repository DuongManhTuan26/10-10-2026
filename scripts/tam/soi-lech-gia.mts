import { query } from "../../server/db.js";
console.table((await query(`SELECT id, model, do_net, khung, so_giay, (anh_mo_dau IS NOT NULL) co_anh, (video_nguon IS NOT NULL) sua, gia_uoc_tinh::float uoc, gia_thuc::float thuc, round((gia_thuc/NULLIF(gia_uoc_tinh,0))::numeric, 3) ty_le FROM video_ai WHERE trang_thai = 'xong' ORDER BY id`)).rows);
process.exit(0);
