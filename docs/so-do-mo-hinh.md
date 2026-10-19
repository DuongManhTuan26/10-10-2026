# Sơ đồ mục tiêu của mô hình (chuẩn để làm và kiểm duyệt)

Bản 19/10/2026. Ghi rõ từng dòng là **đã chốt + đã đạt**, **đã chốt — CHƯA ĐẠT** (mã chưa làm được), hay nằm ở mục 8
(**chưa chốt**). Mọi thay đổi sơ đồ phải được chủ dự án duyệt. Hai phiên (viết code · kiểm duyệt) lấy tài liệu này làm chuẩn.

## 1. Tầng tài khoản

```
HỆ THỐNG
├── ADMIN TỔNG — hoangtuan3310tn (một người, hai vai)
│     ├── Vai 1: QUẢN TRỊ toàn hệ thống — mục "Quản Lý Tài Khoản" (chỉ admin thấy)
│     │     ├── Tạo / sửa / khoá / xoá tài khoản; mật khẩu admin BẮT BUỘC TỰ GÕ ở mọi chỗ tạo / cấp lại — để trống thì
│     │     │     không cho lưu (chốt 19/10 — mã xong 19/10, CHỜ kiểm duyệt; một luật chung src/lib/mat-khau.ts)
│     │     │     · Khoá = chặn đăng nhập VÀ AI dừng hẳn mọi việc tự chạy (chốt 18/10 — mã xong mục f 19/10, CHỜ kiểm
│     │     │       duyệt + thử khoá thật). Bài hẹn giờ sẵn bên nền tảng vẫn đăng.
│     │     │       Mở khoá: việc tới hạn trong lúc khoá KHÔNG tự bùng ra (chốt 19/10 — như trên)
│     │     │       Tin / bình luận khách gửi lúc khoá: LƯU vào hộp thư để chủ shop tự đọc, KHÔNG chạy AI / kịch bản /
│     │     │       trả lời công khai (chốt 19/10 — mã xong 19/10, CHỜ kiểm duyệt; chưa thử với kênh thật)
│     │     │     · Xoá = xem trước → ngắt mọi kênh + xoá mọi hồ sơ của tài khoản bên nhà cung cấp → xoá dữ liệu (đạt)
│     │     ├── "Mở tài khoản": admin đăng nhập thẳng vào tài khoản khác để hỗ trợ (cơ chế mo_boi). 04/10 chỉ bỏ chữ /
│     │     │     màu "đang xem" — KHÔNG bỏ cơ chế. Chỉ còn nút "Quay lại quản lý". (đạt)
│     │     ├── Tổng quan tài sản: tài khoản → cửa hàng → tiền từng loại (đạt)
│     │     └── Chi tiết: cây Tài khoản (1) → Cửa hàng (1.1) → báo cáo / sao kê (đạt)
│     └── Vai 2: TÀI KHOẢN DÙNG THƯỜNG — BẢN MẪU cho mọi tài khoản
│
└── TÀI KHOẢN (1 chìa khoá đăng nhập: email + mật khẩu + mã email)
      • Tự đăng ký hoặc admin tạo hộ → luôn là BẢN SAO 100% phần dùng thường của admin (chốt 18/10, đạt)
      • Không còn admin con / chủ chuỗi / tài khoản con (bỏ 18/10, migration 054, đạt)
      • Số CỬA HÀNG không giới hạn (không tự đặt hạn mức — luật 19/09)
      • Tài khoản mới có sẵn "Cửa hàng đầu tiên" (chốt 19/10, đạt). Hồ sơ nền tảng của nó cấp lúc đăng ký; tài khoản chủ
        chuỗi cũ thì cấp ở lần mở Kết nối kênh đầu tiên (vd. user 113 còn "cho-cap-113") — cấp NGAY là việc của A4.
      • Màn Tổng quan: số liệu CẢ TÀI KHOẢN (cộng mọi cửa hàng); sơ đồ 4 AI theo cửa hàng đang chọn (chốt 19/10)
      • Gói dịch vụ: một tài khoản một gói; số đã dùng (tin AI, đơn, bài, kênh) tính theo CẢ TÀI KHOẢN (chốt 19/10)
```

## 2. Menu — giống hệt nhau ở mọi tài khoản (đạt)

Tổng quan · Kết nối kênh · Bộ não AI ①②③④ · Báo cáo Telegram · Gói Dịch Vụ (+ Quản Lý Tài Khoản: chỉ admin).
Menu đủ cả khi tài khoản chưa nối kênh nào (chốt 18/10).

## 3. Cửa hàng = một hồ sơ (hộp) bên nhà cung cấp = một bộ não AI

```
CỬA HÀNG
├── KÊNH (đạt): mỗi nền tảng tối đa 1 tài khoản trong 1 cửa hàng (1 Fanpage, 1 Instagram, 1 TikTok, 1 YouTube…)
│     • Fanpage thứ 2 → cửa hàng thứ 2; 1 Fanpage chỉ ở 1 cửa hàng
│     • Chuyển kênh sang cửa hàng khác: người dùng tự chọn, không mặc định
│     • Không có "Đổi Fanpage": ngắt cái cũ, nối cái mới
│     • Quảng cáo Meta đi kèm Facebook, không nối riêng
├── BỘ NÃO AI — 4 AI cố định, liền mạch, không tách rời
│     ① AI Nội dung (xanh lá)  ② AI Quảng cáo (đỏ)  ③ AI Bán hàng (tím)  → NHÂN VIÊN
│     ④ AI Điều hành (vàng) → QUẢN LÝ: chấm 3 AI, giữ cái tốt, chỉ sửa cái tụt
│        · "chấm MỖI NGÀY" là ĐÍCH — CHƯA ĐẠT (worker chưa có bộ chạy hằng ngày của ④; hiện chạy khi bấm)
│     • CÀI ĐẶT BAN ĐẦU ở thẻ "Hướng dẫn AI" của TỪNG AI; trao đổi và điều phối HẰNG NGÀY chỉ qua ④
│     • 2 chế độ: TỰ ĐỘNG (việc dính tiền chỉ trong trần) / ĐỀ XUẤT → DUYỆT
│     • Mỗi AI 4 thẻ theo trình tự: Hướng dẫn AI → Đang làm → Kết quả → Nhật ký
│     • Chỉ lời dặn + tài liệu của cửa hàng thay đổi; chức năng 4 AI cố định
└── DỮ LIỆU RIÊNG CỦA CỬA HÀNG — ĐÍCH của B2 / nhóm A, CHƯA ĐẠT (làm 4 đợt A1→A4)
      LUẬT CHUNG: mọi việc tự chạy (lịch đăng, nhắc khách, bật tự chủ, vớt tin bỏ sót, video tự động) CHỈ chạm dữ liệu
      của chính cửa hàng đó.
      A1 • Bài đăng (có cửa hàng); lịch tự đăng (khung giờ tính theo cửa hàng); chế độ "Chờ tôi duyệt / Đăng luôn"
           • Duyệt / Lên lịch KHÔNG đổi kênh đích của bài
           • Bài chỉ đăng vào kênh của ĐÚNG cửa hàng — không bao giờ "mọi kênh của tài khoản" (chặn tràn đã có ở B1-G)
           • Bảng tự chạy chỉ hiện kênh của cửa hàng; thư viện ảnh / video AI theo cửa hàng
           • Đẩy quảng cáo: chỉ chọn / đẩy được bài của cửa hàng đang chọn (không tiêu tiền sai cửa hàng)
           • Xoá cửa hàng: GIỮ bài, bỏ gán cửa hàng; bài không rõ cửa hàng → cửa hàng cũ nhất (chủ dự án chốt 19/10)
           (A1 — mã xong 19/10, migration 057 đã chạy: 12/12 bài có cửa hàng; CHỜ kiểm duyệt)
      A2 • Hội thoại; KHÁCH HÀNG riêng theo cửa hàng (Facebook cấp mã khác nhau cho cùng một người ở mỗi Fanpage)
           • Số đếm hộp thư theo cửa hàng; nhắc khách cũ + nút bật tự chủ chỉ chạm hội thoại của cửa hàng đó
      A3 • Đơn hàng (danh sách + số tổng); kịch bản + thống kê kịch bản
           • Luật chuyển người thật + rào chắn riêng từng cửa hàng (cửa hàng mới chép bộ mặc định)
      A4 • Tài khoản quảng cáo + phân tích quảng cáo theo cửa hàng (hiện resolveAdAccount lấy tài khoản quảng cáo
             ĐẦU TIÊN của cả tài khoản); mọi lệnh thao tác chiến dịch dùng đúng tài khoản quảng cáo của cửa hàng đang chọn
           • CHỌN CỬA HÀNG bằng MÃ CỬA HÀNG (không suy qua kênh — bỏ X-Kenh) → chọn được cả cửa hàng chưa có kênh
           • Cấp hồ sơ nền tảng NGAY khi tạo cửa hàng
           • Telegram: mỗi tin ghi tên cửa hàng
```

## 4. Dùng chung cả tài khoản

- **Telegram**: MỘT Telegram cho cả tài khoản, mỗi tin ghi rõ tên cửa hàng (chốt 18/10 — phần "ghi tên cửa hàng" CHƯA ĐẠT, A4).

## 5. Luồng người dùng (chốt 17/10 — đạt phần dẫn; còn chữ cũ ở bước 3 và danh sách trống ở bước 4 — CHƯA ĐẠT hẳn)

Tạo cửa hàng mới → đặt tên → tự dẫn xuống bảng "Kết nối kênh cho cửa hàng" → cả bảng sáng viền + mũi tên chỉ xuống →
chọn tự do bất kỳ mạng nào → nối xong ô đó sáng ✓ → mũi tên vẫn chỉ để nối tiếp → "Xong, không nối thêm" thì tắt →
mở bộ não của cửa hàng để dạy AI.

## 6. Tiền

- AI: tính theo từng lượt, gắn cửa hàng.
- Kênh: nhà cung cấp tính theo từng kênh đang nối mỗi ngày; sổ theo ngày chia đúng cửa hàng.
  "Khớp 100% hoá đơn" là ĐÍCH — CHƯA ĐẠT (Telegram báo lệch 8,07 USD lặp lại từ 12/10).
- Quảng cáo: tiền đọc qua Facebook theo Fanpage của cửa hàng. Lệnh thao tác chiến dịch đúng tài liệu nhà cung cấp và kiểm
  chiến dịch thuộc tài khoản quảng cáo của shop trước khi đổi / đọc (đạt). Tài khoản quảng cáo THEO CỬA HÀNG — CHƯA ĐẠT (A4).
  Không có nút "Kết thúc" (chốt 18/10 — chỉ Tạm dừng). Ngân sách tầng nhóm (ABO) chưa sửa được trong app (TD-13).
- Số theo cửa hàng chỉ tính từ mốc 05/10/2026; mỗi số có nhãn "đã chốt" / "tạm tính".

## 7. Tên gọi (đã chốt — CHƯA ĐẠT: còn chữ cũ, sửa khi làm lại từng màn theo phiếu C/D)

Cửa hàng (đơn vị có bộ não) · Kênh (tài khoản mạng xã hội) · Fanpage (Facebook Page). Chữ "Zernio" không bao giờ hiện
cho khách. Chữ cho khách dùng "Vui lòng", không "Hãy".
Còn chữ cũ trước mặt khách (phiên kiểm duyệt thấy 19/10): Kết nối kênh bước 3 "Mỗi tài khoản một Fanpage… lập tài khoản
riêng"; câu báo "chưa gắn Fanpage" khi lưu ở bộ não (trangCuaReq); Quản lý tài khoản "Chưa nối Fanpage nào"; tab trình
duyệt "BrewManager AI".

## 8. Chưa chốt — chờ chủ dự án

1. Áp hạn mức số KÊNH theo gói dịch vụ (màn Gói dịch vụ đang bán theo số kênh nhưng chưa áp ở đâu).
2. Hồ sơ nền tảng đang tìm theo TÊN tài khoản lúc cấp → hai tài khoản trùng tên có thể dính chung hộp (bảo mật, để cuối).
3. Đổi email tài khoản chưa đăng xuất phiên cũ (bảo mật, để cuối).
4. Tên sản phẩm (tab trình duyệt còn "BrewManager AI", thanh bên còn "LOGO").
5. Đường hỗ trợ (VITE_SUPPORT_URL) — đang hiện "Sắp có".
