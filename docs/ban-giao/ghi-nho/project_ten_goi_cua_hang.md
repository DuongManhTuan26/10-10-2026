---
name: project-ten-goi-cua-hang
description: "Zernio — đơn vị có bộ não AI gọi là \"CỬA HÀNG\" (chủ dự án chốt 17/10/2026), không gọi \"trang bán hàng\"; Facebook gọi \"Fanpage\""
metadata:
  node_type: memory
  type: project
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-17T06:43:51.342Z
---

Chủ dự án chốt 17/10/2026 (sau khi hỏi "cái đúng nhất là gì: cửa hàng, shop, tài khoản…"): đơn vị gom các kênh + một bộ não AI (4 AI) gọi là **Cửa hàng**; tài khoản mạng xã hội gắn vào gọi là **Kênh (bán hàng)**; Facebook Page luôn gọi **Fanpage**. Mô hình (từ 18/10/2026 bỏ tầng chuỗi): Tài khoản → nhiều Cửa hàng → mỗi cửa hàng các Kênh + 1 bộ não.

**Why:** "trang bán hàng" trùng nghĩa với Fanpage (HaraSocial gọi Fanpage là "trang bán hàng") → chủ dự án nhầm nhiều lần ("trang ở đâu, kênh ở đâu"); "tài khoản" trùng tài khoản đăng nhập / tài khoản Instagram / mục Quản lý tài khoản; Sapo, Haravan dùng "Cửa hàng" + "Kênh bán hàng".

**How to apply:** chữ HIỆN CHO KHÁCH dùng "cửa hàng" / "Fanpage"; tên biến, cột DB (trang, trang_id), đường dẫn (/quan-ly-trang) giữ nguyên. Chữ AI đọc (luật sổ bằng chứng, lời dặn bộ đề — ma-dieu-hanh.ts, dieu-hanh.ts) giữ nguyên văn vì phép kiểm đòi khớp. Số trang phân trang ("Trang 1/3"), "trang web", "trang cá nhân" giữ. Liên quan [[project-khoi-nao-ai]], [[feedback-khong-tu-doi-da-thong-nhat]].
