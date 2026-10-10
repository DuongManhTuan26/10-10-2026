import { query } from "../../server/db.js";
import "dotenv/config";
const G = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
const j: any = await (await fetch(G + "/accounts", { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } })).json();
console.log(`Zernio đang có ${(j.accounts ?? []).length} kênh:`);
for (const a of j.accounts ?? []) console.log(`  ${a._id} ${a.platform} ${a.displayName ?? a.username} active=${a.isActive} hồ sơ=${typeof a.profileId === "object" ? a.profileId?._id : a.profileId}`);
const app = (await query("SELECT id, platform, display_name, connected, needs_reconnection FROM social_accounts WHERE user_id = 5")).rows;
console.log(`App ghi tài khoản anh có ${app.length} kênh:`); console.table(app);
process.exit(0);
