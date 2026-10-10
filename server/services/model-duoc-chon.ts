/**
 * Danh sách mô hình AI được phép gọi — lọc theo xếp hạng, có bằng chứng.
 *
 * Quy tắc (chủ dự án đặt 02/10/2026, chỉnh lại cùng ngày): CHỈ BỎ mô hình kém
 * nhất / không ai dùng cho đỡ rối mắt; GIỮ mọi mô hình nổi tiếng, tốt. Mỗi mô
 * hình gọi phải đúng tuyệt đối. Bản đầu tiên chỉ giữ 3 mô hình là SAI ý chủ dự
 * án ("ai bảo mày loại những mô hình tốt") — đừng lọc chặt lại như thế.
 *
 * Chỉ bỏ ba loại:
 *   1. Đã ngừng: Sora 2 Pro (OpenAI tắt API từ 24/09/2026, nhà cung cấp vẫn liệt kê).
 *   2. Hạng bét: Seedance 1.5 Pro (video từ ảnh 27/35), Wan 2.6 (34/35).
 *   3. Bản cũ đã có bản mới cùng hãng, giá bằng hoặc rẻ hơn mà hạng cao hơn:
 *      Wan 2.7 → Wan 3.0, HappyHorse 1.0 → 1.1, Grok Imagine Video → 1.5,
 *      Hailuo 2.3 → H3 / H3 Max, Kling O1 → Kling 3.0.
 * Avatar IV (HeyGen) không phải tạo video từ chữ — nó làm ảnh chân dung nói theo
 * giọng có sẵn — nên không thuộc danh sách này.
 *
 * Nguồn xếp hạng: Artificial Analysis Video Arena (bỏ phiếu mù của người thật),
 * đo ngày 02/10/2026: 28 mô hình video-từ-chữ, 35 mô hình video-từ-ảnh.
 * Cập nhật danh sách khi bảng xếp hạng đổi.
 */

export const NGUON_XEP_HANG = "Artificial Analysis Video Arena, đo 02/10/2026";

export interface ModelDuocChon {
  id: string;
  phanKhuc: string;
  xepHang: string;
  /** Điều khách cần biết trước khi chọn (đã đo thật / tài liệu hãng). */
  ghiChu?: string;
  /**
   * Số giây TỐI THIỂU bị tính tiền — chỉ ghi khi đã đo thật (danh mục nhà cung cấp không có trường này).
   * Wan 3.0, đo 04/10/2026: video 2 giây (#40) và 5 giây (#41) cùng bị tính 0,2125 USD = 5 × 0,05 × (1 − 15%).
   */
  giayTinhToiThieu?: number;
}

/**
 * Wan 3.0 luôn tạo tiếng: tài liệu Alibaba Model Studio — cờ audio chỉ quyết định có trả tiếng về hay không, bật
 * hay tắt không đổi giá. Đo thật 04/10/2026 (video #40): app gửi generate_audio: false, video vẫn có tiếng
 * (trung bình −16,6 dB). Chủ dự án chọn để nguyên, chỉ ghi chú (TD-07).
 */
const WAN_LUON_CO_TIENG = "Luôn có tiếng do AI tạo — tắt \"Có âm thanh\" cũng không bỏ được tiếng.";

/**
 * Tạo video. Mọi mô hình ở đây đều nhận ảnh khung mở đầu (cần cho nối cảnh video dài).
 * Giá ghi chú là USD/giây đo trên danh mục thật 02/10/2026; app luôn tính lại giá sống.
 */
export const MODEL_VIDEO_DUOC_CHON: ModelDuocChon[] = [
  // --- Tiết kiệm ---------------------------------------------------------
  // 0,02–0,03. Rẻ nhất. Hãng nổi tiếng, mô hình mới, chưa lên bảng.
  { id: "heygen/heygen-video-1", phanKhuc: "Tiết kiệm", xepHang: "Chưa xếp hạng (mô hình mới)" },
  // 0,03–0,05. Google.
  { id: "google/veo-3.1-lite", phanKhuc: "Tiết kiệm", xepHang: "Hạng 14 video từ ảnh · hạng 22 video từ chữ" },
  // 0,034–0,076. Bản rút gọn của Seedance 2.0 (hạng 4 video từ ảnh).
  { id: "bytedance/seedance-2.0-mini", phanKhuc: "Tiết kiệm", xepHang: "Chưa xếp hạng riêng (bản rút gọn Seedance 2.0)" },
  // 0,04–0,09. Bản nhanh của Seedance 2.0.
  { id: "bytedance/seedance-2.0-fast", phanKhuc: "Tiết kiệm", xepHang: "Chưa xếp hạng riêng (bản nhanh Seedance 2.0)" },
  // 0,05–0,08. Không có tiếng.
  { id: "minimax/hailuo-3-max", phanKhuc: "Tiết kiệm", xepHang: "Hạng 1 video từ ảnh · hạng 5 video từ chữ" },
  // 0,05–0,20 (480p–1080p). Có tiếng, dài tới 30 giây.
  {
    id: "alibaba/wan-3.0",
    phanKhuc: "Tiết kiệm",
    xepHang: "Hạng 1 video từ chữ · hạng 6 video từ ảnh",
    ghiChu: `${WAN_LUON_CO_TIENG} Tính tiền tối thiểu 5 giây (chọn ngắn hơn vẫn trả như 5 giây).`,
    giayTinhToiThieu: 5,
  },

  // --- Tầm trung ---------------------------------------------------------
  // 0,068–0,28. Bản cao cấp của Wan 3.0; bảng chỉ chấm bản thường.
  { id: "alibaba/wan-3.0-prime", phanKhuc: "Tầm trung", xepHang: "Chưa xếp hạng riêng (bản cao cấp Wan 3.0)", ghiChu: WAN_LUON_CO_TIENG },
  // 0,08–0,25, tới 4K.
  { id: "google/veo-3.1-fast", phanKhuc: "Tầm trung", xepHang: "Hạng 17 video từ ảnh · hạng 19 video từ chữ" },
  // 0,08–0,25 + 0,01/ảnh đưa vào.
  { id: "x-ai/grok-imagine-video-1.5", phanKhuc: "Tầm trung", xepHang: "Hạng 8 video từ ảnh · hạng 11 video từ chữ" },
  // 0,084.
  { id: "kwaivgi/kling-v3.0-std", phanKhuc: "Tầm trung", xepHang: "Hạng 20 video từ ảnh" },
  // 0,099–0,128.
  { id: "alibaba/happyhorse-1.1", phanKhuc: "Tầm trung", xepHang: "Hạng 7 video từ ảnh · hạng 12 video từ chữ" },
  // 0,112.
  { id: "kwaivgi/kling-v3.0-pro", phanKhuc: "Tầm trung", xepHang: "Hạng 16 video từ chữ · hạng 19 video từ ảnh" },
  // 0,12. Hãng nổi tiếng, bản mới nhất; chưa có trên bảng mới.
  { id: "runway/gen-4.5", phanKhuc: "Tầm trung", xepHang: "Chưa có trên bảng xếp hạng mới" },

  // --- Cao cấp -----------------------------------------------------------
  // 0,13, 2K, có tiếng.
  { id: "minimax/hailuo-3", phanKhuc: "Cao cấp · 2K", xepHang: "Hạng 2 video từ ảnh · hạng 4 video từ chữ" },
  // 0,067–0,78 (480p–4K).
  { id: "bytedance/seedance-2.0", phanKhuc: "Cao cấp · tới 4K", xepHang: "Hạng 4 video từ ảnh · hạng 7 video từ chữ" },
  // 0,103–0,231. Có tiếng, dài tới 30 giây.
  { id: "bytedance/seedance-2.5", phanKhuc: "Cao cấp", xepHang: "Hạng 3 video từ chữ" },
  // 0,17–0,29.
  { id: "black-forest-labs/flux-3-video", phanKhuc: "Cao cấp", xepHang: "Hạng 6 video từ chữ" },
  // 0,20–0,40, tới 4K.
  { id: "google/veo-3.1", phanKhuc: "Cao cấp · tới 4K", xepHang: "Hạng 11 video từ ảnh · hạng 18 video từ chữ" },
];

/**
 * Sửa video (đưa video vào, ra video đã sửa).
 *
 * Bảng xếp hạng sửa video: Wan 3.0 hạng 1 nhưng qua nhà cung cấp của mình nó
 * TỪ CHỐI video đầu vào (đã thử 02/10/2026: "does not accept video input
 * references"). MiniMax H3 hạng 2 — đã thử thật: đổi màu chiếc ly, giữ nguyên
 * bố cục/hơi nước/nền. Runway Aleph 2 hạng 7 và đắt gấp đôi → loại. FLUX Video
 * Edit không có trên bảng → loại.
 */
export const MODEL_SUA_VIDEO_DUOC_CHON: ModelDuocChon[] = [
  { id: "minimax/hailuo-3", phanKhuc: "Tốt nhất gọi được", xepHang: "Hạng 2 sửa video" },
];

export function thongTinChon(ds: ModelDuocChon[], id: string): ModelDuocChon | undefined {
  return ds.find((m) => m.id === id);
}

/**
 * Giọng đọc (chữ → tiếng nói). Artificial Analysis Speech Arena, đo 02/10/2026,
 * 93 mô hình. Cả hai gọi được qua nhà cung cấp hiện tại, không cần khoá riêng.
 * Giá token đọc từ danh mục sống 02/10/2026 (USD mỗi token).
 */
export interface ModelGiongDoc extends ModelDuocChon {
  giaTokenVao: number;
  giaTokenRa: number;
}
/*
 * Mặc định (đứng đầu) là Flash-LITE, không phải Flash dù Flash xếp cao hơn. Đã đo
 * 02/10/2026 cùng một câu 82 ký tự, cùng lời dặn "nhịp nhanh, không ngắt kịch
 * tính": Flash đọc 13,5 giây (ngắt nghỉ kịch tính, phớt lờ lời dặn), Flash-Lite
 * 5,5 giây; cả hai đọc đúng từng chữ. Lời đọc video phải vừa khít cảnh 8 giây.
 */
export const MODEL_GIONG_DOC_DUOC_CHON: ModelGiongDoc[] = [
  { id: "google/gemini-3.8-flash-lite-tts", phanKhuc: "Mặc định", xepHang: "Hạng 7 giọng đọc", giaTokenVao: 0.0000005, giaTokenRa: 0.000006 },
  { id: "google/gemini-3.8-flash-tts", phanKhuc: "Chậm, kịch tính", xepHang: "Hạng 4 giọng đọc", giaTokenVao: 0.0000005, giaTokenRa: 0.000009 },
];

/**
 * Nhạc nền. Lyria 3 Pro: hạng 4–5 nhạc không lời (Artificial Analysis Music
 * Arena, 09/2026) — các mô hình xếp trên (Suno, Mureka) không gọi được qua nhà
 * cung cấp hiện tại. Giá công bố 0,08 USD một bài; số thật lấy khi đối chiếu.
 */
export const MODEL_NHAC_NEN = {
  id: "google/lyria-3-pro-preview",
  phanKhuc: "Tốt nhất gọi được",
  xepHang: "Hạng 4–5 nhạc không lời",
  giaMoiBai: 0.08,
};

/**
 * NỐI DÀI GỐC của hãng — đưa video trước vào làm `reference_video`, lời nhắc "Extend @Video 1…",
 * mô hình làm tiếp đoạn sau (4–30 giây), làm nhiều vòng thành video dài.
 *
 * Nguồn: BytePlus — Dreamina Seedance 2.5 tutorial (https://docs.byteplus.com/en/docs/modelark/seedance-2-5):
 * "extend videos over multiple rounds"; "Video extension: content contains at least one reference video
 * whose role is reference_video, and the prompt expresses an extension intent… ratio must be adaptive";
 * "duration supports [4, 30] or -1"; lời nhắc phải có "extend forward/backward, continue, or continue the story".
 * OpenRouter: mô tả mô hình ghi "video editing, and video extension"; có giá `video_tokens_with_video_input`;
 * video đưa vào qua `input_references` loại `video_url` (cùng cách app đang sửa video bằng H3).
 */
export const MODEL_NOI_DAI: Record<string, { giayMoiDoanToiDa: number; giayMoiDoanToiThieu: number; nguon: string }> = {
  "bytedance/seedance-2.5": {
    giayMoiDoanToiDa: 30,
    giayMoiDoanToiThieu: 4,
    nguon: "https://docs.byteplus.com/en/docs/modelark/seedance-2-5",
  },
};

/**
 * Làm được NHIỀU CẢNH (có cắt cảnh theo kịch bản) trong MỘT lần tạo — nhà sản xuất làm ra để dùng,
 * nên KHÔNG ép "một cú máy liền" với các mô hình này.
 *   - Seedance 2.5: "organizes multiple logically connected shots… within the 30-second window"
 *     (https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5)
 *   - Kling 3.0: "Multi-shot video format: shot n, m, words" — tối đa 6 cảnh
 *     (https://kling.ai/document-api/api/video/3-0-omni/image-to-video)
 * Mô hình khác chỉ thêm vào đây khi đã đọc được tài liệu chính thức của hãng.
 */
export const MODEL_NHIEU_CANH = new Set(["bytedance/seedance-2.5", "kwaivgi/kling-v3.0-pro", "kwaivgi/kling-v3.0-std"]);

/**
 * Nói TIẾNG VIỆT GỐC trong video (thoại / lời dẫn do chính mô hình video tạo).
 * Nguồn: BytePlus — "Native multilingual support: Supports 11 languages: … Vietnamese …"
 * (https://docs.byteplus.com/en/docs/modelark/seedance-2-5). Veo 3.1 chỉ đánh giá tiếng Anh (tài liệu Google) — không có ở đây.
 */
export const MODEL_TIENG_VIET_GOC = new Set(["bytedance/seedance-2.5"]);
