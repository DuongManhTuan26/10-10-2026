---
name: dong-nhat-hai-tang-quan-ly
description: "Zernio — BỎ HẲN admin con/chủ chuỗi (18/10/2026): mọi tài khoản mới = bản sao 100% phần dùng thường của admin tổng; Quản lý chỉ của admin tổng"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-17T19:22:55.105Z
---

Chủ dự án 18/10/2026: tài khoản hoangtuan3310tn vừa là admin tổng vừa là MẪU tài khoản dùng thường. Mọi tài khoản tạo mới (tự đăng ký hay admin tạo hộ) phải là bản sao 100% phần dùng thường đó — "bê nguyên si sang, bỏ hết toàn bộ cái cũ". Chọn: bỏ hẳn admin con (tầng quản lý giữa) + tài khoản con @noi-bo.local; chủ chuỗi cũ thành tài khoản thường; tài khoản con cũ tách đứng riêng để chủ dự án TỰ xoá.

**Why:** luật cũ "1 tài khoản = 1 Fanpage" (19/09) sinh ra tầng chuỗi; nay 1 tài khoản tự giữ nhiều cửa hàng (mỗi cửa hàng 1 hồ sơ + 1 bộ não) nên tầng chuỗi thừa và làm giao diện admin con lệch hẳn tài khoản mẫu (chủ dự án hỏi "tại sao trang con lại có giao diện như này").

**How to apply:** Vai trò chỉ còn 'admin' | 'shop' (migration 054, bảng dấu vết lien_ket_chuoi_cu). Một bộ tuyến đường cho mọi tài khoản; /admin chỉ thêm cho admin. QuanLy.tsx chỉ của admin tổng (không laTong). Không dựng lại chủ chuỗi / tài khoản con / "Thành chủ chuỗi" nếu chủ dự án chưa yêu cầu. Quy tắc cũ 04/10 ("admin tổng và admin con giống 100%") đã hết hiệu lực. Vẫn giữ: mở tài khoản = đăng nhập thẳng, không chữ "đang xem"; không confirm/prompt/alert trình duyệt (HopHoi). Liên quan [[project-ten-goi-cua-hang]], [[admin-tu-dat-mat-khau]].
