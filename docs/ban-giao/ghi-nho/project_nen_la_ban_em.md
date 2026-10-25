---
name: project-nen-la-ban-em
description: Zernio — nền là bản của Claude 3000 (/Users/mac/projects/zernio); bản làm lại (zernio-khoi-nao) chỉ lấy GIAO DIỆN; chức năng do Claude 3000 toàn quyền
metadata:
  node_type: memory
  type: project
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-11T17:02:19.991Z
---

Chủ dự án chốt 12/10/2026: nền là `/Users/mac/projects/zernio` (bản đang phục vụ khách, cổng 3000). Bản làm lại `zernio-khoi-nao` (GitHub 10-10-2026banmoilamlai) chỉ là thiết kế lại GIAO DIỆN → lấy điểm mạnh giao diện sang (bước 1, nhánh `giao-dien-hop-nhat`). Chức năng, logic, bộ não giữ bản gốc; Claude 3000 toàn quyền rà và hoàn thiện ở bước 2 (vì chỉ phiên này đủ ngữ cảnh).

**Why:** chủ dự án: bản mới chỉ thiết kế lại giao diện, những thứ còn lại vẫn là mô hình gốc.
**How to apply:** không lấy chức năng của bản làm lại ở bước 1 (chỉ đạo, báo cáo ngày, cảnh báo 24h…); ghi vào danh sách bước 2 trong docs/ke-hoach-hop-nhat-ban-lam-lai.md. Bản làm lại `.env` đã trỏ Neon thật — KHÔNG bật nó (sẽ tự áp migration 047–051 lên dữ liệu thật). Liên quan [[project-zernio-saas]], [[feedback-tung-buoc-kiem-duyet]].
