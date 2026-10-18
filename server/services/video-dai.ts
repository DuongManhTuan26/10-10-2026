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
import { docThanhGiong, ngheThanhChu, PCM_TAN_SO, taoNhacNen, uocTinhTienGiong } from "./am-thanh-ai.js";
import { GIA_KHUNG_UOC_TINH, taoAnhNhanVat, taoKhungVideo } from "./khung-video.js";
import { kiemDinhCanh } from "./kiem-dinh-video.js";
import { MODEL_GIONG_DOC_DUOC_CHON, MODEL_NHAC_NEN, MODEL_NHIEU_CANH, MODEL_NOI_DAI, MODEL_TIENG_VIET_GOC } from "./model-duoc-chon.js";
import { chayFfmpeg, duaLenKho, TEMPO_TOI_DA, voiThuMucTam } from "./video-cong-cu.js";
import fs from "node:fs/promises";
import path from "node:path";
import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";
import { chatJson, asRecord, banGhi, optionalString } from "./ai.js";
import {
  diaChiKhoHopLe,
  giaVideo,
  guiViecVideo,
  layDanhSachModel,
  lyDoKhongHop,
  type ChuTrongVideo,
  type HuongKichBan,
  type LuaChonVideo,
  type LuatNoiDung,
  type ModelVideo,
} from "./video-ai.js";
import { giaKhungVideo, type LuaChonVeAnh } from "./image-ai.js";
import { chayChoTrang } from "./ngu-canh-trang.js";
import { DK_TAI_KHOAN_MO, TaiKhoanKhoaError } from "./tai-khoan-mo.js";

/** Cách làm video dài: ghép nhiều cảnh (mọi mô hình) hoặc NỐI DÀI gốc của hãng. */
export type CheDoVideoDai = "ghep_canh" | "noi_dai";

// ---------------------------------------------------------------------------
// Chia cảnh
// ---------------------------------------------------------------------------

export interface Canh {
  soGiay: number;
  moTa: string;
  tomTat: string;
  /**
   * true: quay tiếp cảnh trước như MỘT cú máy liền (nối từ khung cuối).
   * false: cắt sang cảnh mới (góc máy / nơi / lúc khác) — khung đầu vẽ bằng AI ảnh.
   * Cảnh 1 luôn false.
   */
  noiTiep: boolean;
  /** Lời đọc tiếng Việt của cảnh — đọc bằng giọng AI và hiện thành phụ đề. */
  loiDoc: string;
}

/** Giọng đọc, nhạc nền, phụ đề của một dự án. */
export interface AmThanh {
  /** Chữ trong video do người dùng chọn (xem luatVideo trong video-ai.ts). */
  chuTrongVideo: ChuTrongVideo;
  /**
   * Lời dẫn do CHÍNH mô hình video nói (tiếng Việt gốc) thay cho giọng đọc AI riêng.
   * Chỉ mô hình có trong MODEL_TIENG_VIET_GOC (Seedance 2.5 — tài liệu BytePlus).
   */
  giongGoc: boolean;
  /** Hai luật nội dung người dùng bật/tắt (xem LuatNoiDung trong video-ai.ts). */
  chanNhanHieuGia: boolean;
  chanNguoiThat: boolean;
  /** Hướng kịch bản người dùng bật/tắt (xem HuongKichBan trong video-ai.ts). */
  cauTrucQuangCao: boolean;
  giuSuThat: boolean;
  boiCanhVietNam: boolean;
  giongDoc: boolean;
  modelGiong: string;
  giong: string;
  nhac: boolean;
  moTaNhac: string;
  phuDe: boolean;
  /** Mô hình vẽ khung mở đầu + ảnh mẫu nhân vật (cảnh cắt) — người dùng chọn, không cố định. */
  veAnh?: LuaChonVeAnh;
  /** Kiểu kịch bản người dùng chọn (KIEU_KICH_BAN) — "tu_do" = theo đúng ý tưởng, không thêm gì. */
  kieuKichBan: KieuKichBan;
}

/**
 * Kiểu kịch bản = "kỹ năng" của đối thủ (Pippit: Marketing Video, Creator Commerce, Drama Ads; Dreamina:
 * tiktok-product-sales-script — docs/nghien-cuu-doi-thu.md). LỰA CHỌN của người dùng, không gài cứng:
 * "tu_do" không thêm câu nào vào lời nhắc.
 */
export type KieuKichBan = "tu_do" | "quang_cao" | "ugc" | "phim_ngan";
export const KIEU_KICH_BAN: Record<Exclude<KieuKichBan, "tu_do" | "quang_cao">, string> = {
  ugc:
    "- Creator-style (UGC) video: it must look filmed on a phone by a real customer or creator — handheld, natural light, " +
    "a real home or shop; the creator talks to the camera and shows the product being used (unboxing, try-on, demo or " +
    "honest review). Show, don't tell: turn features into actions, never read a spec sheet.",
  phim_ngan:
    "- Mini-drama with the product: a hook in the first 2 seconds, rising tension, one clear twist, and in the final beat " +
    "the product is what turns the situation around.",
};

export function docAmThanh(v: unknown): AmThanh {
  const o = banGhi(v);
  const modelGiong = optionalString(o.modelGiong);
  return {
    chuTrongVideo: o.chuTrongVideo === "khong" ? "khong" : "theo_noi_dung",
    giongGoc: o.giongGoc === true,
    chanNhanHieuGia: o.chanNhanHieuGia === true,
    chanNguoiThat: o.chanNguoiThat === true,
    cauTrucQuangCao: o.cauTrucQuangCao === true,
    giuSuThat: o.giuSuThat === true,
    boiCanhVietNam: o.boiCanhVietNam === true,
    giongDoc: o.giongDoc === true,
    modelGiong: MODEL_GIONG_DOC_DUOC_CHON.some((m) => m.id === modelGiong) ? modelGiong! : MODEL_GIONG_DOC_DUOC_CHON[0].id,
    giong: optionalString(o.giong)?.slice(0, 40) || "Kore",
    nhac: o.nhac === true,
    moTaNhac: optionalString(o.moTaNhac)?.slice(0, 600) ?? "",
    phuDe: o.phuDe === true,
    kieuKichBan: o.kieuKichBan === "quang_cao" || o.kieuKichBan === "ugc" || o.kieuKichBan === "phim_ngan" ? o.kieuKichBan : "tu_do",
    ...(docVeAnh(o.veAnh) ? { veAnh: docVeAnh(o.veAnh) } : {}),
  };
}

function docVeAnh(v: unknown): LuaChonVeAnh | undefined {
  const o = banGhi(v);
  const chuoi = (x: unknown) => (typeof x === "string" && /^[\w.:/-]{1,80}$/.test(x) ? x : undefined);
  const model = chuoi(o.model);
  return model ? { model, doNet: chuoi(o.doNet), chatLuong: chuoi(o.chatLuong) } : undefined;
}

/** Số ký tự lời đọc tối đa cho một cảnh: ~12 ký tự mỗi giây, chừa 1 giây thở. */
export function kyTuLoiToiDa(soGiay: number): number {
  return Math.max(20, Math.round(12 * (soGiay - 1)));
}

/**
 * Cảnh nào phải VẼ khung mở đầu: khi dự án có ít nhất một chỗ cắt, thì cảnh 1
 * và mọi cảnh cắt đều vẽ khung (cảnh 1 vẽ để làm ẢNH MẪU nhân vật cho các cảnh
 * cắt sau). Dự án liền một cú máy thì giữ cách cũ, không tốn thêm tiền ảnh.
 */
export function canVeKhung(canh: Pick<Canh, "noiTiep">[], i: number): boolean {
  const coCat = canh.some((c, j) => j > 0 && !c.noiTiep);
  return coCat && (i === 0 || !canh[i].noiTiep);
}

/** Tối đa số cảnh/đoạn: video 5 phút bằng cảnh 8 giây (Veo) cần 38 cảnh. */
export const TOI_DA_CANH = 40;

/**
 * Mỗi clip của video dài là một đoạn quay liền, không cắt.
 * Căn cứ: tiêu chí 3 (ổn định thời gian) và 4 (nhất quán giữa cảnh) của chủ dự án; chỉ áp cho mô hình
 * KHÔNG làm được nhiều cảnh trong một lần (nhà sản xuất không hỗ trợ cắt cảnh có chủ đích).
 */
export const LUAT_MOT_CU_MAY =
  "Film this as ONE continuous take from a single camera: no cuts, no edits, no transitions, " +
  "no jump to a different shot size or angle, no dissolve, cross-fade or fade — only smooth camera movement. " +
  "Stay in the same location; the background must not change. " +
  "The time of day and the lighting stay exactly the same from the first to the last frame.";
/** Clip từ cảnh 2 trở đi: nối tiếp đúng khung cuối của clip trước. Căn cứ: tiêu chí 4 (nhất quán giữa cảnh). */
export const LUAT_NOI_TIEP =
  "The provided first frame is the exact last frame of the previous clip: continue the motion from it " +
  "with no pause, keeping every person, outfit, object, background, lighting and framing identical.";
/** Mở đầu lời nhắc của đoạn NỐI DÀI — có "Extend" và "continue" như tài liệu Seedance 2.5 yêu cầu. */
export const MO_DAU_NOI_DAI =
  "Extend @Video 1: continue the story seamlessly from its last moment, keeping every person, outfit, product, " +
  "place and voice consistent.";

/** Lời nhắc gửi mô hình video cho một cảnh / một đoạn. Tách riêng để kiểm được. */
export function loiNhacCanh(p: {
  nhatQuan: string;
  moTa: string;
  loiDoc: string;
  i: number;
  cheDo: CheDoVideoDai;
  veKhung: boolean;
  nhieuCanh: boolean;
  amThanh: Pick<AmThanh, "giongGoc" | "giongDoc" | "nhac">;
}): string {
  const noiDai = p.cheDo === "noi_dai";
  const phan: string[] = [];
  if (noiDai && p.i > 0) phan.push(MO_DAU_NOI_DAI);
  phan.push(p.nhatQuan, p.moTa);
  const luat: string[] = [];
  // Mô hình làm được nhiều cảnh (hoặc nối dài) thì không ép một cú máy — nhà sản xuất làm ra để dùng.
  if (!noiDai && !p.nhieuCanh) luat.push(LUAT_MOT_CU_MAY);
  if (!noiDai && p.i > 0 && !p.veKhung) luat.push(LUAT_NOI_TIEP);
  if (!noiDai && p.veKhung) luat.push(LUAT_KHUNG_MO_DAU);
  if (p.amThanh.giongGoc && p.loiDoc) {
    // Lời dẫn tiếng Việt do chính mô hình nói (Seedance 2.5 hỗ trợ tiếng Việt gốc — tài liệu BytePlus).
    luat.push(`Audio: an off-screen narrator says in Vietnamese: "${p.loiDoc.replace(/"/g, "'")}"` + (p.amThanh.nhac ? " No background music." : ""));
  } else if (p.amThanh.giongDoc || p.amThanh.nhac) {
    luat.push(luatTiengNen(p.amThanh));
  }
  return [...phan, luat.join("\n")].filter((x) => x && x.trim()).join("\n\n");
}

/** Cảnh cắt: khung đầu đã vẽ sẵn bằng AI ảnh. Căn cứ: tiêu chí 4 (nhất quán giữa cảnh). */
export const LUAT_KHUNG_MO_DAU =
  "The provided first frame is the opening frame of this shot: animate from it, keeping the person, " +
  "outfit, product and place exactly as shown.";
/**
 * Có giọng đọc / nhạc nền làm RIÊNG thì clip không được chồng thêm thứ cùng loại.
 * Căn cứ: tiêu chí 9 (âm thanh & đồng bộ) — hai giọng/hai bản nhạc chồng nhau, khẩu hình không khớp lời đọc.
 * Chỉ cấm đúng thứ người dùng đã chọn làm riêng.
 */
export const LUAT_KHONG_NOI = "no speech, no voice-over; nobody on screen talks";
export const LUAT_KHONG_NHAC = "no music, no singing";
export function luatTiengNen(am: Pick<AmThanh, "giongDoc" | "nhac">): string {
  const cam = [am.nhac ? LUAT_KHONG_NHAC : "", am.giongDoc ? LUAT_KHONG_NOI : ""].filter(Boolean);
  return cam.length ? `Audio: natural ambient sound and sound effects; ${cam.join("; ")}.` : "";
}
/** Video dài tối đa 5 phút (yêu cầu chủ dự án: 1–5 phút). */
export const TOI_DA_GIAY_DU_AN = 300;

/** Mỗi video tự vẽ lại tối đa bấy nhiêu cảnh lỗi — để không bao giờ tự tiêu quá tay. */
export const GIOI_HAN_VE_LAI = 2;

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
    canh.push({
      soGiay,
      moTa,
      tomTat: optionalString(o.tomTat)?.slice(0, 300) ?? "",
      // Dự án cũ không có trường này: coi như nối liền (đúng cách làm trước đây).
      noiTiep: canh.length > 0 && o.noiTiep !== false,
      loiDoc: optionalString(o.loiDoc)?.slice(0, 300) ?? "",
    });
  }
  return canh;
}

/** Từ chỉ giờ trong ngày / thay đổi theo thời gian. */
const TU_CHI_GIO =
  /\b(night|nights|nighttime|morning|mornings|evening|dawn|sunrise|sunset|dusk|daytime|midnight|afternoon|noon|later|next day)\b/i;

/**
 * Bỏ khỏi MÔ TẢ CHUNG những câu nói về giờ trong ngày.
 *
 * Mô tả chung gắn vào MỌI cảnh. Đã đo 02/10/2026 (dự án #8, Veo 3.1 Lite): mô tả
 * chung có "đêm thì đèn ấm, sáng hôm sau nắng vàng" → cảnh nào cũng trôi dần từ
 * đêm sang ngày (độ sáng tăng tới +65/255), có cảnh tự mờ chồng sang ban ngày.
 * Đã dặn AI đạo diễn đừng viết vậy mà lần sau nó vẫn viết — nên lọc bằng code.
 * Giờ và ánh sáng của từng cảnh nằm trong mô tả của chính cảnh đó.
 */
export function boCauChiGio(nhatQuan: string): string {
  return nhatQuan
    .split(/(?<=[.!?])\s+/)
    .filter((cau) => !TU_CHI_GIO.test(cau))
    .join(" ")
    .trim();
}

export async function chiaCanh(p: {
  userId: number;
  yTuong: string;
  tongGiay: number;
  model: ModelVideo;
  coAnhThamChieu: boolean;
  /** Phân tích một video trend, nếu làm theo trend. */
  congThucTrend?: string;
  cheDo?: CheDoVideoDai;
  chuTrongVideo?: ChuTrongVideo;
  /** Lựa chọn của người dùng (không gài cứng): hướng kịch bản, luật nội dung, có giọng đọc AI riêng không. */
  huong?: HuongKichBan;
  luat?: LuatNoiDung;
  giongDocRieng?: boolean;
  kieu?: KieuKichBan;
}): Promise<{ nhatQuan: string; canh: Canh[]; moTaNhac: string }> {
  const huong = p.huong ?? {};
  const toiDaMoiCanh = p.model.soGiay[p.model.soGiay.length - 1];
  const soCanh = Math.max(1, Math.min(TOI_DA_CANH, Math.ceil(p.tongGiay / toiDaMoiCanh)));
  const noiDai = p.cheDo === "noi_dai";
  const nhieuCanh = MODEL_NHIEU_CANH.has(p.model.id);
  const kq = await chatJson({
    task: "content",
    viec: "chia_canh",
    userId: p.userId,
    temperature: 0.7,
    /*
     * Trần theo số cảnh: mỗi cảnh có mô tả hình + lời đọc + tóm tắt. Đã đo
     * 02/10/2026: trần cố định 2.500 token không đủ cho 8 cảnh có lời đọc —
     * câu trả lời bị cắt rỗng.
     */
    maxTokens: Math.min(16_000, 2_000 + 900 * soCanh),
    validate: (v) => asRecord(v),
    messages: [
      {
        role: "system",
        content: [
          "You are a video director turning a sales idea into a multi-shot AI video for Facebook.",
          'Return JSON: {"nhatQuan": string, "moTaNhac": string, "canh": [{"soGiay": number, "noiTiep": boolean, "moTa": string, "loiDoc": string, "tomTat": string}]}.',
          "- nhatQuan (English): ONE consistency bible reused verbatim in every shot: each character's",
          "  face, age, ethnicity, hair, outfit; the product's exact look; every location used and exactly what",
          "  is behind the characters; color grade; camera style. ONLY what never changes: never describe changes",
          "  over time in nhatQuan (no 'at night ... in the morning'); each shot's time of day and lighting go in",
          "  that shot's moTa.",
          ...(noiDai
            ? [
                // Nối dài gốc của hãng: mỗi "canh" là một ĐOẠN; đoạn sau được mô hình làm TIẾP đoạn trước.
                `- canh: about ${soCanh} SEGMENTS, total about ${p.tongGiay} seconds. Allowed segment lengths: ${p.model.soGiay.join(", ")} seconds.`,
                "- Each segment after the first is generated by EXTENDING the previous segment (the video model continues",
                "  the story from its last moment). Set noiTiep=true for every segment after the first.",
                "- Each moTa (English): what happens in that segment, in order. A segment MAY contain several shots/cuts",
                "  (the model supports multi-shot storytelling) — describe each shot briefly with its camera framing.",
              ]
            : [
                `- canh: about ${soCanh} shots, total about ${p.tongGiay} seconds. Allowed shot lengths: ${p.model.soGiay.join(", ")} seconds.`,
                "- Shots form SEQUENCES. noiTiep=true: the shot continues the previous shot as ONE unbroken take and",
                "  must START exactly where the previous shot ended (same place, same pose, same framing).",
                "  noiTiep=false: a deliberate cut to a new shot (new angle, place or moment) — only when the story",
                "  moves to a new beat. Shot 1 is always noiTiep=false.",
                // Hướng dẫn viết lời nhắc của Google Veo: nêu chủ thể, hành động, bối cảnh, góc máy, chuyển động máy, ánh sáng.
                "- Each moTa (English): the time of day and lighting of that shot, what happens, the framing and the camera",
                "  movement (static, push in, pan, track…).",
                nhieuCanh
                  ? "  This model supports several shots inside one clip: a moTa MAY contain cuts if the story needs them."
                  : "  Never a cut, jump or new angle INSIDE a shot.",
              ]),
          "- loiDoc (Vietnamese, natural spoken style, correct spelling with full diacritics): the narrator's",
          "  voice-over line for that shot; it is also shown as the subtitle. At most 12 characters per second of",
          "  the shot minus one second (an 8-second shot: at most 84 characters). The picture must match the line.",
          // Tiêu chí 9 (khẩu hình khớp lời): giọng đọc AI làm RIÊNG thì người trên hình không được nói.
          p.giongDocRieng ? "  Nobody on screen speaks — the narrator is off-screen." : "",
          "  Empty string if the shot needs no line.",
          // Các hướng dưới đây là LỰA CHỌN của người dùng — không gài cứng (chủ dự án 03/10/2026).
          huong.cauTrucQuangCao
            ? "- Advert structure: shot 1 is the hook (grabs attention in its first 2 seconds), then the problem, the solution, the benefits, and the LAST shot's loiDoc is the call to action."
            : "",
          huong.giuSuThat ? "- Only claim what the idea states — never invent prices, numbers, discounts, awards or features." : "",
          p.kieu === "ugc" || p.kieu === "phim_ngan" ? KIEU_KICH_BAN[p.kieu] : "",
          huong.boiCanhVietNam ? "- Vietnamese everyday context when people or places appear." : "",
          "- moTaNhac (English): one line describing instrumental background music that fits (genre, mood, tempo).",
          "- tomTat: one short Vietnamese sentence per shot for the shop owner.",
          p.coAnhThamChieu
            ? "- Reference photos of the real characters/product will be provided to the video model: describe them generically."
            : p.chuTrongVideo === "khong"
              ? "- Keep product packaging plain and unbranded."
              : "- Show the product packaging as the idea describes it.",
          p.luat?.chanNhanHieuGia ? "- Do not invent brands, labels, certification badges or awards." : "",
          p.chuTrongVideo === "khong"
            ? "- Never ask for on-screen text, captions, logos or brand names. No markdown."
            : "- On-screen text only if the idea asks for it: write the exact words in quotes inside moTa. No markdown.",
          ...(p.congThucTrend
            ? ["- Follow this trending video's FORMULA (structure, hook, pacing, shot types, mood) and create new content for this product:", p.congThucTrend]
            : []),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { role: "user", content: `Idea / script (Vietnamese):\n"""${p.yTuong.slice(0, 4_000)}"""` },
    ],
  });
  const nhatQuan = boCauChiGio(optionalString(kq.output.nhatQuan)?.slice(0, 2_000) ?? "");
  const canh = chuanHoaCanh(p.model, kq.output.canh);
  if (!canh.length) throw new AppError("AI chưa chia được cảnh, thử lại hoặc viết ý tưởng rõ hơn.", 502);
  return { nhatQuan, canh, moTaNhac: optionalString(kq.output.moTaNhac)?.slice(0, 600) ?? "" };
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
  am_thanh: unknown;
  nhac_url: string | null;
  chi_phi_them: string;
  tu_kiem: boolean;
  so_lan_ve_lai: number;
  anh_nhan_vat: string | null;
  che_do: CheDoVideoDai;
}

export const COT_DU_AN =
  "id, loai, y_tuong, anh_tham_chieu, nhat_quan, phan_canh, model, do_net, khung, co_tieng, trang_thai, gia_uoc_tinh, gia_thuc, url, loi, created_at, am_thanh, nhac_url, chi_phi_them, tu_kiem, so_lan_ve_lai, anh_nhan_vat, che_do";

/**
 * Giá ước tính cả dự án: tiền video từng cảnh (cảnh 1 từ chữ, có thể kèm ảnh tham
 * chiếu; cảnh sau từ khung mở đầu) + khung vẽ cho cảnh cắt + giọng đọc + nhạc nền.
 */
export function giaDuAn(
  model: ModelVideo,
  canh: (Pick<Canh, "soGiay" | "noiTiep" | "loiDoc"> & Partial<Canh>)[],
  lc: Omit<LuaChonVideo, "soGiay" | "coAnhMoDau">,
  soThamChieu = 0,
  amThanh?: AmThanh,
  cheDo: CheDoVideoDai = "ghep_canh",
  tuKiem = false,
  /** Giá một khung mở đầu của mô hình vẽ ảnh đã chọn (giaKhungVideo). */
  giaKhung = GIA_KHUNG_UOC_TINH
): number | null {
  let tong = 0;
  const noiDai = cheDo === "noi_dai";
  // Kiểm định chỉ chạy với clip một cú máy (máy chủ bỏ qua nối dài và mô hình nhiều cảnh).
  const kiemDinh = tuKiem && !noiDai && !MODEL_NHIEU_CANH.has(model.id);
  for (const [i, c] of canh.entries()) {
    // Nối dài: đoạn sau đưa đoạn trước vào làm video tham chiếu (giá riêng), không vẽ khung.
    const veKhung = !noiDai && canVeKhung(canh, i);
    const g = noiDai && i > 0
      ? giaVideo(model, { ...lc, soGiay: c.soGiay, coAnhMoDau: false, coVideoVao: true, giayVideoVao: canh[i - 1].soGiay })
      : giaVideo(model, { ...lc, soGiay: c.soGiay, coAnhMoDau: i > 0 || veKhung }, i === 0 && !veKhung ? soThamChieu : 0);
    if (g === null) return null;
    tong += g + (veKhung ? giaKhung : 0);
    if (amThanh?.giongDoc && c.loiDoc) {
      tong += uocTinhTienGiong(amThanh.modelGiong, c.loiDoc.length, c.loiDoc.length / 12) + PHI_NGHE_LAI_MOI_CAU;
    }
    if (kiemDinh) tong += PHI_KIEM_DINH_MOI_CANH;
  }
  if (amThanh?.nhac) tong += MODEL_NHAC_NEN.giaMoiBai;
  // Có cảnh cắt thì vẽ thêm một ảnh mẫu nhân vật nền trơn (chế độ nối dài không vẽ khung).
  if (!noiDai && canh.some((_, i) => canVeKhung(canh, i))) tong += giaKhung;
  return Math.round(tong * 1_000_000) / 1_000_000;
}

/**
 * Chi phí các bước AI phụ của một video dài — số đo thật trong sổ chi tiêu (ai_usage, 28/09–03/10/2026):
 * AI chia cảnh 0,03–0,06 USD/lần (tăng theo số cảnh); AI kiểm định ~0,005–0,007 USD/cảnh;
 * nghe lại giọng đọc ~0,0005 USD/câu.
 */
export const PHI_CHIA_CANH = { coDinh: 0.01, moiCanh: 0.005 };
export const PHI_KIEM_DINH_MOI_CANH = 0.007;
export const PHI_NGHE_LAI_MOI_CAU = 0.0005;

/** Phân cảnh giả định trước khi AI chia: cùng cách tính số cảnh và độ dài như chiaCanh + chuanHoaCanh. */
export function phanCanhGiaDinh(model: ModelVideo, tongGiay: number): number[] {
  const tong = Math.min(TOI_DA_GIAY_DU_AN, Math.max(4, Math.round(tongGiay) || 15));
  const toiDa = model.soGiay[model.soGiay.length - 1];
  const soCanh = Math.max(1, Math.min(TOI_DA_CANH, Math.ceil(tong / toiDa)));
  // Chia phần còn lại cho số cảnh còn lại để tổng sát với độ dài người dùng chọn (10 giây → 4 + 6, không phải 4 + 4).
  const ds: number[] = [];
  for (let i = 0, con = tong; i < soCanh; i++) {
    const muon = con / (soCanh - i);
    // Gần nhất; hai mức cách đều thì lấy mức dài hơn (không thì 60 giây ra 8, 8, 8, 8, 6, 8, 6, 8).
    const g = model.soGiay.reduce((tot, x) => (Math.abs(x - muon) <= Math.abs(tot - muon) ? x : tot), model.soGiay[0]);
    ds.push(g);
    con -= g;
  }
  return ds;
}

/**
 * Báo giá TRỌN video dài ngay khi người dùng chọn xong (chưa gọi AI nào): video từng đoạn đúng kiểu tính tiền
 * của hãng (nối dài tính giá "có video đầu vào"), giọng đọc + nghe lại, nhạc, AI chia cảnh, AI kiểm định.
 *   - uocTinh: dự án liền mạch, không cảnh nào phải vẽ lại.
 *   - toiDa: mọi cảnh đều là cảnh cắt (vẽ khung), kiểm định bắt vẽ lại đủ GIOI_HAN_VE_LAI cảnh, giọng đọc lại đủ số lần.
 */
export function baoGiaVideoDai(
  model: ModelVideo,
  lc: Omit<LuaChonVideo, "soGiay" | "coAnhMoDau">,
  p: { tongGiay: number; cheDo: CheDoVideoDai; amThanh: AmThanh; soThamChieu?: number; tuKiem: boolean; giaKhung?: number }
): { uocTinh: number; toiDa: number } | null {
  const doDai = phanCanhGiaDinh(model, p.tongGiay);
  const noiDai = p.cheDo === "noi_dai";
  const canh = (cat: boolean) =>
    doDai.map((soGiay, i) => ({
      soGiay,
      noiTiep: i > 0 && !cat,
      loiDoc: p.amThanh.giongDoc ? "x".repeat(kyTuLoiToiDa(soGiay)) : "",
    }));
  const lien = giaDuAn(model, canh(false), lc, p.soThamChieu ?? 0, p.amThanh, p.cheDo, p.tuKiem, p.giaKhung);
  const catHet = giaDuAn(model, canh(!noiDai), lc, p.soThamChieu ?? 0, p.amThanh, p.cheDo, p.tuKiem, p.giaKhung);
  if (lien === null || catHet === null) return null;
  const n = doDai.length;
  // Kiểm định chỉ chạy với clip một cú máy (máy chủ bỏ qua nối dài và mô hình nhiều cảnh).
  const kiemDinh = p.tuKiem && !noiDai && !MODEL_NHIEU_CANH.has(model.id);
  const giong = p.amThanh.giongDoc;
  const phu = PHI_CHIA_CANH.coDinh + PHI_CHIA_CANH.moiCanh * n;
  const clipDatNhat = Math.max(...doDai.map((soGiay) => giaVideo(model, { ...lc, soGiay, coAnhMoDau: true }) ?? 0));
  const veLai = kiemDinh ? GIOI_HAN_VE_LAI * (clipDatNhat + PHI_KIEM_DINH_MOI_CANH) : 0;
  const docLai = giong
    ? SO_LAN_DOC_LAI * doDai.reduce((t, soGiay) => {
        const kt = kyTuLoiToiDa(soGiay);
        return t + uocTinhTienGiong(p.amThanh.modelGiong, kt, kt / 12) + PHI_NGHE_LAI_MOI_CAU;
      }, 0)
    : 0;
  const lam = (x: number) => Math.round(x * 10_000) / 10_000;
  return { uocTinh: lam(lien + phu), toiDa: lam(catHet + phu + veLai + docLai) };
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
  amThanh?: unknown;
  /** Tự kiểm định và vẽ lại cảnh lỗi (mặc định bật). */
  tuKiem?: boolean;
  cheDo?: CheDoVideoDai;
}): Promise<DuAnVideo> {
  const yTuong = p.yTuong.trim();
  if (!yTuong) throw new AppError("Cần ý tưởng hoặc kịch bản cho video.", 400);
  const tongGiay = Math.min(TOI_DA_GIAY_DU_AN, Math.max(4, Math.round(p.tongGiay) || 15));
  const anh = p.anhThamChieu.slice(0, 4).map((u) => diaChiKhoHopLe(u, "Ảnh tham chiếu"));
  if (p.loai === "tham_chieu" && !anh.length) throw new AppError("Cần ít nhất một ảnh tham chiếu.", 400);

  const model = await layModelNoiCanh(p.model, p.lc);
  const cheDo: CheDoVideoDai = p.cheDo === "noi_dai" ? "noi_dai" : "ghep_canh";
  if (cheDo === "noi_dai" && !MODEL_NOI_DAI[model.id]) {
    throw new AppError("Mô hình này không có tính năng nối dài của hãng. Chọn Seedance 2.5, hoặc chọn cách ghép nhiều cảnh.", 400);
  }
  const amVao = docAmThanh(p.amThanh);
  if (amVao.giongGoc && !MODEL_TIENG_VIET_GOC.has(model.id)) {
    throw new AppError("Mô hình này không nói tiếng Việt gốc. Chọn giọng đọc AI riêng, hoặc chọn Seedance 2.5.", 400);
  }
  const { nhatQuan, canh, moTaNhac } = await chiaCanh({
    userId: p.userId, yTuong, tongGiay, model, coAnhThamChieu: anh.length > 0, congThucTrend: p.congThucTrend,
    cheDo, chuTrongVideo: amVao.chuTrongVideo,
    // Kiểu "Quảng cáo bán hàng" chính là cấu trúc quảng cáo (móc câu → vấn đề → giải pháp → lợi ích → kêu gọi).
    huong: {
      cauTrucQuangCao: amVao.cauTrucQuangCao || amVao.kieuKichBan === "quang_cao",
      giuSuThat: amVao.giuSuThat,
      boiCanhVietNam: amVao.boiCanhVietNam,
    },
    kieu: amVao.kieuKichBan,
    luat: { chanNhanHieuGia: amVao.chanNhanHieuGia, chanNguoiThat: amVao.chanNguoiThat },
    giongDocRieng: amVao.giongDoc && !amVao.giongGoc,
  });
  const amThanh = { ...amVao, moTaNhac };
  const row = await queryOne<DuAnVideo>(
    `INSERT INTO du_an_video
       (user_id, trang_id, loai, y_tuong, anh_tham_chieu, nhat_quan, phan_canh, model, do_net, khung, co_tieng, gia_uoc_tinh, am_thanh, tu_kiem, che_do)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
     RETURNING ${COT_DU_AN}`,
    [p.userId, p.trangId, p.loai, yTuong, JSON.stringify(anh), nhatQuan, JSON.stringify(canh),
      model.id, p.lc.doNet, p.lc.khung, p.lc.coTieng, giaDuAn(model, canh, p.lc, anh.length, amThanh, cheDo, p.tuKiem !== false, await giaKhungVideo(amThanh.veAnh)), JSON.stringify(amThanh), p.tuKiem !== false, cheDo]
  );
  return row!;
}

/** Chủ shop sửa phân cảnh trước khi tạo. Chỉ sửa được khi còn là nháp. */
export async function suaDuAn(p: {
  trangId: number;
  id: number;
  nhatQuan: string;
  phanCanh: unknown;
  /** Bỏ trống thì giữ lựa chọn âm thanh cũ. */
  amThanh?: unknown;
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
  const amCu = docAmThanh(cu.am_thanh);
  const amThanh = p.amThanh === undefined ? amCu : { ...docAmThanh(p.amThanh), moTaNhac: optionalString(banGhi(p.amThanh).moTaNhac) ?? amCu.moTaNhac };
  const row = await queryOne<DuAnVideo>(
    `UPDATE du_an_video SET nhat_quan = $3, phan_canh = $4::jsonb, gia_uoc_tinh = $5, am_thanh = $6::jsonb, updated_at = now()
      WHERE id = $1 AND trang_id = $2 RETURNING ${COT_DU_AN}`,
    [p.id, p.trangId, p.nhatQuan.slice(0, 2_000), JSON.stringify(canh),
      giaDuAn(model, canh, lc, cu.anh_tham_chieu.length, amThanh, cu.che_do, cu.tu_kiem, await giaKhungVideo(amThanh.veAnh)), JSON.stringify(amThanh)]
  );
  return row!;
}

export async function batDauDuAn(trangId: number, id: number): Promise<DuAnVideo> {
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
  const canhDaTao = await query<{
    id: number; thu_tu: number; trang_thai: string; url: string | null; loi: string | null; gia_thuc: string | null;
    anh_mo_dau: string | null; kiem_dinh: string | null;
  }>(
    // Cảnh đã bị loại (bo_qua) không còn là một phần của video.
    "SELECT id, thu_tu, trang_thai, url, loi, gia_thuc, anh_mo_dau, kiem_dinh FROM video_ai WHERE du_an_id = $1 AND NOT bo_qua ORDER BY thu_tu",
    [d.id]
  );
  const ds = canhDaTao.rows;
  const hong = ds.find((c) => c.trang_thai === "loi");
  if (hong) {
    await ketThucDuAn(d.id, `Cảnh ${hong.thu_tu + 1} lỗi: ${hong.loi ?? "không rõ"}`);
    return;
  }
  if (ds.some((c) => c.trang_thai === "dang_tao")) return;

  /*
   * Kiểm định cảnh vừa vẽ xong TRƯỚC khi vẽ cảnh sau (cảnh sau nối từ khung cuối của nó,
   * và phát hiện sớm thì chỉ phải vẽ lại đúng một cảnh — xem kiem-dinh-video.ts).
   */
  // Cảnh vừa vẽ xong = dòng mới nhất (không phải cảnh có số thứ tự cuối — có thể đang vẽ lại cảnh giữa).
  const vuaXong = ds.reduce<(typeof ds)[number] | undefined>((m, c) => (!m || c.id > m.id ? c : m), undefined);
  /*
   * Bộ kiểm định bắt "tự cắt cảnh / đổi ánh sáng giữa clip" — chỉ đúng với clip MỘT cú máy.
   * Nối dài và mô hình nhiều cảnh được phép cắt theo kịch bản (nhà sản xuất làm ra để dùng),
   * nên không áp — ghi rõ lý do thay vì đánh lỗi nhầm.
   */
  if (vuaXong && vuaXong.trang_thai === "xong" && vuaXong.kiem_dinh === null && (d.che_do === "noi_dai" || MODEL_NHIEU_CANH.has(d.model))) {
    await query("UPDATE video_ai SET kiem_dinh = 'khong_ap_dung: nhiều cảnh theo kịch bản' WHERE id = $1", [vuaXong.id]);
    return;
  }
  if (d.tu_kiem && vuaXong && vuaXong.trang_thai === "xong" && vuaXong.kiem_dinh === null && vuaXong.url) {
    const cv = d.phan_canh[vuaXong.thu_tu];
    let kq: Awaited<ReturnType<typeof kiemDinhCanh>>;
    try {
      kq = await kiemDinhCanh({ userId: d.user_id, url: vuaXong.url, moTa: cv.moTa, soGiay: cv.soGiay });
    } catch (error) {
      if (error instanceof TaiKhoanKhoaError) throw error;
      // Không kiểm được (AI lỗi, mạng...) thì cho qua và ghi lại — không vì bước kiểm mà hỏng cả dự án.
      const loi = error instanceof Error ? error.message : String(error);
      await query("UPDATE video_ai SET kiem_dinh = $2 WHERE id = $1", [vuaXong.id, `khong_kiem_duoc: ${loi}`.slice(0, 300)]);
      return;
    }
    await congChiPhiThem(d.id, kq.tien);
    if (kq.dat) {
      await query("UPDATE video_ai SET kiem_dinh = 'dat' WHERE id = $1", [vuaXong.id]);
      return;
    }
    if (d.so_lan_ve_lai < GIOI_HAN_VE_LAI) {
      // Loại cảnh lỗi; tiền đã trả chuyển vào chi_phi_them để "đã tốn" vẫn đủ. Lượt sau vẽ lại đúng cảnh này.
      await query("UPDATE video_ai SET bo_qua = true, kiem_dinh = $2 WHERE id = $1", [vuaXong.id, `loi: ${kq.lyDo ?? ""}`.slice(0, 300)]);
      await query(
        // Quay về 'dang_tao' kể cả khi đang chờ ghép (làm tiếp sau lỗi) — thiếu cảnh thì không được ghép.
        `UPDATE du_an_video SET so_lan_ve_lai = so_lan_ve_lai + 1, chi_phi_them = chi_phi_them + $2,
                trang_thai = 'dang_tao', updated_at = now() WHERE id = $1`,
        [d.id, Number(vuaXong.gia_thuc) || 0]
      );
      return;
    }
    await query("UPDATE video_ai SET kiem_dinh = $2 WHERE id = $1", [
      vuaXong.id,
      `loi: ${kq.lyDo ?? ""} (đã hết ${GIOI_HAN_VE_LAI} lượt vẽ lại, giữ cảnh này)`.slice(0, 300),
    ]);
    return;
  }

  if (d.trang_thai === "dang_tao" && ds.length < d.phan_canh.length) {
    /*
     * Cảnh còn thiếu có số thứ tự NHỎ NHẤT — không phải ds.length: khi vẽ lại một cảnh giữa
     * (cảnh lỗi bị loại), các cảnh sau nó vẫn còn, nên ds.length trỏ nhầm vào cảnh đã có.
     */
    const daCo = new Set(ds.map((x) => x.thu_tu));
    let i = 0;
    while (daCo.has(i)) i++;
    const c = d.phan_canh[i];
    const amThanh = docAmThanh(d.am_thanh);
    const noiDai = d.che_do === "noi_dai";
    const veKhung = !noiDai && canVeKhung(d.phan_canh, i);
    const model = (await layDanhSachModel()).find((m) => m.id === d.model);
    if (!model) {
      await ketThucDuAn(d.id, "Model video đã ngừng giữa chừng.");
      return;
    }
    /*
     * Khung mở đầu của cảnh:
     *   - nối liền: khung cuối THẬT của cảnh trước;
     *   - cắt sang cảnh mới: vẽ bằng AI ảnh, lấy nhân vật ở khung cảnh 1 (và ảnh
     *     tham chiếu của chủ shop) làm mẫu để giữ đúng người;
     *   - cảnh 1 của dự án liền một cú máy: không khung, dùng ảnh tham chiếu như cũ.
     */
    let anhMoDau: string | undefined;
    if (veKhung) {
      /*
       * Ảnh MẪU nhân vật trên nền trơn (vẽ một lần mỗi dự án), KHÔNG dùng khung cảnh 1 làm mẫu:
       * đã thấy ở dự án #9 — AI ảnh chép luôn phòng, đèn đêm, góc máy của khung cảnh 1, nên mọi
       * cảnh cắt ra y hệt nhau và cảnh "buổi sáng" vẫn là ban đêm.
       */
      let anhNhanVat = d.anh_nhan_vat;
      if (!anhNhanVat) {
        const mau = await taoAnhNhanVat({
          userId: d.user_id,
          nhatQuan: d.nhat_quan,
          khung: d.khung,
          doNet: d.do_net,
          anhThamChieu: d.anh_tham_chieu,
          ten: `nhan-vat-${d.id}.jpg`,
          luat: amThanh,
          veAnh: amThanh.veAnh,
        });
        anhNhanVat = mau.url;
        await query("UPDATE du_an_video SET anh_nhan_vat = $2 WHERE id = $1", [d.id, anhNhanVat]);
        await congChiPhiThem(d.id, mau.tien);
      }
      const khung = await taoKhungVideo({
        userId: d.user_id,
        nhatQuan: d.nhat_quan,
        moTa: c.moTa,
        khung: d.khung,
        doNet: d.do_net,
        anhMau: [anhNhanVat, ...d.anh_tham_chieu],
        ten: `khung-dau-${d.id}-${i}.jpg`,
        chu: amThanh.chuTrongVideo,
        luat: amThanh,
        veAnh: amThanh.veAnh,
      });
      anhMoDau = khung.url;
      await congChiPhiThem(d.id, khung.tien);
    } else if (i > 0 && !noiDai) {
      const truoc = ds.find((x) => x.thu_tu === i - 1);
      if (!truoc?.url) throw new AppError(`Thiếu cảnh ${i} để nối cảnh ${i + 1}.`, 500);
      anhMoDau = await layKhungCuoi(truoc.url, `khung-cuoi-${d.id}-${i}.jpg`);
    }
    // Nối dài gốc của hãng: đưa NGUYÊN đoạn trước làm video tham chiếu.
    let videoNoiDai: string | undefined;
    if (noiDai && i > 0) {
      const truoc = ds.find((x) => x.thu_tu === i - 1);
      if (!truoc?.url) throw new AppError(`Thiếu đoạn ${i} để nối dài đoạn ${i + 1}.`, 500);
      videoNoiDai = truoc.url;
    }
    const lc = {
      soGiay: c.soGiay, doNet: d.do_net, khung: d.khung, coTieng: d.co_tieng, coAnhMoDau: Boolean(anhMoDau),
      chuTrongVideo: amThanh.chuTrongVideo,
      chanNhanHieuGia: amThanh.chanNhanHieuGia,
      chanNguoiThat: amThanh.chanNguoiThat,
      giayVideoVao: videoNoiDai ? d.phan_canh[i - 1].soGiay : undefined,
    };
    // Cảnh sau nối từ khung cuối nên tự đúng khung; chỉ cảnh đầu cần cắt ảnh tham chiếu.
    const anhThamChieuCanhDau =
      i === 0 && !anhMoDau
        ? await Promise.all(
            d.anh_tham_chieu.map((u, k) => anhTheoKhung(u, d.khung, d.do_net, `tham-chieu-${d.id}-${k}.jpg`))
          )
        : [];
    /*
     * KHÔNG ghi "Shot 2 of 3": đã đo 02/10/2026 (H3 Max, dự án #6) — mô hình hiểu
     * là phim nhiều cảnh và tự CẮT CẢNH giữa clip (toàn thân → nửa người, đứng →
     * ngồi). Mỗi clip phải là một đoạn quay liền của cùng một cú máy.
     */
    const loiMoTa = loiNhacCanh({
      nhatQuan: d.nhat_quan, moTa: c.moTa, loiDoc: c.loiDoc, i, cheDo: d.che_do, veKhung,
      nhieuCanh: MODEL_NHIEU_CANH.has(d.model), amThanh,
    });
    await guiViecVideo({
      userId: d.user_id,
      trangId: d.trang_id,
      model,
      loiMoTa,
      lc,
      anhMoDau,
      anhThamChieu: anhThamChieuCanhDau,
      videoNoiDai,
      duAnId: d.id,
      thuTu: i,
    });
    return;
  }

  // Mọi cảnh đã xong: làm giọng đọc + nhạc nền (nếu chọn) rồi ghép.
  await query("UPDATE du_an_video SET trang_thai = 'dang_ghep', updated_at = now() WHERE id = $1", [d.id]);
  const amThanh = docAmThanh(d.am_thanh);
  const tongGiay = d.phan_canh.reduce((t, c) => t + c.soGiay, 0);
  let nhacUrl = d.nhac_url;
  if (amThanh.nhac && !nhacUrl) {
    const nhac = await taoNhacNen({
      userId: d.user_id,
      moTa: amThanh.moTaNhac || d.nhat_quan.slice(0, 300),
      soGiay: tongGiay + 4,
      coLoiDoc: amThanh.giongDoc || amThanh.giongGoc,
    });
    await congChiPhiThem(d.id, nhac.tien);
    nhacUrl = await luuAmThanh(nhac.am, nhac.duoi, `nhac-${d.id}`);
    // Giữ lại: ghép hỏng phải làm lại thì không trả tiền nhạc lần nữa.
    await query("UPDATE du_an_video SET nhac_url = $2 WHERE id = $1", [d.id, nhacUrl]);
  }
  const giong = amThanh.giongDoc && !amThanh.giongGoc
    ? await Promise.all(d.phan_canh.map((c) => (c.loiDoc ? giongVuaCanh(d.user_id, d.id, amThanh, c) : Promise.resolve(null))))
    : [];
  const url = await ghepVideo(ds.map((c) => c.url!), d.co_tieng, `video-dai-${d.user_id}-${d.id}.mp4`, {
    giong,
    nhacUrl: nhacUrl ?? undefined,
    phuDe: amThanh.phuDe ? d.phan_canh.map((c) => c.loiDoc || null) : undefined,
    // Chỉ cảnh NỐI TỪ KHUNG CUỐI cảnh trước mới trùng khung đầu → bỏ; đoạn nối dài và cảnh cắt thì giữ.
    boKhungDau: d.phan_canh.map((c, i) => i > 0 && d.che_do !== "noi_dai" && c.noiTiep && !canVeKhung(d.phan_canh, i)),
  });
  const daCong = await queryOne<{ them: string }>("SELECT chi_phi_them AS them FROM du_an_video WHERE id = $1", [d.id]);
  const tong = ds.reduce((t, c) => t + (Number(c.gia_thuc) || 0), 0) + (Number(daCong?.them) || 0);
  await query(
    `UPDATE du_an_video SET trang_thai = 'xong', url = $2, gia_thuc = $3, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [d.id, url, tong]
  );
}

/** Chữ cái + số, viết thường, bỏ dấu cách và dấu câu (giữ dấu tiếng Việt). */
function chiChuCai(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Độ giống nhau 0..1 giữa hai chuỗi (khoảng cách sửa Levenshtein). */
export function doGiong(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  let truoc = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nay = [i];
    for (let j = 1; j <= b.length; j++) {
      nay[j] = Math.min(truoc[j] + 1, nay[j - 1] + 1, truoc[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    truoc = nay;
  }
  return 1 - truoc[b.length] / Math.max(a.length, b.length);
}

/** Dưới mức này là giọng đọc sai. Chọn từ câu thật — xem phép kiểm "giọng đọc". */
export const NGUONG_GIONG_DOC = 0.85;

/**
 * Giọng đọc có đọc đúng lời không: so chữ máy nghe ra với lời đọc, từng chữ cái
 * (bỏ dấu cách, dấu câu — máy nghe ghi "BrewManager" thành "Brew Manager").
 * Đã gặp 02/10/2026: (1) đọc to cả lời dặn tiếng Anh → dài gấp 3 lần;
 * (2) đọc "AI ngay" thành "AI now", "tư vấn và" thành "ghi mắc thông tin" — độ dài
 * gần bằng nên so độ dài KHÔNG bắt được, phải so từng chữ.
 */
export function giongDocSai(loiDoc: string, ngheRa: string): string | null {
  const goc = chiChuCai(loiDoc.replace(/(\d+)\s*giờ/giu, "$1"));
  const nghe = chiChuCai(ngheRa.replace(/(\d+):00/g, "$1"));
  if (!goc) return null;
  // Một phép so đủ cho cả đọc thừa (đọc cả lời dặn: giống 15%), đọc thiếu, đọc sai chữ.
  const giong = doGiong(goc, nghe);
  if (giong < NGUONG_GIONG_DOC) return `đọc sai chữ (giống lời ${Math.round(giong * 100)}%)`;
  return null;
}

/**
 * Giọng đọc một cảnh. Đọc xong thì MÁY NGHE LẠI (vài chục đồng): đọc thừa/thiếu
 * thì đọc lại một lần. Dài hơn cảnh thì để bước ghép tăng tốc (tối đa 25%) —
 * không đọc lại kèm lời dặn "đọc nhanh hơn" nữa (chính lời dặn đó bị đọc to lên).
 */
async function giongVuaCanh(userId: number, duAnId: number, am: AmThanh, c: Canh): Promise<Buffer> {
  const doc = async () => {
    const b = await docThanhGiong({ userId, loiDoc: c.loiDoc, model: am.modelGiong, giong: am.giong });
    await congChiPhiThem(duAnId, uocTinhTienGiong(am.modelGiong, c.loiDoc.length, (b.length - 44) / (PCM_TAN_SO * 2)));
    return b;
  };
  /** Điểm giống lời 0..1 (1 = đúng hoàn toàn); không nghe lại được thì coi như đúng — không vì thế mà hỏng video. */
  const diem = async (b: Buffer): Promise<number> => {
    try {
      const nghe = await ngheThanhChu({ userId, am: b, dinhDang: "wav" });
      return giongDocSai(c.loiDoc, nghe) ? doGiong(chiChuCai(c.loiDoc), chiChuCai(nghe)) : 1;
    } catch (error) {
      if (error instanceof TaiKhoanKhoaError) throw error;
      return 1;
    }
  };
  // Đọc lại tối đa 2 lần (mỗi lần vài chục đồng); vẫn sai thì giữ bản giống lời nhất.
  let tot = { b: await doc(), d: 0 };
  tot.d = await diem(tot.b);
  for (let lan = 0; lan < SO_LAN_DOC_LAI && tot.d < 1; lan++) {
    const b = await doc();
    const d = await diem(b);
    if (d > tot.d) tot = { b, d };
  }
  return tot.b;
}

/** Giọng đọc sai thì đọc lại tối đa bấy nhiêu lần. */
export const SO_LAN_DOC_LAI = 2;

/** Cộng tiền ngoài video (khung, giọng, nhạc) vào dự án — để "đã tốn" hiện đủ. */
async function congChiPhiThem(id: number, tien: number): Promise<void> {
  if (!Number.isFinite(tien) || tien <= 0) return;
  await query("UPDATE du_an_video SET chi_phi_them = chi_phi_them + $2 WHERE id = $1", [id, tien]);
}

/**
 * Lưu một tệp âm thanh lên kho. Kho CHỈ nhận ảnh, MP4, MOV, PDF — đã gặp
 * 02/10/2026: gửi mp3 bị từ chối ở bước cuối, sau khi đã trả tiền 8 cảnh video
 * và bài nhạc. Nên đóng tiếng vào vỏ MP4 (chỉ có tiếng, AAC) rồi mới gửi.
 */
async function luuAmThanh(am: Buffer, duoi: string, ten: string): Promise<string> {
  return voiThuMucTam(async (thuMuc) => {
    const vao = path.join(thuMuc, `vao.${duoi}`);
    const ra = path.join(thuMuc, `${ten}.mp4`);
    await fs.writeFile(vao, am);
    await chayFfmpeg(["-i", vao, "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", ra], 120_000);
    return duaLenKho(ra, "video/mp4", `${ten}.mp4`);
  });
}

/**
 * Làm tiếp một dự án bị lỗi, GIỮ các cảnh đã tạo xong (đã trả tiền):
 *   - đủ cảnh rồi (hỏng lúc ghép): chỉ ghép lại, không tốn tiền video;
 *   - thiếu cảnh (hỏng giữa chừng): bỏ cảnh lỗi, tạo tiếp từ cảnh còn thiếu.
 *
 * Đã gặp 02/10/2026: hỏng lúc lưu nhạc (dự án #8, 8 cảnh = 3,2 USD) và hết tiền
 * AI ở cảnh 5/8 (dự án #9) — cả hai lần dự án thành "lỗi", các cảnh đã trả tiền
 * nằm không, khách chỉ còn cách tạo lại từ đầu và trả tiền lần nữa.
 */
export async function tiepTucDuAn(trangId: number, id: number): Promise<DuAnVideo> {
  const row = await queryOne<DuAnVideo>(
    `WITH hong AS (
       DELETE FROM video_ai v USING du_an_video d
        WHERE v.du_an_id = d.id AND d.id = $1 AND d.trang_id = $2 AND d.trang_thai = 'loi' AND v.trang_thai = 'loi' AND NOT v.bo_qua
        RETURNING v.gia_thuc
     )
     UPDATE du_an_video d
        SET trang_thai = CASE
              WHEN (SELECT count(*) FROM video_ai v WHERE v.du_an_id = d.id AND v.trang_thai = 'xong' AND NOT v.bo_qua) = jsonb_array_length(d.phan_canh)
              THEN 'dang_ghep' ELSE 'dang_tao' END,
            -- Cảnh lỗi mà vẫn bị tính tiền: giữ tiền đó trong "đã tốn" dù bỏ cảnh.
            chi_phi_them = d.chi_phi_them + COALESCE((SELECT sum(gia_thuc) FROM hong), 0),
            loi = NULL, url = NULL, xong_at = NULL, dang_xu_ly_tu = NULL, updated_at = now()
      WHERE d.id = $1 AND d.trang_id = $2 AND d.trang_thai = 'loi'
      RETURNING ${COT_DU_AN}`,
    [id, trangId]
  );
  if (!row) throw new AppError("Chỉ làm tiếp được dự án đang bị lỗi.", 409);
  return row;
}

/** Gọi định kỳ từ worker (sau khi đã chốt các việc video). */
export async function runDueVideoProjects(): Promise<number> {
  const duAn = await query<DuAnVideo & { user_id: number; trang_id: number }>(
    `UPDATE du_an_video SET dang_xu_ly_tu = now()
      WHERE id IN (
        SELECT id FROM du_an_video
         WHERE trang_thai IN ('dang_tao', 'dang_ghep')
           AND (dang_xu_ly_tu IS NULL OR dang_xu_ly_tu < now() - interval '15 minutes')
           AND ${DK_TAI_KHOAN_MO("du_an_video.user_id")}
         ORDER BY updated_at LIMIT 3)
     RETURNING ${COT_DU_AN}, user_id, trang_id`
  );
  let daXong = 0;
  for (const d of duAn.rows) {
    try {
      await chayChoTrang(d.trang_id, () => tienMotDuAn(d));
    } catch (error) {
      // Tài khoản bị khoá giữa lượt: để nguyên, không đánh lỗi — mở khoá sẽ chuyển sang "Tạm dừng" (mục f).
      if (error instanceof TaiKhoanKhoaError) continue;
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
