/**
 * Video dài nhiều cảnh: kịch bản → video, ảnh tham chiếu → video, trend → video.
 *
 * Cách giữ các cảnh liền mạch và nhất quán:
 *   1. AI chia ý tưởng thành các cảnh, kèm MỘT đoạn "mô tả nhất quán" (nhân vật,
 *      trang phục, sản phẩm, bối cảnh, ánh sáng, phong cách) gắn vào MỌI cảnh.
 *   2. Cảnh 1 dùng ảnh tham chiếu của chủ shop để dựng đúng nhân vật/sản phẩm.
 *   3. Cảnh 2 trở đi lấy KHUNG CUỐI của cảnh trước làm khung mở đầu, nên chuyển
 *      cảnh liền mạch. (Nhà cung cấp bỏ qua ảnh tham chiếu khi đã có khung mở
 *      đầu — tài liệu của họ ghi vậy — nên không gửi cả hai.)
 *   4. Xong hết thì ghép bằng ffmpeg thành một video.
 *
 * Các cảnh phải tạo LẦN LƯỢT vì cảnh sau cần khung cuối của cảnh trước.
 */

import { anhTheoKhung, ghepVideo, layKhungCuoi } from "./video-cong-cu.js";
import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";
import { chatJson, asRecord, banGhi, optionalString } from "./ai.js";
import {
  diaChiKhoHopLe,
  giaMoiGiay,
  guiViecVideo,
  layDanhSachModel,
  lyDoKhongHop,
  videoDangBat,
  type LuaChonVideo,
  type ModelVideo,
} from "./video-ai.js";

// ---------------------------------------------------------------------------
// Chia cảnh
// ---------------------------------------------------------------------------

export interface Canh {
  soGiay: number;
  moTa: string;
  tomTat: string;
}

export const TOI_DA_CANH = 10;
export const TOI_DA_GIAY_DU_AN = 120;

/** Số giây gần nhất mà model làm được. */
export function giayGanNhat(model: ModelVideo, s: number): number {
  return model.soGiay.reduce((tot, g) => (Math.abs(g - s) < Math.abs(tot - s) ? g : tot), model.soGiay[0]);
}

/**
 * Chuẩn hoá phân cảnh AI trả về: đưa số giây mỗi cảnh về giá trị model làm
 * được, cắt bớt cảnh thừa. Không tin AI tự tuân thủ giới hạn.
 */
export function chuanHoaCanh(model: ModelVideo, tho: unknown): Canh[] {
  const ds = Array.isArray(tho) ? tho : [];
  const canh: Canh[] = [];
  let tong = 0;
  for (const c of ds.slice(0, TOI_DA_CANH)) {
    const o = banGhi(c);
    const moTa = optionalString(o.moTa)?.slice(0, 1_500);
    if (!moTa) continue;
    const soGiay = giayGanNhat(model, Number(o.soGiay) || model.soGiay[0]);
    if (tong + soGiay > TOI_DA_GIAY_DU_AN) break;
    tong += soGiay;
    canh.push({ soGiay, moTa, tomTat: optionalString(o.tomTat)?.slice(0, 300) ?? "" });
  }
  return canh;
}

export async function chiaCanh(p: {
  userId: number;
  yTuong: string;
  tongGiay: number;
  model: ModelVideo;
  coAnhThamChieu: boolean;
  /** Phân tích một video trend, nếu làm theo trend. */
  congThucTrend?: string;
}): Promise<{ nhatQuan: string; canh: Canh[] }> {
  const toiDaMoiCanh = p.model.soGiay[p.model.soGiay.length - 1];
  const soCanh = Math.max(1, Math.min(TOI_DA_CANH, Math.ceil(p.tongGiay / toiDaMoiCanh)));
  const kq = await chatJson({
    task: "content",
    viec: "chia_canh",
    userId: p.userId,
    temperature: 0.7,
    maxTokens: 2_500,
    validate: (v) => asRecord(v),
    messages: [
      {
        role: "system",
        content: [
          "You are a video director turning a sales idea into a multi-shot AI video for Facebook.",
          'Return JSON: {"nhatQuan": string, "canh": [{"soGiay": number, "moTa": string, "tomTat": string}]}.',
          "- nhatQuan (English): ONE consistency bible reused verbatim in every shot: each character's",
          "  face, age, hair, outfit; the product's exact look; the setting; lighting; color grade; camera style.",
          `- canh: about ${soCanh} shots, total about ${p.tongGiay} seconds. Allowed shot lengths: ${p.model.soGiay.join(", ")} seconds.`,
          "- Each moTa (English): what happens in that shot, camera movement, and it must START exactly",
          "  where the previous shot ended (same place, same pose), so shots join seamlessly.",
          "- Shot 1 grabs attention in its first 2 seconds. The last shot ends on a satisfying product moment.",
          "- tomTat: one short Vietnamese sentence per shot for the shop owner.",
          p.coAnhThamChieu
            ? "- Reference photos of the real characters/product will be provided to the video model: describe them generically, do not invent new branding."
            : "- Keep product packaging plain and unbranded.",
          "- Never ask for on-screen text, captions, logos or brand names. No markdown.",
          ...(p.congThucTrend
            ? ["- Follow this trending video's FORMULA (structure, hook, pacing, shot types, mood) but create completely new content for this product — do not copy its footage or people:", p.congThucTrend]
            : []),
        ].join("\n"),
      },
      { role: "user", content: `Idea / script (Vietnamese):\n"""${p.yTuong.slice(0, 4_000)}"""` },
    ],
  });
  const nhatQuan = optionalString(kq.output.nhatQuan)?.slice(0, 2_000) ?? "";
  const canh = chuanHoaCanh(p.model, kq.output.canh);
  if (!canh.length) throw new AppError("AI chưa chia được cảnh, thử lại hoặc viết ý tưởng rõ hơn.", 502);
  return { nhatQuan, canh };
}

// ---------------------------------------------------------------------------
// Dự án
// ---------------------------------------------------------------------------

export interface DuAnVideo {
  id: number;
  loai: string;
  y_tuong: string;
  anh_tham_chieu: string[];
  nhat_quan: string;
  phan_canh: Canh[];
  model: string;
  do_net: string;
  khung: string;
  co_tieng: boolean;
  trang_thai: "nhap" | "dang_tao" | "dang_ghep" | "xong" | "loi";
  gia_uoc_tinh: string | null;
  gia_thuc: string | null;
  url: string | null;
  loi: string | null;
  created_at: string;
}

export const COT_DU_AN =
  "id, loai, y_tuong, anh_tham_chieu, nhat_quan, phan_canh, model, do_net, khung, co_tieng, trang_thai, gia_uoc_tinh, gia_thuc, url, loi, created_at";

/** Giá ước tính cả dự án: cảnh 1 không khung mở đầu, các cảnh sau có. */
export function giaDuAn(model: ModelVideo, canh: Canh[], lc: Omit<LuaChonVideo, "soGiay" | "coAnhMoDau">): number | null {
  let tong = 0;
  for (const [i, c] of canh.entries()) {
    const g = giaMoiGiay(model, { ...lc, soGiay: c.soGiay, coAnhMoDau: i > 0 });
    if (g === null) return null;
    tong += g * c.soGiay;
  }
  return Math.round(tong * 1_000_000) / 1_000_000;
}

async function layModelNoiCanh(id: string, lc: Omit<LuaChonVideo, "soGiay" | "coAnhMoDau">): Promise<ModelVideo> {
  const model = (await layDanhSachModel()).find((m) => m.id === id);
  if (!model) throw new AppError("Model video này không có hoặc đã ngừng.", 400);
  if (!model.anhMoDau) {
    throw new AppError("Model này không nhận khung mở đầu nên không nối các cảnh liền mạch được. Chọn model khác.", 400);
  }
  const lyDo = lyDoKhongHop(model, { ...lc, soGiay: model.soGiay[0], coAnhMoDau: true });
  if (lyDo) throw new AppError(`Model này ${lyDo}.`, 400);
  return model;
}

export async function taoDuAn(p: {
  userId: number;
  trangId: number;
  loai: "kich_ban" | "tham_chieu" | "trend";
  yTuong: string;
  tongGiay: number;
  model: string;
  lc: Omit<LuaChonVideo, "soGiay" | "coAnhMoDau">;
  anhThamChieu: string[];
  congThucTrend?: string;
}): Promise<DuAnVideo> {
  if (!(await videoDangBat(p.trangId))) {
    throw new AppError("Tạo video AI đang tắt. Bật trong phần soạn bài trước khi tạo.", 409);
  }
  const yTuong = p.yTuong.trim();
  if (!yTuong) throw new AppError("Cần ý tưởng hoặc kịch bản cho video.", 400);
  const tongGiay = Math.min(TOI_DA_GIAY_DU_AN, Math.max(4, Math.round(p.tongGiay) || 15));
  const anh = p.anhThamChieu.slice(0, 4).map((u) => diaChiKhoHopLe(u, "Ảnh tham chiếu"));
  if (p.loai === "tham_chieu" && !anh.length) throw new AppError("Cần ít nhất một ảnh tham chiếu.", 400);

  const model = await layModelNoiCanh(p.model, p.lc);
  const { nhatQuan, canh } = await chiaCanh({
    userId: p.userId, yTuong, tongGiay, model, coAnhThamChieu: anh.length > 0, congThucTrend: p.congThucTrend,
  });
  const row = await queryOne<DuAnVideo>(
    `INSERT INTO du_an_video
       (user_id, trang_id, loai, y_tuong, anh_tham_chieu, nhat_quan, phan_canh, model, do_net, khung, co_tieng, gia_uoc_tinh)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10,$11,$12)
     RETURNING ${COT_DU_AN}`,
    [p.userId, p.trangId, p.loai, yTuong, JSON.stringify(anh), nhatQuan, JSON.stringify(canh),
      model.id, p.lc.doNet, p.lc.khung, p.lc.coTieng, giaDuAn(model, canh, p.lc)]
  );
  return row!;
}

/** Chủ shop sửa phân cảnh trước khi tạo. Chỉ sửa được khi còn là nháp. */
export async function suaDuAn(p: {
  trangId: number;
  id: number;
  nhatQuan: string;
  phanCanh: unknown;
}): Promise<DuAnVideo> {
  const cu = await queryOne<DuAnVideo>(
    `SELECT ${COT_DU_AN} FROM du_an_video WHERE id = $1 AND trang_id = $2`,
    [p.id, p.trangId]
  );
  if (!cu) throw new AppError("Không tìm thấy dự án video", 404);
  if (cu.trang_thai !== "nhap") throw new AppError("Dự án đã bắt đầu tạo, không sửa được nữa.", 409);
  const lc = { doNet: cu.do_net, khung: cu.khung, coTieng: cu.co_tieng };
  const model = await layModelNoiCanh(cu.model, lc);
  const canh = chuanHoaCanh(model, p.phanCanh);
  if (!canh.length) throw new AppError("Cần ít nhất một cảnh.", 400);
  const row = await queryOne<DuAnVideo>(
    `UPDATE du_an_video SET nhat_quan = $3, phan_canh = $4::jsonb, gia_uoc_tinh = $5, updated_at = now()
      WHERE id = $1 AND trang_id = $2 RETURNING ${COT_DU_AN}`,
    [p.id, p.trangId, p.nhatQuan.slice(0, 2_000), JSON.stringify(canh), giaDuAn(model, canh, lc)]
  );
  return row!;
}

export async function batDauDuAn(trangId: number, id: number): Promise<DuAnVideo> {
  if (!(await videoDangBat(trangId))) {
    throw new AppError("Tạo video AI đang tắt. Bật trong phần soạn bài trước khi tạo.", 409);
  }
  const row = await queryOne<DuAnVideo>(
    `UPDATE du_an_video SET trang_thai = 'dang_tao', updated_at = now()
      WHERE id = $1 AND trang_id = $2 AND trang_thai = 'nhap' RETURNING ${COT_DU_AN}`,
    [id, trangId]
  );
  if (!row) throw new AppError("Không bắt đầu được: dự án không có hoặc đã chạy rồi.", 409);
  return row;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function ketThucDuAn(id: number, loi: string): Promise<void> {
  await query(
    `UPDATE du_an_video SET trang_thai = 'loi', loi = $2, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [id, loi.slice(0, 500)]
  );
}

async function tienMotDuAn(d: DuAnVideo & { user_id: number; trang_id: number }): Promise<void> {
  const canhDaTao = await query<{ thu_tu: number; trang_thai: string; url: string | null; loi: string | null; gia_thuc: string | null }>(
    "SELECT thu_tu, trang_thai, url, loi, gia_thuc FROM video_ai WHERE du_an_id = $1 ORDER BY thu_tu",
    [d.id]
  );
  const ds = canhDaTao.rows;
  const hong = ds.find((c) => c.trang_thai === "loi");
  if (hong) {
    await ketThucDuAn(d.id, `Cảnh ${hong.thu_tu + 1} lỗi: ${hong.loi ?? "không rõ"}`);
    return;
  }
  if (ds.some((c) => c.trang_thai === "dang_tao")) return;

  if (d.trang_thai === "dang_tao" && ds.length < d.phan_canh.length) {
    const i = ds.length;
    const c = d.phan_canh[i];
    const lc = { soGiay: c.soGiay, doNet: d.do_net, khung: d.khung, coTieng: d.co_tieng, coAnhMoDau: i > 0 };
    const model = (await layDanhSachModel()).find((m) => m.id === d.model);
    if (!model) {
      await ketThucDuAn(d.id, "Model video đã ngừng giữa chừng.");
      return;
    }
    const anhMoDau = i > 0 ? await layKhungCuoi(ds[i - 1].url!, `khung-cuoi-${d.id}-${i}.jpg`) : undefined;
    // Cảnh sau nối từ khung cuối nên tự đúng khung; chỉ cảnh đầu cần cắt ảnh tham chiếu.
    const anhThamChieuCanhDau =
      i === 0
        ? await Promise.all(
            d.anh_tham_chieu.map((u, k) => anhTheoKhung(u, d.khung, d.do_net, `tham-chieu-${d.id}-${k}.jpg`))
          )
        : [];
    const loiMoTa =
      `${d.nhat_quan}\n\nShot ${i + 1} of ${d.phan_canh.length}: ${c.moTa}` +
      (i > 0 ? "\nContinue seamlessly from the provided first frame; keep every character and object identical." : "");
    await guiViecVideo({
      userId: d.user_id,
      trangId: d.trang_id,
      model,
      loiMoTa,
      lc,
      anhMoDau,
      anhThamChieu: i === 0 ? anhThamChieuCanhDau : [],
      duAnId: d.id,
      thuTu: i,
    });
    return;
  }

  // Mọi cảnh đã xong: ghép.
  await query("UPDATE du_an_video SET trang_thai = 'dang_ghep', updated_at = now() WHERE id = $1", [d.id]);
  const url = await ghepVideo(ds.map((c) => c.url!), d.co_tieng, `video-dai-${d.user_id}-${d.id}.mp4`);
  const tong = ds.reduce((t, c) => t + (Number(c.gia_thuc) || 0), 0);
  await query(
    `UPDATE du_an_video SET trang_thai = 'xong', url = $2, gia_thuc = $3, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [d.id, url, tong]
  );
}

/** Gọi định kỳ từ worker (sau khi đã chốt các việc video). */
export async function runDueVideoProjects(): Promise<number> {
  const duAn = await query<DuAnVideo & { user_id: number; trang_id: number }>(
    `UPDATE du_an_video SET dang_xu_ly_tu = now()
      WHERE id IN (
        SELECT id FROM du_an_video
         WHERE trang_thai IN ('dang_tao', 'dang_ghep')
           AND (dang_xu_ly_tu IS NULL OR dang_xu_ly_tu < now() - interval '15 minutes')
         ORDER BY updated_at LIMIT 3)
     RETURNING ${COT_DU_AN}, user_id, trang_id`
  );
  let daXong = 0;
  for (const d of duAn.rows) {
    try {
      await tienMotDuAn(d);
    } catch (error) {
      const loi = error instanceof Error ? error.message : String(error);
      console.error(`[video dài] Dự án ${d.id}:`, loi);
      // Lỗi khi tạo cảnh hay khi ghép thì dừng hẳn, không thử lại mù quáng — mỗi
      // lần thử lại là tiền thật.
      await ketThucDuAn(d.id, loi);
    } finally {
      const con = await queryOne(
        `UPDATE du_an_video SET dang_xu_ly_tu = NULL WHERE id = $1 AND trang_thai IN ('dang_tao','dang_ghep') RETURNING id`,
        [d.id]
      );
      if (!con) daXong++;
    }
  }
  return daXong;
}
