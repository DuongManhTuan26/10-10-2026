---
name: project-fanpage-ai-system
description: User is building an internal AI sales & marketing system for their own Facebook Fanpages — architecture decisions and current status
metadata: 
  node_type: memory
  type: project
  originSessionId: 550637b6-9248-4dd7-8bcb-144857e73cc0
  modified: 2026-08-10T11:29:23.643Z
---

User (hoangtuan3310tn@gmail.com) is building "Hệ thống AI bán hàng & marketing cho Facebook Fanpage" — an AI system that connects to their Facebook Fanpages to auto-handle Comment/Messenger sales conversations, AI content creation + scheduled publishing, and AI-assisted ads analysis. Source spec: `PRODUCT-SPEC-final.pdf` (Downloads folder — note: this path was inaccessible to the Bash/Read tools due to macOS TCC permission restrictions; user pasted the spec as text instead on 2026-08-10).

Confirmed scope decisions (as of 2026-08-10):
- **Internal tool for their own business**, not multi-tenant SaaS — no billing/org layer, no RBAC (single admin only).
- **Small scale** (few Fanpages, low daily message volume) — chose lean infra over microservices.
- **AI provider: Claude API (Anthropic)**.
- **Payment: VNPay + Momo integration required from day one**, but built as a detachable module with COD as the default fallback so it's never on the critical path.
- **Explicitly wants to minimize dependency on Meta and third parties, and prefers the simplest possible integration** — this was a direct correction after the first design draft: user said to optimize for efficiency/simplicity and to avoid being blocked by Meta or third-party review processes.
- **Meta Business Manager / Facebook Developer App not yet created.** Key strategy adopted: put the Page(s) and the Meta App in the **same Business Portfolio** (user owns both) — this keeps most Page-level permissions (pages_messaging, pages_manage_posts, ads_read, ads_management) at **Standard Access**, self-approved in Business Settings, avoiding the public App Review process entirely. App Review is only needed if the app were ever used by pages the user doesn't own (i.e. going back to a multi-tenant SaaS model, which was explicitly rejected).
- **Architecture simplified to a single-process monolith**: Python/FastAPI + Jinja2/HTMX (server-rendered admin UI, no separate Next.js frontend) + PostgreSQL+pgvector doing triple duty as relational store, RAG vector store, AND the job queue (via a `webhook_event` table polled with `SELECT ... FOR UPDATE SKIP LOCKED` — no Redis/Celery). Background jobs (Worker Loop, Scheduler Loop) run as asyncio tasks inside the same process. Media stored on local VPS disk (no S3/R2/MinIO). Error alerting reuses the Telegram bot instead of adding Sentry. Hosting: 1 VPS, Docker Compose with just 2 containers (app + Postgres) + Caddy for HTTPS.

A full architecture/design document was delivered as a published Artifact (HTML, single-page with sticky TOC, inline SVG architecture diagram + order state-machine diagram, phased roadmap Phase 0–8 mapped to the spec's 3 required acceptance flows). Artifact URL: https://claude.ai/code/artifact/8055005b-cb81-462b-abdb-a49e13911892

**Status: code-complete and verified, as of 2026-08-10.** Full implementation lives at `/Users/mac/projects/fanpage-ai-system` (git repo, initial commit made). Every phase (0–8) is implemented: FastAPI monolith, Jinja2+HTMX admin dashboard, all 17 DB tables via Alembic migration, webhook ingestion + Postgres-as-queue Worker Loop, APScheduler Scheduler Loop, Claude tool-calling AI Orchestration with RAG (local fastembed embeddings, no external embedding API), order confirm flow, Telegram notifier, VNPay/Momo payment adapters, Content Studio, Ads Insight with 3-layer AI analysis. 18 pytest tests pass against a real Postgres+pgvector (mocked Anthropic client for orchestrator tests — no live API key needed to test). Verified end-to-end against the actual production Docker image (`docker build` + real container boot + migrate + login + page loads), not just `uvicorn --reload`.

Real bugs found and fixed during verification (useful context if debugging this codebase later): (1) bare `Mapped[datetime]` columns defaulted to naive `TIMESTAMP` instead of `TIMESTAMPTZ` — fixed via `type_annotation_map` on `Base` in `app/db.py`; (2) a module-level `asyncio.Lock()` in `app/services/embeddings.py` bound to whichever event loop first used it, breaking under multiple loops — replaced with a plain `threading.Lock`.

**What's NOT done / needs the user's own credentials:** live Meta App + Business Portfolio (user hadn't created one as of 2026-08-10 — SETUP.md has the exact self-serve steps to avoid App Review), live Anthropic API key, VNPay/Momo merchant credentials, Telegram bot token. The code paths for all of these are complete and wired in; they just need real secrets in `.env` per SETUP.md.

**How to apply:** If the user returns, don't re-scaffold — read `/Users/mac/projects/fanpage-ai-system/README.md` and `SETUP.md` first, check `git log`/`git status` for what's changed since, and pick up from there. Don't re-ask the settled decisions above.
