---
name: feedback-xu-ly-triet-de
description: "Nguyên tắc làm việc — sửa triệt để mọi lỗi dù nhỏ nhất; chỉ để lại khi đã cố hết sức mà không thể, phải nêu rõ nguyên nhân và lưu vào hệ thống để báo cáo; phân biệt rạch ròi LỖI với LỰA CHỌN"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-03T03:18:00.018Z
---

Đã làm thì phải xử lý triệt để, không để tồn tại bất kỳ lỗi nào dù nhỏ nhất. Chỉ được để lại khi đã cố gắng hết sức mà THẬT SỰ không thể làm được — khi đó phải nêu rõ nguyên nhân, và phải LƯU VÀO HỆ THỐNG (sổ tồn đọng trong repo, không chỉ nói trong chat) để báo cáo. Phải phân biệt rõ đâu là LỖI (sai so với yêu cầu/quy tắc) và đâu là LỰA CHỌN (quyết định có chủ ý, đánh đổi) — tuyệt đối không gọi lựa chọn là lỗi hay ngược lại.

**Why:** 03/10/2026 em báo "còn 1 lỗi nhỏ: chữ ORDER… để nguyên vì vượt trần 13 USD". Chủ dự án mắng: đã làm thì phải xong hẳn; và em không giải thích chữ đó là gì, vì sao xuất hiện, vì sao gọi là lỗi. Ràng buộc tiền là ràng buộc do chủ dự án đặt — không phải "không thể làm được"; phải nói rõ là cần nâng trần bao nhiêu để sửa, không tự gác lại.

**Bổ sung 03/10/2026 (bị mắng lần 2):** em gọi chữ "ORDER" do AI vẽ là lỗi dựa trên luật DO CHÍNH EM ĐẶT, rồi tự sửa (thêm bước tốn tiền) và đòi nâng trần tiền. Chủ dự án: "ai bảo mày đó là lỗi… mày đã hỏi ý kiến tao chưa mà dám sửa". Căn cứ gọi là lỗi phải là YÊU CẦU CỦA CHỦ DỰ ÁN hoặc sai rõ ràng (hỏng, sai số liệu, sai chính tả trong chữ app in…), không phải quy tắc em tự nghĩ ra. Cái gì là phán đoán (thẩm mỹ, hành vi của AI) → HỎI TRƯỚC, không sửa, không tiêu tiền. Không bao giờ chủ động đề nghị nâng tiền cho việc chưa được duyệt.

**Bổ sung 03/10/2026 (lần 3):** em tự gài cứng 2 luật vào mọi lời nhắc AI ảnh/video ("không bịa nhãn hiệu/huy hiệu", "không vẽ người thật"). Chủ dự án: "ai cho phép mày tự ý áp luật cứng này cho AI". Chủ dự án chọn: chuyển thành LỰA CHỌN người dùng bật/tắt (ban đầu tắt), kèm dòng căn cứ (Điều 32 BLDS, chính sách Meta). → KHÔNG BAO GIỜ tự gài luật cứng vào lời nhắc AI; luật nào cũng phải do chủ dự án duyệt hoặc là lựa chọn của người dùng. Có căn cứ pháp lý thì trình căn cứ để chủ dự án quyết, không tự áp.

**QUY TẮC CỨNG (chủ dự án 03/10/2026, lần 4 — "sao mày hỏi toàn cái ngu vậy"):** luật cứng trong lời nhắc AI CHỈ được lấy từ (1) hướng dẫn chính thức của nhà sản xuất mô hình, (2) 10 tiêu chí kỹ thuật chủ dự án đã đưa. Ngoài ra TUYỆT ĐỐI không gài luật cứng nào: cái gì thấy cần và có cơ sở thì để thành LỰA CHỌN của người dùng hoặc để lời nhắc điều hướng — tự làm luôn, KHÔNG hỏi lại từng luật. Mỗi luật cứng còn lại phải ghi rõ căn cứ (tài liệu hãng nào / tiêu chí số mấy) ngay trong mã.

**How to apply:** Trước khi báo xong: rà mọi tồn đọng; cái nào sửa được thì sửa và chứng minh; cái nào không thể thì ghi vào `docs/ton-dong.md` (repo zernio) với: hiện tượng, nguyên nhân gốc, đã thử gì, vì sao không thể, phân loại LỖI/LỰA CHỌN. Mỗi lỗi nêu ra phải kèm: nó là gì, vì sao xảy ra, căn cứ nào nói nó là lỗi. Liên quan [[feedback-verify-before-claiming]], [[project-zernio-saas]].
