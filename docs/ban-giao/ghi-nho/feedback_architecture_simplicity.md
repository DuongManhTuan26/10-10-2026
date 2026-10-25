---
name: feedback-architecture-simplicity
description: "User strongly prefers minimal-dependency, single-process architectures over \"textbook\" scalable designs — apply when proposing system designs"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 550637b6-9248-4dd7-8bcb-144857e73cc0
  modified: 2026-08-10T07:34:51.918Z
---

When designing a system for this user, default to the smallest number of moving parts that satisfies the actual stated scale, not the "professionally scalable" default (microservices, managed queues, separate frontend stack, third-party monitoring SaaS).

**Why:** After an initial architecture proposal for [[project-fanpage-ai-system]] (FastAPI + Redis/Celery + Next.js + S3-compatible storage + Sentry, sized for a SaaS-like deployment), the user pushed back explicitly: "thiết kế sao cho hiệu quả tối ưu nhất... ưu tiên sự kết nối liên kết đơn giản dễ thực hiện không phức tạp" (design for maximum efficiency, prioritize simple/easy connections, not complex) — and separately stressed avoiding dependency on/limitations from Meta or any third party wherever avoidable. This was for a solo-operator internal tool, and the initial design over-engineered for a multi-tenant SaaS scale that had already been explicitly ruled out earlier in the same conversation.

**How to apply:** When the declared scope is "internal tool," "just for me," or "small scale / one operator," proactively collapse the architecture: single process/monolith over separate services, the primary datastore doing double/triple duty (e.g. Postgres as queue via `SKIP LOCKED` instead of adding Redis) before introducing a new dependency, server-rendered UI over a separate frontend build when there's only one user, and reusing an already-required integration (e.g. a notification bot) for secondary purposes (error alerts) instead of adding a new third-party service. Also actively look for ways to reduce *external* platform dependency (e.g., structuring Meta app/page ownership to avoid the public App Review process) rather than just accepting the standard vendor-prescribed process — don't wait for the user to ask a second time.
