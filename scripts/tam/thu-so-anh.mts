import { query, queryOne } from "../../server/db.js";
import { taoAnhChoBai } from "../../server/services/image-ai.js";
const truoc = (await queryOne<{ c: number }>("SELECT count(*)::int c FROM ai_usage WHERE task = 'image'"))!.c;
const a = await taoAnhChoBai({ userId: 5, trangId: null, noiDung: "Hũ mật ong rừng trên bàn gỗ" });
const sau = await queryOne<{ c: number; usd: string }>("SELECT count(*)::int c, max(cost_usd)::text usd FROM ai_usage WHERE task = 'image'");
console.log(`dòng 'image' trong sổ: trước ${truoc} → sau ${sau!.c} | giá ghi sổ $${sau!.usd} | giá nhà cung cấp báo $${a.costUsd}`);
process.exit(0);
