import { query } from "../../server/db.js";
import "dotenv/config";
const G = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
const j: any = await (await fetch(G + "/accounts", { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } })).json();
const cuaAnh = new Set((await query<{ id: string }>("SELECT id FROM social_accounts WHERE user_id = 5")).rows.map((x) => x.id));
const hoSoAnh = (await query<{ r: string }>("SELECT profile_ref r FROM users WHERE id = 5")).rows[0]?.r;
console.log("hồ sơ của tài khoản anh:", hoSoAnh, "| kênh của anh trong app:", [...cuaAnh].join(", "));
for (const a of j.accounts ?? []) {
  const p = typeof a.profileId === "object" ? a.profileId?._id : a.profileId;
  if (!["6a7edbe2af348aa7544ecdf9", "6abd02d1441855077ca7576e"].includes(p)) continue;
  console.log(`kênh ${a._id} | ${a.platform} | ${a.displayName ?? a.username} | hồ sơ ${p} | thuộc tài khoản anh: ${cuaAnh.has(a._id)}`);
}
process.exit(0);
