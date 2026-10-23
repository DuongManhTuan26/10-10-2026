# Sơ đồ mục tiêu của mô hình (chuẩn để làm và kiểm duyệt)

Bản 23/10/2026 (rà lại toàn bộ trạng thái sau A1–A4; 23/10 cập nhật sau P2, P3, gỡ kênh 064, xoá tài khoản 11a). Ghi rõ từng dòng là **đã chốt + đã đạt**, **đã chốt — CHƯA ĐẠT** (mã chưa làm được), hay nằm ở mục 8
(**chưa chốt**). Mọi thay đổi sơ đồ phải được chủ dự án duyệt. Hai phiên (viết code · kiểm duyệt) lấy tài liệu này làm chuẩn.

## 1. Tầng tài khoản

```
HỆ THỐNG
├── ADMIN TỔNG — hoangtuan3310tn (một người, hai vai)
│     ├── Vai 1: QUẢN TRỊ toàn hệ thống — mục "Quản lý tài khoản" (chỉ admin thấy)
│     │     ├── Tạo / sửa / khoá / xoá tài khoản; mật khẩu admin BẮT BUỘC TỰ GÕ ở mọi chỗ tạo / cấp lại — để trống thì
│     │     │     không cho lưu (chốt 19/10 — ĐẠT, ae35d18; một luật chung src/lib/mat-khau.ts)
│     │     │     · Khoá = chặn đăng nhập VÀ AI dừng hẳn mọi việc tự chạy (chốt 18/10 — ĐẠT về mã, mục f 73b82d3, 29a69bc;
│     │     │       đã thử khoá / mở khoá thật trên tài khoản thử 0 kênh; phần cần kênh thật: TD-14). Bài hẹn giờ sẵn bên nền tảng vẫn đăng.
│     │     │       Mở khoá: việc tới hạn trong lúc khoá KHÔNG tự bùng ra (chốt 19/10 — ĐẠT về mã, như trên)
│     │     │       Tin / bình luận khách gửi lúc khoá: LƯU vào hộp thư để chủ shop tự đọc, KHÔNG chạy AI / kịch bản /
│     │     │       trả lời công khai (chốt 19/10 — ĐẠT về mã, 025c692; chưa thử với kênh thật — TD-14)
│     │     │     · Xoá = xem trước → ngắt mọi kênh + xoá mọi hồ sơ của tài khoản bên nhà cung cấp → xoá dữ liệu (ĐẠT — kiểm lại
│     │     │       sau A1–A4 ở mục 11a, 1f4e164: mọi bảng có user_id về 0, giữ sổ tiền + nhật ký quản trị; thử tự hoàn tác trên Neon 23/10)
│     │     ├── "Mở tài khoản": admin đăng nhập thẳng vào tài khoản khác để hỗ trợ (cơ chế mo_boi). 04/10 chỉ bỏ chữ /
│     │     │     màu "đang xem" — KHÔNG bỏ cơ chế. Chỉ còn nút "Quay lại quản lý". (đạt — thử lại thật 22/10: mở tài khoản thử 118 rồi quay lại)
│     │     ├── Tổng quan tài sản: tài khoản → cửa hàng → tiền từng loại (ĐẠT — kiểm lại 23/10 sau A1–A4, mục 11: tài khoản 1
│     │     │     −4,58 USD = cửa hàng 1.1 −1,68 + 1.2 −2,90)
│     │     └── Chi tiết: cây Tài khoản (1) → Cửa hàng (1.1) → báo cáo / sao kê (ĐẠT — kiểm lại 23/10 sau A1–A4, mục 11: đủ
│     │           tiền AI / kênh / quảng cáo / đơn / sao kê)
│     └── Vai 2: TÀI KHOẢN DÙNG THƯỜNG — BẢN MẪU cho mọi tài khoản
│
└── TÀI KHOẢN (1 chìa khoá đăng nhập: email + mật khẩu + mã email)
      • Tự đăng ký hoặc admin tạo hộ → luôn là BẢN SAO 100% phần dùng thường của admin (chốt 18/10 — ĐẠT, kiểm lại 23/10 sau
        A1–A4, mục 11: taoTaiKhoan tạo role 'shop' + cửa hàng đầu tiên + cấu hình AI theo cửa hàng)
      • Không còn admin con / chủ chuỗi / tài khoản con (bỏ 18/10, migration 054, đạt)
      • Số CỬA HÀNG không giới hạn (không tự đặt hạn mức — luật 19/09)
      • Tài khoản mới có sẵn "Cửa hàng đầu tiên" (chốt 19/10, đạt). Hồ sơ nền tảng của nó cấp lúc đăng ký; tài khoản chủ
        chuỗi cũ thì cấp ở lần mở Kết nối kênh đầu tiên (vd. user 113 còn "cho-cap-113") — A4: đạt cho tài khoản mới; tài khoản cũ tự vá.
      • Màn Tổng quan: số liệu CẢ TÀI KHOẢN (cộng mọi cửa hàng); sơ đồ 4 AI theo cửa hàng đang chọn (chốt 19/10)
      • Gói dịch vụ: một tài khoản một gói; số đã dùng (tin AI, đơn, bài, kênh) tính theo CẢ TÀI KHOẢN (chốt 19/10)
```

## 2. Menu — giống hệt nhau ở mọi tài khoản (đạt)

Tổng quan · Kết nối kênh · Bộ não AI ①②③④ · Báo cáo Telegram · Gói dịch vụ (+ Quản lý tài khoản: chỉ admin).
Menu đủ cả khi tài khoản chưa nối kênh nào (chốt 18/10).

## 3. Cửa hàng = một hồ sơ (hộp) bên nhà cung cấp = một bộ não AI

```
CỬA HÀNG = 1 hồ sơ nhà cung cấp = 1 bộ não 4 AI = 1 hệ thống kênh đa nền tảng dùng chung bộ não cho MỘT mục đích
(không có bộ não riêng cho từng kênh). 1 tài khoản tạo được nhiều cửa hàng = nhiều bộ não = nhiều mục đích (chốt 19/10).
├── KÊNH (đạt): mỗi nền tảng tối đa 1 tài khoản trong 1 cửa hàng (1 Fanpage, 1 Instagram, 1 TikTok, 1 YouTube…)
│     • Fanpage thứ 2 → cửa hàng thứ 2; 1 Fanpage chỉ ở 1 cửa hàng
│     • Chuyển kênh sang cửa hàng khác: người dùng tự chọn, không mặc định
│     • KÊNH LÀ NHÂN VIÊN — "RA ĐI TAY TRẮNG, QUAY VỀ NGƯỜI KHÔNG" (chủ dự án chốt 19/10, áp MỌI nền tảng:
│       Fanpage, Instagram, TikTok, YouTube…). ĐẠT VỀ MÃ (22/10): đợt 1 f25a825, 34e84bd · 2a c015f65, eb9d969, a26be2d (058) ·
│       2b 6204a1b, 4a8b5f1 (059) · 3 e95f810, 89a3669. Chưa thử thật: huỷ lịch thật (TD-17), hội thoại "chỉ xem" với dữ liệu
│       thật (TD-18); hoãn: liên kết sâu ?hoi-thoai= (TD-19).
│         · Dữ liệu (khách, hội thoại, đơn, bài, việc dở) thuộc CỬA HÀNG, không thuộc kênh. Kênh rời đi → dữ liệu ở lại
│           cửa hàng; kênh thay thế vào thì thấy toàn bộ (bàn giao).
│         · Kênh vào cửa hàng mới là TRẮNG: bộ não mới, việc mới, không mang gì theo; quay về cũng không mang gì.
│         · Chat cũ trên kênh đã đi = lịch sử của cửa hàng cũ (không nhắn tiếp được qua kênh đó — luật Facebook).
│         · Hệ thống KHÔNG tự nhắn hàng loạt cho khách khi đổi kênh (ngoài 24 giờ = vi phạm luật Facebook); việc chào
│           khách khi đổi kênh do người dùng tự làm.
│         · ĐỢT 1 (ĐẠT — f25a825, 34e84bd): CHỐT CỬA RA (services/cua-ra.ts) — 7 lệnh gửi ra ngoài (tin, tin riêng,
│           trả lời bình luận, đăng / sửa / gỡ bài, đẩy bài) chỉ đi qua kênh còn thuộc đúng cửa hàng của việc. Bài cũ
│           không lên / sửa / gỡ / đẩy được trên kênh đã rời (giữ làm lịch sử). Số liệu bài ghi theo cửa hàng của bài.
│           Tin / bình luận của hội thoại nhiệm kỳ cũ: chặn ở đợt 2 (nhiệm kỳ kênh + cột cửa hàng chốt cho hội thoại / khách /
│           bình luận / kịch bản) — đạt.
│         · ĐỢT 3 (ĐẠT — e95f810, 89a3669): hộp thư "Kênh đã rời — chỉ xem lịch sử"; hộp xác nhận chuyển kênh nói trước
│           hậu quả; kênh rời → gỡ lịch bài hẹn giờ bên nhà cung cấp; Xoá bài hẹn giờ = huỷ bên nhà cung cấp; Gỡ bài đúng
│           tài liệu (gỡ thật đã thử 22/10). CHƯA LÀM: nút "Đổi lịch / Huỷ lịch" của bài ĐÃ giao nhà cung cấp trên màn
│           Nội dung vẫn bị chặn (nói thật trên màn) — muốn huỷ thì Xoá bài.
│         · Chủ dự án chốt thêm (19/10):
│             - bình luận MỚI trên bài cũ của cửa hàng trước (kênh đã sang cửa hàng mới): thuộc cửa hàng mới, AI / kịch bản
│               của cửa hàng mới TỰ TRẢ LỜI như bình luận thường;
│             - quảng cáo của cửa hàng cũ đang chạy trên kênh: CHỈ CẢNH BÁO trong hộp xác nhận, không tự dừng;
│             - bài cửa hàng cũ đã hẹn giờ bên nhà cung cấp trên kênh: GỠ LỊCH lúc chuyển;
│             - bài cũ trên kênh đã rời: CHO XOÁ khỏi app (bài trên nền tảng vẫn còn, cửa hàng không gỡ được);
│             - kịch bản bình luận của cửa hàng cũ trên kênh: TẮT lúc kênh rời; kênh quay về thì chủ shop tự bật lại.
│         · ĐỢT 2a (19/10, phiên kiểm duyệt cho đạt; thử tự hoàn tác trên dữ liệu thật 6/6): NHIỆM KỲ KÊNH — hội thoại chốt
│           cửa hàng + nhiệm kỳ lúc phát sinh; cùng luồng sau khi chuyển → hội thoại mới; AI theo cửa hàng của hội thoại,
│           không đụng hội thoại nhiệm kỳ đã đóng; gửi tin chặn theo cửa hàng + nhiệm kỳ. Kênh CHƯA gắn cửa hàng (thoáng
│           qua lúc nối) → AI im, tin vẫn lưu; gắn xong thì dòng được nhận vào nhiệm kỳ, vớt tin trả lời nếu còn khung giờ.
│         · ĐỢT 2b (ĐẠT — 6204a1b, 4a8b5f1; 059): khách, bình luận, kịch bản, đơn, các chỗ đếm theo cửa hàng của hội thoại.
│         · GỠ KÊNH = NGHỈ VIỆC (23/10, 064 — 0328e6e; suy từ luật trên, phiên kiểm duyệt duyệt — chủ dự án xem lại): chủ
│           shop bấm "Ngắt kết nối" → kênh rời cửa hàng như chuyển đi (đóng nhiệm kỳ, hội thoại cũ chỉ xem, kịch bản tắt, bài
│           hẹn giờ gỡ lịch), ẩn khỏi danh sách kênh; nối lại = nhiệm kỳ mới. Nhà cung cấp tắt / mất token = NGHỈ ỐM: giữ
│           nhiệm kỳ, hiện "Mất kết nối" + nút nối lại. Thử tự hoàn tác Neon 14/14; ĐÃ GỠ THẬT 24/10 kênh TikTok tuanhoang3660
│           (đạt: đã gỡ + nhiệm kỳ đóng + ẩn; nhà cung cấp không còn kênh). Chủ dự án tự nối lại khi cần.
│     • Không có "Đổi Fanpage": ngắt cái cũ, nối cái mới
│     • Quảng cáo Meta đi kèm Facebook, không nối riêng
├── BỘ NÃO AI — 4 AI cố định, liền mạch, không tách rời
│     ① AI Nội dung (xanh lá)  ② AI Quảng cáo (đỏ)  ③ AI Bán hàng (tím)  → NHÂN VIÊN
│     ④ AI Điều hành (vàng) → QUẢN LÝ: chấm 3 AI, giữ cái tốt, chỉ sửa cái tụt
│        · "chấm MỖI NGÀY" — ĐẠT về mã (H7, 24/10, migration 065): từ 7 giờ sáng, mỗi cửa hàng CÓ HOẠT ĐỘNG 24 giờ (kể cả bài
│          lịch tự đăng) một lượt; chỉ gọi AI khi có sự cố / chỉ số tụt; trần 0,30 USD / lượt, 1,00 USD / ngày cả hệ thống;
│          đề xuất chờ duyệt + Telegram. Chưa chạy thật lượt nào (lượt đầu: sáng hôm sau khi gộp).
│     • CÀI ĐẶT BAN ĐẦU ở thẻ "Hướng dẫn AI" của TỪNG AI; trao đổi và điều phối HẰNG NGÀY chỉ qua ④
│     • 2 chế độ: TỰ ĐỘNG (việc dính tiền chỉ trong trần) / ĐỀ XUẤT → DUYỆT
│     • Mỗi AI 4 thẻ theo trình tự: Hướng dẫn AI → Đang làm → Kết quả → Nhật ký
│     • Chỉ lời dặn + tài liệu của cửa hàng thay đổi; chức năng 4 AI cố định
└── DỮ LIỆU RIÊNG CỦA CỬA HÀNG — A1→A4 ĐẠT VỀ MÃ (22/10/2026, phiên kiểm duyệt cho đạt từng đợt; mã commit dán từ git)
      LUẬT CHUNG: mọi việc tự chạy (lịch đăng, nhắc khách, bật tự chủ, vớt tin bỏ sót, video tự động) CHỈ chạm dữ liệu
      của chính cửa hàng đó.
      A1 (822b793, 6c3881c; migration 057) — ĐẠT
           • Bài đăng có cửa hàng; lịch tự đăng theo cửa hàng; chế độ "Chờ tôi duyệt / Đăng luôn" theo cửa hàng
           • Duyệt / Lên lịch KHÔNG đổi kênh đích của bài; bài chỉ đăng vào kênh của ĐÚNG cửa hàng
           • Bảng tự chạy chỉ hiện kênh của cửa hàng; thư viện ảnh / video AI theo cửa hàng
           • Đẩy quảng cáo chỉ bài của cửa hàng đang chọn; xoá cửa hàng GIỮ bài
           ĐÃ THỬ THẬT 24/10: 2 cửa hàng cùng giờ lịch tự đăng (TD-15, chế độ chờ duyệt) — đạt
      A2 (làm qua "kênh là nhân viên" đợt 2a / 2b: c015f65, eb9d969, a26be2d, 6204a1b, 4a8b5f1; migration 058, 059) — ĐẠT
           • Hội thoại chốt cửa hàng + nhiệm kỳ kênh; KHÁCH riêng theo cửa hàng (quay về dùng lại hồ sơ cũ)
           • Số đếm hộp thư theo cửa hàng; nhắc khách cũ + nút bật tự chủ chỉ chạm hội thoại của cửa hàng đó
           • Đợt 3 (e95f810, 89a3669): kênh rời → gỡ lịch bài hẹn giờ, hộp thư "chỉ xem", hộp xác nhận chuyển kênh
           ĐÃ THỬ THẬT 24/10: huỷ lịch thật (TD-17) — đạt. CHƯA: màn "chỉ xem" với dữ liệu thật (TD-18); liên kết sâu ?hoi-thoai= (TD-19)
      A3 (52108c7, 48063ae; migration 060) — ĐẠT
           • Đơn hàng + số tổng theo cửa hàng; sửa đơn của cửa hàng khác báo tên cửa hàng; Tổng quan ghi cửa hàng của đơn
           • Kịch bản + thống kê kịch bản theo cửa hàng
           • Luật chuyển người thật theo cửa hàng (cửa hàng chưa chỉnh → bộ mặc định); rào chắn theo cửa hàng, riêng trần
             tin / phút giữ cấp tài khoản (trần thật của nhà cung cấp — xem TD-21)
      A4 (9deb3ec, f23b3ef, bf7edb3, 25afb05) — ĐẠT
           • CHỌN CỬA HÀNG bằng MÃ CỬA HÀNG (X-Cua-Hang, kiểm chủ sở hữu; GHI thiếu mã → 409); chọn được cả cửa hàng chưa
             có kênh (khung chọn ở màn AI + nút "Mở bộ não" ở Kết nối — chủ dự án chốt 22/10)
           • Telegram: tin của một cửa hàng ghi "🏪 Cửa hàng: <tên>" (đã gửi thử thật 22/10)
           • Tài khoản quảng cáo + phân tích quảng cáo theo cửa hàng đang chọn — CHƯA THỬ THẬT (0 kênh Meta Ads; TD-22)
           • Cấp hồ sơ nền tảng: ĐẠT cho tài khoản mới (ngay khi tạo); tài khoản cũ còn mã tạm tự vá ở lần mở Kết nối
```

## 4. Dùng chung cả tài khoản

- **Telegram**: MỘT Telegram cho cả tài khoản, mỗi tin về việc của một cửa hàng ghi rõ tên cửa hàng (chốt 18/10 — ĐẠT ở A4d, bf7edb3).

## 5. Luồng người dùng (chốt 17/10 — ĐẠT về mã: chữ bước 3 sửa ở P2 4f82746; danh sách trống ở bước 4 sửa ở 6bff07f — chưa nối Fanpage thật để xem)

Tạo cửa hàng mới → đặt tên → tự dẫn xuống bảng "Kết nối kênh cho cửa hàng" → cả bảng sáng viền + mũi tên chỉ xuống →
chọn tự do bất kỳ mạng nào → nối xong ô đó sáng ✓ → mũi tên vẫn chỉ để nối tiếp → "Xong, không nối thêm" thì tắt →
mở bộ não của cửa hàng để dạy AI.

## 6. Tiền

- AI: tính theo từng lượt, gắn cửa hàng.
- Kênh: nhà cung cấp tính theo từng kênh đang nối mỗi ngày; sổ theo ngày chia đúng cửa hàng.
  "Khớp 100% hoá đơn": AI — ĐẠT (đối soát chỉ đọc 23/10: nhà cung cấp AI 18,992324 USD = sổ đã chốt 10,844980 + đang chờ
  chốt 0,074035 + chi ngoài sổ đã đối chiếu 8,073310 → phần lệch 0). Khoản "lệch 8,07 USD" Telegram báo 17–22/10 là TIỀN AI
  (không phải tiền kênh): nghiên cứu AI Điều hành 05–09/10 chạy thẳng bằng khoá của app = 7,890923 + 0,1823866 =
  8,0733096, ghi vào chi ngoài sổ 22/10 (061) — từ đó không còn cảnh báo. Kênh: sổ app tính GỘP theo kênh-ngày (vd. 5,80 USD
  05–23/10); hoá đơn nhà cung cấp kỳ này 0 USD vì tín dụng miễn phí 12 USD/tháng (tài liệu "Free-tier credit") — hai số
  khác nhau là đúng nghĩa, không phải lệch.
- Quảng cáo: tiền đọc qua Facebook theo Fanpage của cửa hàng. Lệnh thao tác chiến dịch đúng tài liệu nhà cung cấp và kiểm
  chiến dịch thuộc tài khoản quảng cáo của shop trước khi đổi / đọc (đạt). Tài khoản quảng cáo THEO CỬA HÀNG — ĐẠT về mã (A4b, 25afb05), chưa thử thật (TD-22).
  Không có nút "Kết thúc" (chốt 18/10 — chỉ Tạm dừng). Ngân sách tầng nhóm (ABO) chưa sửa được trong app (TD-13).
- Số theo cửa hàng chỉ tính từ mốc 05/10/2026; mỗi số có nhãn "đã chốt" / "tạm tính".

## 7. Tên gọi (đã chốt — ĐẠT trừ tên sản phẩm ở mục 8.4)

Cửa hàng (đơn vị có bộ não) · Kênh (tài khoản mạng xã hội) · Fanpage (Facebook Page). Chữ "Zernio" không bao giờ hiện
cho khách. Chữ cho khách dùng "Vui lòng", không "Hãy".
Còn chữ cũ trước mặt khách (phiên kiểm duyệt thấy 19/10): ĐÃ SỬA — bước 3 "Mỗi tài khoản một Fanpage" (P2 4f82746: "Mỗi
cửa hàng một Fanpage…"), câu "chưa gắn Fanpage" (không còn trong mã), Quản lý tài khoản "Chưa nối Fanpage nào" → "Chưa nối
kênh nào" (6bff07f). CÒN: tab trình duyệt "BrewManager AI" + chữ "LOGO" (mục 8.4, chờ chủ dự án).

## 8. Chưa chốt — chờ chủ dự án

1. Áp hạn mức số KÊNH theo gói dịch vụ (màn Gói dịch vụ đang bán theo số kênh nhưng chưa áp ở đâu).
2. Hồ sơ nền tảng đang tìm theo TÊN tài khoản lúc cấp → hai tài khoản trùng tên có thể dính chung hộp (bảo mật, để cuối).
3. Đổi email tài khoản chưa đăng xuất phiên cũ (bảo mật, để cuối).
4. Tên sản phẩm (tab trình duyệt còn "BrewManager AI", thanh bên còn "LOGO").
5. Đường hỗ trợ (VITE_SUPPORT_URL) — đang hiện "Sắp có".
