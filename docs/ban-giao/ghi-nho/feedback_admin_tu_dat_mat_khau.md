---
name: admin-tu-dat-mat-khau
description: Mọi chỗ tạo / cấp lại mật khẩu trong Zernio SaaS: admin BẮT BUỘC tự gõ (19/10: để trống không cho lưu, không tự sinh)
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-04T07:59:30.199Z
---

Quản trị tổng phải TỰ ĐẶT được mật khẩu ở MỌI chỗ cấp mật khẩu: tạo tài khoản, đặt lại mật khẩu (từ 18/10/2026 chỉ còn 2 chỗ này — tầng chủ chuỗi / lập trang con đã bỏ, xem [[dong-nhat-hai-tang-quan-ly]]). 19/10/2026 chủ dự án CHỐT LẠI: mật khẩu BẮT BUỘC tự gõ — để trống thì KHÔNG cho lưu (bỏ việc hệ thống tự sinh). Ô nhập hiện rõ chữ.

**Why:** Chủ dự án 04/10/2026 bực: "tao là admin tổng, tao thích đổi mật khẩu như nào tao phải biết chứ, lỗi này đã xảy ra trước đây sao giờ lại bị lặp lại". Lần đầu chỉ sửa đúng một chỗ (cấp lại mật khẩu ở Quản lý Trang), các chỗ khác vẫn chỉ sinh ngẫu nhiên + hộp confirm.

**How to apply:** Khi sửa một lỗi theo yêu cầu chủ dự án, tìm và sửa MỌI chỗ cùng loại (grep cả server lẫn giao diện), gom về một hàm dùng chung (`docMatKhauTuDat` trong server/services/tai-khoan.ts) và thêm kiểm tra "không route nào gọi thẳng hàm sinh ngẫu nhiên". Liên quan [[project_zernio_saas]], [[feedback_xu_ly_triet_de]].
