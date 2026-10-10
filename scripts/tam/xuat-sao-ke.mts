import { saoKe } from "../../server/services/chi-phi.js";
const d = await saoKe(0);
console.log(JSON.stringify(d));
process.exit(0);
