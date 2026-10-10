import { nhatKyLuot } from "../../server/services/chi-phi.js";
for (const t of ["Infinity", "1e20", "2.5", "-3", "abc"]) {
  const trang = Number(t) || 1; // đúng như route đang làm
  try {
    const r = await nhatKyLuot({ soNgay: 0, trang });
    console.log(t, "→ trang", r.trang, ",", r.luot.length, "lượt");
  } catch (e) {
    console.log(t, "→ LỖI:", (e as Error).message);
  }
}
process.exit(0);
