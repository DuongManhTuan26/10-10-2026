import { queryOne } from "../../server/db.js";
import { verifyPassword } from "../../server/auth.js";
const u = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 5");
console.log("khớp email đầy đủ:", await verifyPassword("hoangtuan3310tn@gmail.com", u!.password_hash));
console.log("khớp hoangtuan3310tn:", await verifyPassword("hoangtuan3310tn", u!.password_hash));
process.exit(0);
