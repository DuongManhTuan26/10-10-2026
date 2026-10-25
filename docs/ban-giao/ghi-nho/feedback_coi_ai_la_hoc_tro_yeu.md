---
name: feedback-coi-ai-la-hoc-tro-yeu
description: "Thiết kế AI theo giả định nó là mô hình kém, hay sai — cầm tay chỉ việc, kiểm soát điểm yếu; KHÔNG đi tìm/ép mô hình hoàn hảo bằng chạy thử tốn tiền"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-09T15:37:29.229Z
---

Không thiết kế hệ thống AI (điều hành, giám sát, nhân viên) theo hướng "chọn mô hình giỏi nhất rồi tin nó tự làm đúng". Coi MỌI mô hình (kể cả Opus/Terra mạnh nhất) là học trò yếu, sẽ mắc lỗi liên tục; việc của mình là cài đặt, hướng dẫn, cấu hình để kiểm soát từng điểm yếu đã biết về phạm vi an toàn: chia việc thành bước nhỏ hẹp, việc gì code làm được thì code làm, AI chỉ trả lời câu hỏi hẹp có kiểm chứng, chỉ rõ cho nó những lỗi nó hay mắc.

**Why:** 09/10/2026 chủ dự án phê bình: em xoáy vào vòng chạy bộ đề → sửa lỗi đo → chạy lại, tốn tiền mà kết quả vẫn không chắc, vì AI bản chất không thể đúng 100%; em biết rõ lỗi của nó mà vẫn để ngẫu nhiên cho nó mắc lại. "Dạy học trò yếu biết rõ điểm yếu để cẩn thận kiểm soát."

**How to apply:** Khi gặp lỗi của AI → thiết kế quy trình/chốt chặn để lỗi đó không thể lọt (không phải chạy thêm bộ đề hay đổi mô hình). Kiểm thử chỉ ở mức nhỏ, rẻ, nhắm đúng ca lỗi đã biết. Liên quan [[project-zernio-saas]], [[feedback-xu-ly-triet-de]].
