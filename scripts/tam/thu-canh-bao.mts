import { query, queryOne } from "../../server/db.js";
import { runDueCanhBaoChiPhi, luuNguong, docNguong } from "../../server/services/chi-phi.js";
const cu = await docNguong();
const daGuiCu = (await queryOne<{ gia_tri: unknown }>("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'"))?.gia_tri ?? null;
try {
  await query("DELETE FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'");
  await luuNguong({ ...cu, soDuToiThieuUsd: 100 }); // ép "sắp hết tiền"
  const tin: { adminId: number; noiDung: string }[] = [];
  const gui = async (adminId: number, noiDung: string) => { tin.push({ adminId, noiDung }); return true; };
  const lan1 = await runDueCanhBaoChiPhi(gui);
  console.log(`Lần 1: gửi tới ${lan1} quản trị`);
  console.log(tin[0]?.noiDung);
  const lan2 = await runDueCanhBaoChiPhi(gui);
  console.log(`\nLần 2 (ngay sau): gửi tới ${lan2} quản trị — phải là 0, không gửi lặp`);
  const guiHong = async () => false;
  await query("DELETE FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'");
  await runDueCanhBaoChiPhi(guiHong);
  const daGhi = (await queryOne("SELECT 1 FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'")) !== null;
  console.log(`Gửi hỏng (chưa liên kết Telegram) thì không đánh dấu đã gửi: ${!daGhi}`);
} finally {
  await luuNguong(cu);
  await query("DELETE FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'");
  if (daGuiCu) await query("INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('canh_bao_da_gui', $1::jsonb)", [JSON.stringify(daGuiCu)]);
  console.log("đã trả ngưỡng về:", JSON.stringify(await docNguong()));
  process.exit(0);
}
