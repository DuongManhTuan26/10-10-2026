# Nghiên cứu: tạo video AI ngắn và dài — giới hạn, cách làm chuẩn, cách chấm chất lượng

Lập 03/10/2026 theo yêu cầu chủ dự án: mọi việc phải dựa trên nguồn uy tín (nhà sản xuất, nền tảng,
nghiên cứu khoa học), không suy đoán. Tài liệu này CHỈ nghiên cứu và đề xuất — chưa sửa mã. Mục
"Đề xuất" chờ chủ dự án duyệt từng mục.

Ký hiệu: **[Nguồn]** = sự thật có nguồn · **[App]** = hiện trạng mã · **[Đề xuất]** = chờ duyệt.

---

## 1. Giới hạn của nhà sản xuất — một lần tạo được bao nhiêu giây

**[Nguồn]** Danh mục sống của nhà cung cấp app (OpenRouter `/videos/models`, đọc 02/10/2026) — đây là
giới hạn THẬT khi app gọi:

| Mô hình | Giây mỗi lần tạo | Có tiếng | Khung đầu / cuối |
|---|---|---|---|
| Alibaba Wan 3.0, Wan 3.0 Prime | 2–30 | có | có / — |
| ByteDance Seedance 2.5 | 4–30 | có | có / có |
| ByteDance Seedance 2.0 / Fast / Mini | 4–15 | có | có / có |
| FLUX.3 Video | 5–20 | có | có |
| MiniMax H3, H3 Max | 5–15 | H3 có, H3 Max không | có |
| Kling 3.0 Pro / Standard | 3–15 | có | có |
| HappyHorse 1.1 | 3–15 | không | có |
| Grok Imagine Video 1.5 | 1–15 | không | có |
| HeyGen Video 1 | 5–15 | không | có |
| Runway Gen-4.5 | 2–10 | không | có |
| Google Veo 3.1 / Fast / Lite | 4, 6, 8 | có | có / có |

→ **Tối đa 30 giây một lần tạo** (chỉ Wan 3.0 và Seedance 2.5). Đúng như chủ dự án nói.

## 2. Nhà sản xuất làm video DÀI hơn thế nào

**[Nguồn]**
- **Google Veo 3.1** ([Gemini API — Veo](https://ai.google.dev/gemini-api/docs/veo)): "nối dài" (extension) mỗi lần
  +7 giây, tối đa 20 lần, **tổng tối đa 148 giây**, chỉ 720p; ảnh tham chiếu tối đa 3 (không có ở Lite).
- **Kling** ([Kling — Video Extension](https://kling.ai/quickstart/ai-video-extension)): mỗi lần nối +4–5 giây,
  **tổng tối đa 3 phút**. Kling ghi rõ: *"câu lệnh không liên quan chủ thể gốc có thể gây cắt cảnh/chuyển
  cảnh"* và *"kết quả có tính xác suất, có thể phải nối nhiều lần mới đạt ý"*.
  Kling 3.0 có "storyboard" nhiều cảnh trong một lần tạo (tới 6 cú cắt).
- **Seedance 2.5** ([ByteDance Seed](https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5)):
  tới 30 giây mỗi lần, **nhiều cảnh có logic câu chuyện trong một lần tạo**, nối dài nhiều vòng tới vài phút;
  tham chiếu tới 30 ảnh, 10 video, 10 âm thanh; giữ nhân vật ổn định qua các cú cắt.
- **Wan 3.0**: tới 30 giây, nhiều cảnh từ một lời nhắc, tham chiếu tới 10 ảnh (nguồn bên thứ ba —
  [Magnific](https://www.magnific.com/blog/wan-3-0-generations/), chưa tìm được trang chính thức Alibaba).

**[Nguồn]** Nhà cung cấp của app (OpenRouter, [tài liệu API video](https://openrouter.ai/docs/guides/overview/multimodal/video-generation))
chỉ có: `prompt`, `duration`, `resolution`, `aspect_ratio`, `size`, `frame_images` (khung đầu/cuối),
`input_references` (ảnh tham chiếu), `generate_audio`, `seed`, `provider` (tham số riêng từng hãng, vd.
`negativePrompt` của Google). **KHÔNG có API nối dài video.**

→ Qua nhà cung cấp hiện tại, video dài hơn 30 giây **chỉ làm được bằng cách tạo nhiều cảnh rồi ghép** —
đúng cách app đang làm. Muốn dùng "nối dài" gốc của hãng (Veo 148 giây, Kling 3 phút) phải gọi thẳng API
của hãng (cần tài khoản/khoá riêng từng hãng).

## 2b. API CHÍNH THỨC của từng hãng — nối dài và thế mạnh riêng (nghiên cứu 03/10/2026)

| Hãng / mô hình | Nối dài qua API chính thức | Thế mạnh nổi bật (nguồn hãng) | Cần gì |
|---|---|---|---|
| **ByteDance Seedance 2.5** — BytePlus ModelArk ([hướng dẫn chính thức](https://docs.byteplus.com/en/docs/modelark/seedance-2-5)) | **Có**: `omni_reference_task_type: "extend"`, video gốc vai `reference_video`, lời nhắc có "extend forward/backward / continue"; nối **về trước hoặc về sau**, mỗi lần ≤30 giây, **nhiều vòng** | **Tiếng Việt gốc** (1/11 ngôn ngữ — lời nhắc và **thoại** tiếng Việt); 30 giây nhiều cảnh/lần; tới 50 tài liệu tham chiếu; sửa video theo mốc thời gian; **chế độ nháp 480p** duyệt rẻ trước rồi mới ra 1080p; 1080p màu 10-bit; trả khung cuối | Tài khoản + khoá API BytePlus |
| **Google Veo 3.1 / 3.1 Fast** — Gemini API ([tài liệu](https://ai.google.dev/gemini-api/docs/veo)) | **Có**: +7 giây/lần, ≤20 lần, **tổng ≤148 giây**, chỉ 720p, chỉ video do Veo tạo (lưu 2 ngày) | Âm thanh gốc, thoại; tham chiếu ≤3 ảnh; khung đầu+cuối. Giá ([bảng giá](https://ai.google.dev/gemini-api/docs/pricing)): Fast 0,10 USD/giây (720p), thường 0,40 | Khoá Google AI Studio |
| **Kling 3.0 / 3.0 Omni** — Kling Open Platform ([bảng năng lực](https://kling.ai/document-api/guides/capability-map/video)) | **Không có trong API** (nối dài tới 3 phút chỉ có trên web app Kling) | **Kịch bản nhiều cảnh ≤6 cảnh/15 giây** ("shot n, m, words"); **Element** giữ nhân vật (≤3, có cả giọng); thoại khớp khẩu hình; **4K**; tham chiếu video | Khoá API Kling |
| **Alibaba Wan 3.0** — Model Studio ([API](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference)) | Có nhưng **gốc + phần nối ≤30 giây** — không dùng làm video dài được | 30 giây nhiều cảnh/lần; tham chiếu ảnh/video/âm thanh/tài liệu | Khoá Alibaba Cloud |
| OpenRouter (nhà cung cấp hiện tại) | **Không** | gọi được nhiều hãng bằng một khoá, không có tính năng riêng của hãng | đã có |

**Đính chính (03/10/2026, sau câu hỏi của chủ dự án "OpenRouter không gọi được các mô hình này à?"):**
OpenRouter GỌI ĐƯỢC tất cả các mô hình trên (app đang gọi). Câu "OpenRouter không có API nối dài" của em ở mục 2
là **chưa chính xác cho Seedance 2.5**. Kiểm danh mục sống của OpenRouter:

| Mô hình qua OpenRouter | Tham số riêng chuyển tiếp được | Đưa video vào | Thiếu so với API chính thức |
|---|---|---|---|
| Seedance 2.5 | watermark, req_key, output_format | **có giá riêng** `video_tokens_with_video_input`; mô tả mô hình ghi "video editing, and video extension" | 1080p 10-bit, chế độ nháp, tham số `omni_reference_task_type` |
| Veo 3.1 / Fast | personGeneration, aspectRatio, **negativePrompt**, conditioningScale, enhancePrompt | không có giá đưa video vào | **nối dài 148 giây** |
| Kling 3.0 Pro | negative_prompt, cfg_scale | — | 4K/1080p, **Element** (giữ nhân vật); nhiều cảnh thì viết trong lời nhắc ("shot n, m, words") — chưa thử |
| Wan 3.0 | (không) | — | nối dài ≤30 giây |

→ **Seedance 2.5 nối dài qua OpenRouter: rất có thể làm được** (mô tả + giá đưa video vào + app đã đưa video vào
thành công cho H3 qua `input_references` loại `video_url`), nhưng tài liệu OpenRouter không ghi rõ → **chưa kiểm chứng**,
cần một lượt thử thật (≈0,3–0,5 USD cho 5 giây 480p).

**Kết luận nghiên cứu:**
- Video dài 1–5 phút **làm đúng cách nhà sản xuất** chỉ có 2 đường chính thức qua API: **Seedance 2.5 nối dài nhiều vòng** (có tiếng Việt gốc — mạnh nhất cho thị trường VN) và **Veo 3.1 nối dài ≤148 giây**.
- Kling 3.0 mạnh nhất về **nhiều cảnh trong một lần + giữ nhân vật (Element) + 4K** — hợp cho từng đoạn ≤15 giây chất lượng cao.
- Mọi lựa chọn phải để người dùng chọn từ bình dân tới cao cấp (chủ dự án, 03/10/2026) — không cố định mặc định.

## 3. Nền tảng đăng — Facebook / Instagram Reels

**[Nguồn]** [Meta Ads Guide — Instagram Reels](https://www.facebook.com/business/ads-guide/update/image/instagram-reels):
để trống chữ, logo, chi tiết quan trọng ở **14% trên cùng, 35% dưới cùng, 6% mỗi bên** (bị che bởi ảnh đại diện,
nút kêu gọi).

**[Nguồn — bên thứ ba, chưa xác nhận trang Meta]** 9:16, 1080×1920; Reels quảng cáo tối đa 90 giây; 15–30 giây
hiệu quả nhất; nên có phụ đề vì nhiều người xem tắt tiếng ([superscale.ai](https://superscale.ai/learn/meta-ad-sizes)).
Meta bỏ giới hạn độ dài Reels thường từ 06/2025 ([SocialBee](https://socialbee.com/blog/how-long-can-a-facebook-reel-be/)).

**[App]** Phụ đề đặt cách đáy 13%, lời kêu gọi cách đáy 16% → **nằm trong vùng 35% dưới mà Meta khuyên để trống.**
Video tạo ra 720×1280 (Meta khuyên 1080×1920). Giới hạn video dài của app: 120 giây.

## 4. Cách chấm chất lượng video được giới nghiên cứu công nhận

**[Nguồn]** [VBench — CVPR 2024](https://openaccess.thecvf.com/content/CVPR2024/html/Huang_VBench_Comprehensive_Benchmark_Suite_for_Video_Generative_Models_CVPR_2024_paper.html)
([mã nguồn](https://github.com/Vchitect/VBench)): 16 chiều, mỗi chiều một phương pháp đo đã kiểm với đánh giá
của người thật. VBench-Long cho video dài. EntityBench ([arXiv 2605.15199](https://arxiv.org/abs/2605.15199))
cho nhất quán nhân vật/vật/bối cảnh qua nhiều cảnh. Lưu ý từ nghiên cứu nhiều cảnh: chỉ số "nhất quán nền"
bị nhiễu bởi chuyển động máy có chủ ý.

Đối chiếu 10 tiêu chí của chủ dự án:

| Tiêu chí | Phương pháp có nguồn | App hiện đo gì | Khoảng trống |
|---|---|---|---|
| 1. Tuân thủ yêu cầu | VBench: object class, human action, scene, spatial relationship, overall consistency (CLIP/ViCLIP) | không đo | chưa có |
| 2. Chất lượng hình | VBench: imaging quality (MUSIQ), aesthetic quality (LAION) | không đo | chưa có |
| 3. Ổn định theo thời gian | VBench: temporal flickering, subject consistency (DINO) | điểm đổi khung ffmpeg + độ sáng (tự nghĩ, không theo chuẩn) | phương pháp chưa chuẩn |
| 4. Nhất quán giữa cảnh | EntityBench (nhân vật/vật/bối cảnh giữa các cảnh) | AI xem 4 khung khi nghi ngờ (17/18) | chưa chuẩn |
| 5. Chuyển động | VBench: motion smoothness (khung nội suy), dynamic degree (RAFT) | không đo | chưa có |
| 6. Không gian, vật lý | VBench-2.0: physics, human anatomy | không đo | chưa có |
| 7. Bố cục điện ảnh | chưa tìm được thước đo tự động chuẩn — thường đánh giá bởi người | — | cần người chấm |
| 8. Diễn xuất, cảm xúc | chưa tìm được thước đo tự động chuẩn | — | cần người chấm |
| 9. Âm thanh, đồng bộ | to/nhỏ: ITU-R BS.1770 / EBU R128 (bộ lọc ebur128 của ffmpeg làm đúng chuẩn này); lời đúng: tỷ lệ sai từ qua máy nghe | có: LUFS chuẩn BS.1770; máy nghe lại | khẩu hình (SyncNet) chưa có — app không cho nhân vật nói |
| 10. Tổng thể, nền tảng | đặc tả nền tảng (mục 3) | độ phân giải, khung, thời lượng | vùng an toàn chữ chưa đạt |

**Nhận xét thẳng:** các phép đo em tự làm hôm 02–03/10 (điểm đổi khung, trôi sáng, AI xem khung) là **tự nghĩ,
không theo phương pháp chuẩn** ở trên. Bộ VBench cần Python + các mô hình DINO/CLIP/RAFT/MUSIQ — chạy được như
công cụ kiểm thử riêng trên máy, không cần gọi AI trả tiền.

## 5. Chữ trong video

**[Chủ dự án, 03/10/2026]** Có chữ hay không là do lời nhắc quyết định: người dùng bảo tạo chữ theo nội dung thì
tạo, bảo không thì không — không phải mặc định cố định.

**[App]** `LUAT_VIDEO` (server/services/video-ai.ts) **cấm chữ cố định cho MỌI video**, người dùng không đổi được —
trái ý chủ dự án. Quy tắc này do em tự đặt, không có nguồn.

**[Nguồn]** Seedance 2.5 nói đã "giảm phụ đề và nhạc nền xuất hiện ngoài kiểm soát". Chưa tìm được tài liệu hãng
nào nói về chất lượng chữ **tiếng Việt** có dấu khi mô hình tự vẽ → chưa có căn cứ, cần thử thật nếu dùng.

## 6. Hướng dẫn người dùng chọn kỹ năng — hiện trạng

**[App]** Có 5 kỹ năng: Một cảnh · Video dài theo kịch bản · Từ ảnh tham chiếu · Sửa video có sẵn · Theo trend.
Mỗi nút chỉ có một dòng mô tả; **chưa có hướng dẫn**: giới hạn giây của từng mô hình, khi nào dùng một cảnh hay video
dài, video dài 1–5 phút nên làm thế nào. Giới hạn video dài của app là 120 giây (chưa tới 5 phút).

**[App]** Mỗi cảnh bị ép "một cú máy liền, không cắt" (`LUAT_MOT_CU_MAY`) cho MỌI mô hình. Em đặt luật này vì mô hình
yếu tự cắt cảnh — nhưng nó **chặn mất khả năng nhiều cảnh trong một lần tạo** mà Wan 3.0, Seedance 2.5, Kling 3.0
được nhà sản xuất làm ra để dùng (mục 2).

## 7. Đề xuất — CHỜ CHỦ DỰ ÁN DUYỆT TỪNG MỤC (chưa làm gì)

| # | Đề xuất | Căn cứ | Tốn tiền AI? |
|---|---|---|---|
| Đ1 | Chữ trong video theo lời nhắc của người dùng: thêm lựa chọn "Chữ trong video: theo nội dung / không có chữ" thay cho cấm cố định | Mục 5, ý chủ dự án | không (sửa mã) |
| Đ2 | Hướng dẫn chọn kỹ năng ngay trên màn hình: bảng giới hạn giây từng mô hình (mục 1); ≤30 giây → "Một cảnh"; >30 giây → "Video dài" (ghép nhiều cảnh) | Mục 1, 2 | không |
| Đ3 | Video dài 1–5 phút: người dùng viết MỘT kịch bản dài, AI chia thành các cảnh ≤ giới hạn mô hình (cách app đang làm); với Wan 3.0/Seedance 2.5 cho mỗi đoạn 30 giây chứa nhiều cảnh (đúng khả năng hãng) thay vì ép một cú máy | Mục 2, 6 | không (sửa mã); thử thật thì có |
| Đ4 | Nâng giới hạn video dài từ 120 giây lên 300 giây | Yêu cầu 1–5 phút | không |
| Đ5 | Đưa phụ đề và lời kêu gọi ra khỏi vùng 35% dưới / 14% trên theo Meta | Mục 3 (Meta chính thức) | không |
| Đ6 | Chấm chất lượng bằng VBench (công cụ kiểm thử trên máy, không gọi AI trả tiền) thay cho phép đo tự nghĩ | Mục 4 | không (cần cài Python + mô hình ~vài GB) |

## 7b. Kế hoạch đề xuất sau nghiên cứu (chờ duyệt)

1. **Thêm nhà cung cấp chính thức Seedance 2.5 (BytePlus)** — kỹ năng mới "Video dài nối liền (Seedance)": người dùng viết một kịch bản dài → tạo đoạn 30 giây đầu → nối dài từng vòng theo kịch bản, có thoại/lời đọc tiếng Việt gốc; có bước **nháp 480p** để duyệt trước khi trả tiền bản đẹp.
2. **Thêm Veo 3.1 qua Gemini API** — "Video dài nối liền (Veo)": tới 148 giây, 720p.
3. **Thêm Kling 3.0 API** — "Đoạn nhiều cảnh 4K (Kling)": ≤15 giây, ≤6 cảnh, nhân vật cố định bằng Element.
4. Giữ OpenRouter cho các mô hình còn lại (một cảnh, ghép cảnh như hiện tại).
5. Mỗi nhà cung cấp mới phải có sổ chi phí đối chiếu được như OpenRouter (tra số tiền từng lượt từ hãng).
6. Mọi tham số (mô hình, độ nét, giọng, nhạc, phụ đề, chữ trong video…) để người dùng chọn — không cố định.

## 7c. Đã làm (03/10/2026, chủ dự án duyệt: "làm đúng theo quy định của nhà sản xuất")

| Mục | Đã làm | Căn cứ |
|---|---|---|
| Nối dài gốc của hãng | Chế độ "Nối dài liền mạch" (Seedance 2.5 qua OpenRouter): đoạn sau gửi đoạn trước làm `input_references` loại `video_url`, lời nhắc "Extend @Video 1: continue…", không gửi tỷ lệ khung; ghép không cắt khung đầu; giá theo `video_tokens_with_video_input` | Hướng dẫn chính thức BytePlus Seedance 2.5 |
| Nhiều cảnh trong một lần tạo | Không ép "một cú máy" với Seedance 2.5, Kling 3.0; bộ kiểm "tự cắt cảnh" không áp cho các mô hình này / nối dài | Seedance blog, Kling API |
| Giọng gốc tiếng Việt | Lựa chọn "Giọng gốc của mô hình": lời dẫn tiếng Việt do chính Seedance 2.5 nói trong video | BytePlus: 11 ngôn ngữ có Vietnamese |
| Đ1 Chữ trong video | Người dùng chọn "Có chữ theo lời mô tả" / "Không có chữ" — ở video một cảnh, video dài, sửa video theo yêu cầu sửa | Ý chủ dự án |
| Đ2 Hướng dẫn chọn | Mô tả kỹ năng ghi giới hạn hãng; mục "Hướng dẫn chọn kỹ năng và mô hình" (bấm để mở) có bảng giây tối đa / nối dài / nhiều cảnh / tiếng Việt từng mô hình | Mục 1, 2 |
| Đ4 5 phút | Video dài tới 300 giây, 40 cảnh | Yêu cầu chủ dự án |
| Đ5 Vùng an toàn Meta | Phụ đề và lời kêu gọi cách đáy ≥35%, lề ≥6% | Meta Ads Guide |
| Lựa chọn linh hoạt | Độ nét 480p→4K; giọng AI Flash-Lite / Flash / giọng gốc / không lời; chữ; nhạc; phụ đề; cách làm | Ý chủ dự án |

Chưa làm: Đ6 chấm chất lượng tự động. VBench không hợp (cần máy CUDA, video tự tạo chỉ chấm được 6 chiều); cách được đề xuất là kiểu Video-Bench (CVPR 2025): mô hình đa phương thức làm giám khảo, chấm theo 10 tiêu chí — chờ làm.

## 7d. Luật trong lời nhắc AI — chỉ còn luật có căn cứ (03/10/2026)

Quy tắc của chủ dự án: luật cứng CHỈ lấy từ (1) hướng dẫn chính thức của nhà sản xuất mô hình, (2) 10 tiêu chí kỹ thuật. Còn lại là lựa chọn của người dùng (ban đầu tắt) hoặc để lời nhắc điều hướng.

**Thành lựa chọn của người dùng** (ô đánh dấu, ban đầu tắt):

| Lựa chọn | Áp vào | Ở đâu trên giao diện |
|---|---|---|
| Theo cấu trúc quảng cáo (móc câu 2 giây → vấn đề → giải pháp → lợi ích → kêu gọi) | AI viết lời mô tả, AI đạo diễn video dài | "Hướng kịch bản" |
| Chỉ nói đúng những gì nội dung nêu (không bịa giá, số, khuyến mãi, giải thưởng) | như trên | "Hướng kịch bản" |
| Bối cảnh Việt Nam | như trên | "Hướng kịch bản" |
| Không bịa nhãn hiệu, huy hiệu chứng nhận | ảnh, khung video, AI viết lời mô tả, AI đạo diễn | "Giới hạn nội dung" |
| Không vẽ người nổi tiếng / người thật | ảnh, video | "Giới hạn nội dung" |
| Xoá watermark và chữ chèn thêm | chỉ khi vẽ lại từ ảnh mẫu | "Giới hạn nội dung" (chỉ hiện khi có ảnh mẫu) |

**Đã gỡ hẳn** (không có căn cứ): "Commercial quality, realistic"; ép số cảnh trong lời mô tả; "Prefer continuous sequences"; "do not copy its footage or people"; "Photorealistic cinematic film still" ở khung mở đầu; "social-media advert, steady energy" ở nhạc; "one smooth camera move" (nay: khung hình và chuyển động máy, kể cả đứng yên).

**Còn giữ, có căn cứ ghi ngay trong mã:**

| Luật | Căn cứ |
|---|---|
| Một cú máy liền, không cắt (chỉ mô hình không làm được nhiều cảnh) | Tiêu chí 3, 4; Kling/Seedance công bố nhiều cảnh nên không áp cho chúng |
| Nối từ khung cuối / theo khung mở đầu | Tiêu chí 4 |
| Mô tả chủ thể, hành động, bối cảnh, máy quay, ánh sáng | Hướng dẫn viết lời nhắc của Google Veo |
| "Extend @Video 1: continue…", không gửi tỷ lệ khung | Hướng dẫn BytePlus Seedance 2.5 |
| Độ dài lời đọc ≤ ~12 ký tự/giây; hình khớp lời | Tiêu chí 9 |
| Giọng đọc làm riêng → người trên hình không nói; nhạc làm riêng → clip không nhạc (chỉ cấm đúng thứ đã làm riêng) | Tiêu chí 9 |
| Nhạc nền không lời; chừa chỗ cho giọng chỉ khi có lời đọc | Tiêu chí 9 |
| Chữ: "không chữ" / "chỉ chữ được yêu cầu" | Lựa chọn của người dùng |
| Vẽ lại từ ảnh mẫu: giữ chủ thể, không đổi mặt người | Tiêu chí 1 (đúng yêu cầu), 4 (nhất quán) |

## 8. Câu hỏi cần chủ dự án quyết

1. TD-01 (chữ "ORDER" do AI vẽ) — xem docs/ton-dong.md.
