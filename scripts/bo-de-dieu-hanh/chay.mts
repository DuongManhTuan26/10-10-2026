/**
 * CHẠY bộ đề trên các mô hình qua OpenRouter — đầu vào và cài đặt GIỐNG HỆT cho mọi mô hình (quy ước X.6), ghi lại toàn
 * bộ để chạy lại được. Trần tiền cứng: chạm trần là dừng.
 *
 *   MO_HINH=a,b,c  DE=X1,X2  LAN=1  TRAN_USD=4.5  npx tsx --env-file=.env scripts/bo-de-dieu-hanh/chay.mts
 *   NOI_TIEP=ket-qua/<tệp>.jsonl … — chỉ chạy lượt CHƯA có câu trả lời (lượt lỗi gọi được chạy lại), ghi tiếp vào tệp đó.
 */
import fs from "node:fs";
import path from "node:path";
import { BO_DE } from "./de.mjs";
import { cham, docTraLoi } from "./cham.mjs";
import { loiDanHeThong } from "./khuon.mjs";
import { ghiChiNgoaiSo } from "../ghi-chi-ngoai-so.mjs";

const BAT_DAU = new Date();

const MO_HINH = (process.env.MO_HINH ?? "openai/gpt-5.6-sol,anthropic/claude-opus-5.5,anthropic/claude-sonnet-5.5").split(",");
const DE = process.env.DE ? BO_DE.filter((d) => process.env.DE!.split(",").includes(d.ma)) : BO_DE;
const LAN = Number(process.env.LAN ?? 1);
const TRAN = Number(process.env.TRAN_USD ?? 4.5);
const KHOA = process.env.OPENROUTER_API_KEY;
if (!KHOA) throw new Error("Thiếu OPENROUTER_API_KEY");

// Cài đặt chung — giống hệt mọi mô hình.
const CAI_DAT = { reasoning: { effort: "medium" }, max_tokens: 8000, usage: { include: true } };

const thuMuc = path.join(path.dirname(new URL(import.meta.url).pathname), "ket-qua");
fs.mkdirSync(thuMuc, { recursive: true });
const tep = process.env.NOI_TIEP
  ? path.resolve(thuMuc, path.basename(process.env.NOI_TIEP))
  : path.join(thuMuc, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
// Lượt đã có câu trả lời thật (không lỗi gọi) → bỏ qua, không trả tiền hai lần.
const daCo = new Set(
  fs.existsSync(tep)
    ? fs.readFileSync(tep, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
        .filter((d) => !d.loiGoi).map((d) => `${d.lan}|${d.de}|${d.model}`)
    : []
);
const heThong = loiDanHeThong();
let tong = 0;

async function goi(model: string, noiDung: string) {
  for (let lan = 1; lan <= 3; lan++) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KHOA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: heThong }, { role: "user", content: noiDung }], ...CAI_DAT }),
      signal: AbortSignal.timeout(240_000),
    });
    const j = (await r.json().catch(() => null)) as Record<string, any> | null;
    if (r.ok && j?.choices?.[0]) return j;
    if (lan === 3 || (r.status < 500 && r.status !== 429)) return { loi: `${r.status} ${JSON.stringify(j).slice(0, 300)}` };
    await new Promise((x) => setTimeout(x, 3000 * lan));
  }
}

outer: for (let lan = 1; lan <= LAN; lan++) {
  for (const de of DE) {
    for (const model of MO_HINH) {
      if (daCo.has(`${lan}|${de.ma}|${model}`)) continue;
      if (tong >= TRAN) { console.log(`DỪNG: chạm trần ${TRAN} USD`); break outer; }
      const noiDung = `DỮ LIỆU:\n${de.duLieu}\n\nCÂU HỎI: ${de.cauHoi}`;
      const t0 = Date.now();
      const j = await goi(model, noiDung);
      // Hết hạn mức chi tiêu → dừng ngay, không đốt hết danh sách bằng các lượt lỗi.
      if (j && "loi" in j && /budget|credit|403|402/i.test(String(j.loi))) {
        console.log(`DỪNG: nhà cung cấp chặn — ${String(j.loi).slice(0, 160)}`);
        break outer;
      }
      const chu = j && "choices" in j ? String(j.choices[0].message?.content ?? "") : "";
      const tien = j && "usage" in j ? Number(j.usage?.cost ?? 0) : 0;
      tong += tien;
      const kq = cham(de, docTraLoi(chu));
      const dong = { lan, de: de.ma, phan: de.phan, model, tien, giay: (Date.now() - t0) / 1000, tiLe: kq.tiLe, nghiemTrong: kq.nghiemTrong, chiTiet: kq.chiTiet, loiGoi: j && "loi" in j ? j.loi : null, usage: j && "usage" in j ? j.usage : null, traLoi: chu };
      fs.appendFileSync(tep, JSON.stringify(dong) + "\n");
      console.log(`${de.ma} lần ${lan} · ${model.split("/")[1]} · ${(kq.tiLe * 100).toFixed(0)}%${kq.nghiemTrong.length ? " · NGHIÊM TRỌNG: " + kq.nghiemTrong.join("; ") : ""} · ${tien.toFixed(4)} USD · cộng ${tong.toFixed(3)}`);
    }
  }
}
console.log(`Xong. Tổng ${tong.toFixed(4)} USD. Kết quả: ${tep}`);
await ghiChiNgoaiSo({ ma: `bo_de_chay_${path.basename(tep)}`, usd: tong, tu: BAT_DAU, lyDo: "Nghiên cứu AI Điều hành (bộ đề)", canCu: `Tổng usage.cost — ${path.basename(tep)}` });
