---
name: feedback-nghien-cuu-truoc
description: "Nghiên cứu tài liệu chính thức TRƯỚC khi làm/đề xuất; dùng OpenRouter (trung gian đang có) trước khi nghĩ tới API riêng từng hãng; làm theo tài liệu chính thức, không đòi \"thử\" tốn tiền"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-03T05:07:54.896Z
---

Trước khi làm hay đề xuất bất cứ thứ gì: đọc tài liệu chính thức (nhà sản xuất, nhà cung cấp đang dùng) cho thật kỹ, rồi mới quyết. Tài liệu chính thức đã ghi rõ thì LÀM THEO, không đòi "thử thật" tốn tiền để xác nhận.

**Why:** 03/10/2026 em đề xuất chủ dự án mở tài khoản API riêng BytePlus/Google/Kling để dùng tính năng nối dài video — trong khi OpenRouter (trung gian đang dùng từ đầu) đã gọi được các mô hình đó, Seedance 2.5 qua OpenRouter có nhận video đầu vào. Chủ dự án: "lỗi kinh điển… nếu tao tin làm theo thì tạo ra một đống API không cần thiết". Rồi em lại đòi thử 0,5 USD dù tài liệu chính thức đã ghi đủ cách gọi — bị mắng "tài liệu đầy đủ thế còn đòi test".

**How to apply:** Thứ tự kiểm: (1) nhà cung cấp đang dùng (OpenRouter: danh mục `/videos/models`, `allowed_passthrough_parameters`, pricing_skus, tài liệu API) làm được không; (2) tài liệu chính thức của hãng nói cách dùng thế nào → ánh xạ sang tham số OpenRouter; (3) chỉ khi chắc chắn trung gian không làm được mới đề xuất API riêng, kèm lý do có nguồn. Không đề xuất thứ chủ dự án phải làm thêm (tài khoản, tiền) khi chưa nghiên cứu xong. Áp dụng cả cho THIẾT KẾ GIAO DIỆN: 04/10/2026 em tự vẽ lại màn hình quản lý (thẻ → bảng) mà không tra cách sản phẩm lớn làm; chủ dự án tự nghiên cứu và đưa mẫu tốt hơn (tách Tổng quan biểu đồ / Chi tiết dạng cây có đánh số), nhắc "đã dặn nhiều lần nhưng lại quên". Trước khi thiết kế màn hình: tra mẫu chuẩn (Google Cloud Billing, Shopify Organization, NN/g…) + đo dữ liệu thật có đủ để vẽ không, rồi mới đề xuất. **Nghiên cứu xong thì TỰ CHỐT và làm** (17/10/2026, Kết nối kênh): em hỏi đi hỏi lại "anh quyết A hay B / ok thì em làm" về cơ chế sản phẩm (chuyển kênh, trang mặc định) → bị mắng "đã nghiên cứu kỹ chưa? không định hình được cách làm nào là đúng nữa à?". Chỉ hỏi khi thật sự là quyết định kinh doanh / tiêu tiền / đổi điều đã thống nhất; còn lại tra chuẩn (Sprout, PatternFly…) + đọc mã/tài liệu đến nơi rồi chốt, làm, báo kết quả kèm lý do. Liên quan [[feedback-xu-ly-triet-de]], [[feedback-verify-before-claiming]].
