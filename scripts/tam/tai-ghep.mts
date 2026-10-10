import { queryOne } from "../../server/db.js";
import { taiVe } from "../../server/services/video-cong-cu.js";
const d = (await queryOne<{ url: string }>("SELECT url FROM du_an_video WHERE id = $1", [Number(process.argv[2])]))!;
await taiVe(d.url.startsWith("/media/") ? "http://127.0.0.1:3000" + d.url : d.url, process.argv[3]);
process.exit(0);
