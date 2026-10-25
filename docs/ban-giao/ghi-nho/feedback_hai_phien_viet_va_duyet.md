---
name: hai-phien-viet-va-duyet
description: "Zernio — làm theo cặp: một phiên Claude viết code, một phiên kiểm duyệt; đề xuất → bàn tới thống nhất → làm → chạy thử → phản hồi lỗi; mọi kết luận dựa trên chứng cứ"
metadata:
  node_type: memory
  type: feedback
  originSessionId: afe2e2c9-0ca4-4ad2-a6f1-12e763c919e1
  modified: 2026-10-22T14:09:16.768Z
---

Từ 18/10/2026 chủ dự án Zernio giao làm theo cặp phiên: một phiên viết code ("Tiếp quản dự án automation bán hàng"), một phiên kiểm duyệt/giám sát (phiên "Rà soát dự án ket-noi"). Trước khi làm, bên viết đề xuất mục tiêu, kiến trúc, thiết kế; hai bên bàn tới khi thống nhất mới viết code. Làm xong, bên kiểm duyệt chạy thử, thấy lỗi dù nhỏ nhất thì báo ngay rồi bàn tiếp.

**Why:** chủ dự án từng bị AI làm giả kết quả; muốn có người thứ hai kiểm, "không coi cái gì là đúng mà dựa toàn bộ vào cơ sở chứng minh mạnh hay yếu".

**How to apply:** khi là bên kiểm duyệt: tự mở mã hoặc tài liệu đối chiếu từng khẳng định, ghi rõ chứng cứ (tệp:dòng, kết quả chạy), trả lời theo từng mục Duyệt / Sửa lại. Việc nào cần chủ dự án quyết (cách hoạt động, tốn tiền, ghi hay xoá dữ liệu thật) thì vẫn chuyển cho anh ấy; lời duyệt của phiên kiểm duyệt không thay cho lời duyệt của chủ dự án. Liên quan [[verify-before-claiming]], [[tung-buoc-kiem-duyet]].

**Tiết kiệm token (chủ dự án 18/10, giao cho phiên kiểm duyệt tự quyết):** hiệu quả vẫn đặt hàng đầu, chỉ bỏ chỗ lãng phí.
- Chỗ tốn thật: đọc nguyên tệp lớn, thử trình duyệt (ảnh chụp, dữ liệu giả), tin nhắn dài, phiên quá dài. Chạy kiem-tra / kiem-tra-nguoc / tsc rồi đọc vài dòng cuối thì rẻ.
- Trước khi làm: bàn thiết kế kỹ (bước bắt được nhiều lỗi nhất); bên giám sát chỉ đọc đúng tệp:dòng + tài liệu được nêu.
- Làm xong: bên viết code tự chạy toàn bộ kiểm và thử trình duyệt; báo cáo ngắn theo mẫu (tệp đổi, lệnh + mã thoát + dòng kết quả, lệnh gửi đi thật).
- Bên giám sát kiểm theo mức rủi ro: thấp (chữ/màu) → đọc diff; vừa (hành vi) → diff + chạy lại kiem-tra; cao (tiền, xoá, dữ liệu thật, lẫn cửa hàng) → đọc kỹ + kiem-tra-nguoc + tự thử đúng ca nguy hiểm nhất. Lý do giữ quyền tự thử ở mức cao: ngày 18/10 có 3 lỗi bên viết code tự thử vẫn "đạt" (dữ liệu giả dựng theo mã sai, bộ lọc TEP báo xanh giả, xoá dở bấm lại kẹt).
- Dữ liệu giả phải dựng theo TÀI LIỆU / nguồn thật, không theo mã đang viết.
- Migration có điền / chép / đổi khoá dữ liệu: BẮT BUỘC chạy nội dung migration trong kịch bản thử tự hoàn tác trên Neon (đếm trước/sau, kiểm sau ROLLBACK, lock_timeout) trước khi gộp; code server/ viết trong worktree riêng (máy chủ tsx watch chạy dữ liệu thật). Bài học 22/10: 060 chép dòng trước khi bỏ khoá cũ → vỡ duplicate key → máy chủ không lên.
- Phiên kiểm duyệt kiểm một nhánh bằng worktree TẠM riêng trong scratchpad (git worktree add --detach <commit>, symlink node_modules + .env, xong thì worktree remove) — KHÔNG checkout trong worktree của phiên viết code (nó đang làm nhánh khác).
- TEP kiểm tra ngược lấy từ `git diff --name-only` của nhánh, không gõ tay (bài học 2b: 2 lỗ chết lọt qua TEP hẹp).
- 18/10 chủ dự án chốt: GIỮ cả hai phiên (không gộp), "cách nào không hiệu quả cao thì loại hết". Phiên kiểm duyệt quá dài thì mở phiên kiểm duyệt mới kèm tóm tắt ngắn.
