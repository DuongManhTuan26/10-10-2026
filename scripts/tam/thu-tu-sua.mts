import { tuSuaWebhook } from "../../server/worker.js";
console.log("KẾT QUẢ TỰ SỬA:", await tuSuaWebhook());
process.exit(0);
