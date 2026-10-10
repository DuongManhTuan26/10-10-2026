/**
 * TỔNG HỢP kết quả — theo quy ước chấm (bước 1, mục X) và vòng phản biện 4:
 *   - điểm riêng từng phần (Xuyên suốt / Content / Ads / Sales / Phối hợp), không trộn;
 *   - khoảng tin cậy 95% (bootstrap theo đề) — chênh lệch nằm trong khoảng = "không phân biệt được";
 *   - số lỗi nghiêm trọng; độ ổn định qua các lần chạy (pass^k: đề đạt trọn ở MỌI lần);
 *   - CHẤM LẠI từ câu trả lời đã lưu bằng bộ chấm hiện tại (không gọi lại mô hình).
 *
 *   npx tsx scripts/bo-de-dieu-hanh/tong-hop.mts [tệp1.jsonl tệp2.jsonl ...]   (mặc định: mọi tệp trong ket-qua/)
 */
import fs from "node:fs";
import path from "node:path";
import { BO_DE } from "./de.mjs";
import { cham, docTraLoi } from "./cham.mjs";

const thuMuc = path.join(path.dirname(new URL(import.meta.url).pathname), "ket-qua");
const tep = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(thuMuc).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(thuMuc, f));
const theoMa = new Map(BO_DE.map((d) => [d.ma, d]));

interface Dong { de: string; model: string; tien: number; giay: number; traLoi: string; loiGoi: string | null }
// Lượt lỗi GỌI (hết hạn mức, mạng…) không phải câu trả lời của mô hình → bỏ, không tính 0 điểm.
const dong: Dong[] = tep.flatMap((f) => fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)))
  .filter((d: Dong) => !d.loiGoi);

const PHAN = ["xuyen_suot", "content", "ads", "sales", "phoi_hop"] as const;
const mohinh = [...new Set(dong.map((d) => d.model))];

/** Bootstrap 95% cho trung bình theo đề (2.000 lần, hạt giống cố định để chạy lại ra cùng số). */
function khoang(gia: number[]): [number, number] {
  if (gia.length < 2) return [NaN, NaN];
  let hat = 12345;
  const ngauNhien = () => ((hat = (hat * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const tb: number[] = [];
  for (let i = 0; i < 2000; i++) {
    let s = 0;
    for (let j = 0; j < gia.length; j++) s += gia[Math.floor(ngauNhien() * gia.length)];
    tb.push(s / gia.length);
  }
  tb.sort((a, b) => a - b);
  return [tb[50], tb[1949]];
}

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : "—");
for (const m of mohinh) {
  const cua = dong.filter((d) => d.model === m);
  const theoDe = new Map<string, { tiLe: number; nghiem: string[] }[]>();
  for (const d of cua) {
    const de = theoMa.get(d.de);
    if (!de) continue;
    const k = cham(de, docTraLoi(d.traLoi ?? ""));
    const ds = theoDe.get(d.de) ?? [];
    ds.push({ tiLe: k.tiLe, nghiem: k.nghiemTrong });
    theoDe.set(d.de, ds);
  }
  const diemDe = [...theoDe.entries()].map(([ma, ds]) => ({ ma, phan: theoMa.get(ma)!.phan, tb: ds.reduce((s, x) => s + x.tiLe, 0) / ds.length, tron: ds.every((x) => x.tiLe === 1), nghiem: ds.filter((x) => x.nghiem.length).length, lan: ds.length }));
  const tatCa = diemDe.map((x) => x.tb);
  const [lo, hi] = khoang(tatCa);
  const tien = cua.reduce((s, d) => s + (d.tien || 0), 0);
  const giay = cua.reduce((s, d) => s + (d.giay || 0), 0) / Math.max(1, cua.length);
  console.log(`\n■ ${m}`);
  console.log(`  Tổng: ${pct(tatCa.reduce((s, x) => s + x, 0) / tatCa.length)} (KTC95 ${pct(lo)}–${pct(hi)}) · ${diemDe.length} đề × ${Math.max(...diemDe.map((x) => x.lan))} lần · lỗi nghiêm trọng ${diemDe.reduce((s, x) => s + x.nghiem, 0)} lượt · đạt trọn mọi lần ${diemDe.filter((x) => x.tron).length}/${diemDe.length} đề · ${tien.toFixed(3)} USD · ${giay.toFixed(0)} giây/lượt`);
  for (const p of PHAN) {
    const ds = diemDe.filter((x) => x.phan === p);
    if (!ds.length) continue;
    const [a, b] = khoang(ds.map((x) => x.tb));
    console.log(`  ${p.padEnd(11)} ${pct(ds.reduce((s, x) => s + x.tb, 0) / ds.length).padStart(4)} (KTC95 ${pct(a)}–${pct(b)}) · ${ds.map((x) => `${x.ma}:${pct(x.tb)}${x.nghiem ? "!" : ""}`).join(" ")}`);
  }
}
console.log("\nKý hiệu: '!' = có lượt mắc lỗi nghiêm trọng (0 điểm lượt đó).");
