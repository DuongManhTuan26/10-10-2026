# Sơ đồ mục tiêu của mô hình (chuẩn để làm và kiểm duyệt)

Bản 18/10/2026. Chỉ ghi điều chủ dự án đã chốt; điểm chưa chốt nằm ở mục cuối. Mọi thay đổi sơ đồ phải được chủ dự án
duyệt (quy tắc "không tự đổi điều đã thống nhất"). Hai phiên (viết code · kiểm duyệt) lấy tài liệu này làm chuẩn.

## 1. Tầng tài khoản

```
HỆ THỐNG
├── ADMIN TỔNG — hoangtuan3310tn (một người, hai vai)
│     ├── Vai 1: QUẢN TRỊ toàn hệ thống — mục "Quản Lý Tài Khoản" (chỉ admin thấy)
│     │     ├── Tạo / sửa / khoá / xoá tài khoản (mật khẩu admin tự gõ; để trống thì hệ thống sinh)
│     │     │     · Khoá = chặn đăng nhập VÀ AI dừng hẳn mọi việc tự chạy (chốt 18/10 — đang làm, mục f)
│     │     │     · Xoá = xem trước → ngắt mọi kênh + xoá mọi hồ sơ của tài khoản bên nhà cung cấp → xoá dữ liệu
│     │     ├── "Mở tài khoản": admin đăng nhập thẳng vào tài khoản khác để hỗ trợ (cơ chế mo_boi). Đã bỏ chữ / màu
│     │     │     "đang xem" (04/10) — KHÔNG bỏ cơ chế. Chỉ còn nút "Quay lại quản lý".
│     │     ├── Tổng quan tài sản: tài khoản → cửa hàng → tiền từng loại
│     │     └── Chi tiết: cây Tài khoản (1) → Cửa hàng (1.1) → báo cáo / sao kê
│     └── Vai 2: TÀI KHOẢN DÙNG THƯỜNG — BẢN MẪU cho mọi tài khoản
│
└── TÀI KHOẢN (1 chìa khoá đăng nhập: email + mật khẩu + mã email)
      • Tự đăng ký hoặc admin tạo hộ → luôn là BẢN SAO 100% phần dùng thường của admin (chốt 18/10)
      • Không còn admin con / chủ chuỗi / tài khoản con (bỏ 18/10, migration 054)
      • Có sẵn "Cửa hàng đầu tiên" + hồ sơ nền tảng ngay khi tạo
      • Số CỬA HÀNG không giới hạn (không tự đặt hạn mức — luật 19/09). Số KÊNH giới hạn theo gói dịch vụ — CHƯA áp,
        chờ chủ dự án quyết (mục 6)
```

## 2. Menu — giống hệt nhau ở mọi tài khoản

Tổng quan · Kết nối kênh · Bộ não AI ①②③④ · Báo cáo Telegram · Gói Dịch Vụ (+ Quản Lý Tài Khoản: chỉ admin).
Menu đủ cả khi tài khoản chưa nối kênh nào (chốt 18/10).

## 3. Cửa hàng = một hồ sơ (hộp) bên nhà cung cấp = một bộ não AI

```
CỬA HÀNG
├── KÊNH: mỗi nền tảng tối đa 1 tài khoản trong 1 cửa hàng (1 Fanpage, 1 Instagram, 1 TikTok, 1 YouTube…)
│     • Fanpage thứ 2 → cửa hàng thứ 2; 1 Fanpage chỉ ở 1 cửa hàng
│     • Chuyển kênh sang cửa hàng khác: người dùng tự chọn, không mặc định
│     • Không có "Đổi Fanpage": ngắt cái cũ, nối cái mới
│     • Quảng cáo Meta đi kèm Facebook, không nối riêng
├── BỘ NÃO AI — 4 AI cố định, liền mạch, không tách rời
│     ① AI Nội dung (xanh lá)  ② AI Quảng cáo (đỏ)  ③ AI Bán hàng (tím)  → NHÂN VIÊN
│     ④ AI Điều hành (vàng) → QUẢN LÝ: chấm 3 AI mỗi ngày, giữ cái tốt, chỉ sửa cái tụt
│     • CÀI ĐẶT BAN ĐẦU ở thẻ "Hướng dẫn AI" của TỪNG AI; trao đổi và điều phối HẰNG NGÀY chỉ qua ④
│     • 2 chế độ: TỰ ĐỘNG (việc dính tiền chỉ trong trần) / ĐỀ XUẤT → DUYỆT
│     • Mỗi AI 4 thẻ theo trình tự: Hướng dẫn AI → Đang làm → Kết quả → Nhật ký
│     • Chỉ lời dặn + tài liệu của cửa hàng thay đổi; chức năng 4 AI cố định
└── DỮ LIỆU RIÊNG CỦA CỬA HÀNG (đích của B2 / nhóm A — chưa đạt, đang làm theo 4 đợt A1→A4)
      • Bài đăng, lịch tự đăng (khung giờ tính theo cửa hàng), chế độ "Chờ tôi duyệt / Đăng luôn"
      • Hội thoại, KHÁCH HÀNG (riêng theo cửa hàng — Facebook cấp mã khác nhau cho cùng một người ở mỗi Fanpage)
      • Đơn hàng (danh sách + số tổng), kịch bản + thống kê kịch bản
      • Luật chuyển người thật + rào chắn (riêng từng cửa hàng; cửa hàng mới chép bộ mặc định)
      • Tài khoản quảng cáo, phân tích quảng cáo
      • Bài chỉ đăng vào kênh của ĐÚNG cửa hàng — không bao giờ "mọi kênh của tài khoản" (đã chặn ở B1-G)
```

## 4. Dùng chung cả tài khoản

- **Telegram**: MỘT Telegram cho cả tài khoản, mỗi tin ghi rõ tên cửa hàng (chốt 18/10).

## 5. Luồng người dùng (chốt 17/10)

Tạo cửa hàng mới → đặt tên → tự dẫn xuống bảng "Kết nối kênh cho cửa hàng" → cả bảng sáng viền + mũi tên chỉ xuống →
chọn tự do bất kỳ mạng nào → nối xong ô đó sáng ✓ → mũi tên vẫn chỉ để nối tiếp → "Xong, không nối thêm" thì tắt →
mở bộ não của cửa hàng để dạy AI.

## 6. Tiền

- AI: tính theo từng lượt, gắn cửa hàng.
- Kênh: nhà cung cấp tính theo từng kênh đang nối mỗi ngày; sổ theo ngày chia đúng cửa hàng; khớp 100% hoá đơn.
- Quảng cáo: đọc qua Facebook theo Fanpage của cửa hàng; mọi lệnh thao tác chiến dịch đúng tài liệu nhà cung cấp, kiểm
  chiến dịch thuộc tài khoản quảng cáo của shop trước khi đổi. Không có nút "Kết thúc" (chốt 18/10 — chỉ Tạm dừng).
- Số theo cửa hàng chỉ tính từ mốc 05/10/2026; mỗi số có nhãn "đã chốt" / "tạm tính".

## 7. Tên gọi

Cửa hàng (đơn vị có bộ não) · Kênh (tài khoản mạng xã hội) · Fanpage (Facebook Page). Chữ "Zernio" không bao giờ hiện
cho khách. Chữ cho khách dùng "Vui lòng", không "Hãy".

## 8. Chưa chốt — chờ chủ dự án

1. Áp hạn mức số kênh theo gói dịch vụ (màn Gói dịch vụ đang bán theo số kênh nhưng chưa áp ở đâu).
2. Tài khoản mới có sẵn "Cửa hàng đầu tiên" (đang làm vậy) hay để trống tự tạo.
3. Hồ sơ nền tảng đang tìm theo TÊN tài khoản lúc cấp → hai tài khoản trùng tên có thể dính chung hộp (bảo mật, để cuối).
4. Đổi email tài khoản chưa đăng xuất phiên cũ (bảo mật, để cuối).
5. Tên sản phẩm (tab trình duyệt còn "BrewManager AI", thanh bên còn "LOGO").
6. Đường hỗ trợ (VITE_SUPPORT_URL) — đang hiện "Sắp có".
