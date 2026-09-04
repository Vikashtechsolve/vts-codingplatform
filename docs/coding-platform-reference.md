# Coding Platform — Personal Reference Doc

**Status:** Personal reference only. Not for Handshake / Project Parchment submission.  
**Date:** 2026-08-23  
**Scope:** Multi-tenant coding + MCQ assessment platform (MERN). This is a working summary for my own use.

---

## 1. What this platform is

A multi-tenant assessment platform. One deployment serves many vendors (training companies / colleges). Each vendor gets an isolated admin panel, students, tests, and results. A super admin manages vendors and the global question bank.

Core flows:

- **Coding tests** — Java, C++, C, Python. Submissions run in a sandboxed worker.
- **MCQ tests** — aptitude, English, theory, SQL, system design.
- **Mixed tests** — coding + MCQ in one test.
- **Courses** — video + notes + gated module progress (HLS from private R2).
- **Contests, interviews, projects** — extra assessment types on the same tenant model.

Roles: `super_admin`, `vendor_admin`, `student`.

---

## 2. High-level architecture

```
React frontend (plain JS)
        │
        ▼
Express API (Node.js)  ── JWT auth ── tenant middleware (vendorId scoping)
        │
        ├── MongoDB (models: User, Vendor, Test, Question*, Result, Course*, ...)
        ├── Redis + Bull queues (code exec, evaluation, HLS transcode)
        └── Workers (separate processes, same codebase)
```

Key point: the API never runs user code. It enqueues a job; a worker picks it up, runs it in a temp dir with timeouts, and writes the result back.

---

## 3. Multi-tenancy

`backend/middleware/tenant.js` is the choke point.

- `super_admin` → no vendor filter.
- `vendor_admin` / `student` → must have `vendorId` on the JWT; it is copied to `req.vendorId`.
- Every vendor-scoped query must filter by that `vendorId`. No exceptions.

Rule I follow: if a route touches vendor data, it goes through `tenantMiddleware` and the query includes `vendorId`. Missing that is a data-leak bug.

---

## 4. Code execution (the risky part)

Files: `backend/routes/codeExecution.js`, `backend/workers/codeExecutionWorker.js`, `backend/config/codeExecution.js`, `backend/config/bullQueueNames.js`.

Design decisions:

- **Two queues** — `CODE_EXECUTION_SINGLE` (one test case, fast feedback in the editor) and `CODE_EXECUTION_BATCH` (full submission, many cases).
- **Polling, not pub/sub** — the HTTP handler polls Redis for job state because Bull pub/sub was unreliable on ElastiCache Serverless.
- **Backpressure** — if waiting jobs exceed `MAX_QUEUE_WAITING_*`, return 429/503 instead of hanging.
- **Binary resolution at boot** — `resolveBin()` finds `python3`, `javac`, `java`, `gcc`, `g++` once, to avoid PATH/ENOENT flakiness in containers.
- **Limits** — `EXECUTION_TIMEOUT`, `MAX_OUTPUT_SIZE` (64 KB), temp file cleanup every 2 min, files older than 5 min deleted.

Failure modes I watch for:

- Worker down → jobs pile up → API should 503 fast, not timeout after 30s.
- Redis down → queue errors are logged, but the API process stays up (see `server.js` unhandledRejection handler).
- Malicious code → mitigated by timeout + output cap + temp isolation, but this is not a hard security boundary. Do not run untrusted code without stronger sandboxing.

---

## 5. Courses (video + gating)

Spec: `docs/superpowers/specs/2026-08-12-courses-design.md`.

- Videos uploaded to private R2, transcoded to HLS by `hlsTranscodeWorker`.
- Playback uses short-lived signed URLs; m3u8 is rewritten per request.
- Progress: client sends heartbeats every ~10–15s; server clamps deltas and merges watched intervals. Module N+1 unlocks only when N is complete (≥90% unique watched seconds + optional quiz submitted).
- Server enforces locks on playback/quiz/content APIs. Never trust the client’s “completed” flag.

---

## 6. Scalability rules I work under

From `.cursor/rules/scalability-performance.mdc` (always on in this repo):

- No N+1 queries. Batch reads/writes.
- Index every frequent filter/sort key.
- Paginate every list endpoint. Hard max page size.
- Heavy work (grading, HLS, emails, reports) goes to queues, not the request thread.
- Cache hot, stable reads with clear TTLs.
- Timeouts and rate limits on public/auth endpoints.
- Lean payloads — return only what the client needs.

Quick check before finishing any change: will this still work at 10x traffic? Are list paths paginated and indexed? Any query inside a loop?

---

## 7. Ops notes

- PM2 in production (`ecosystem.config.js`), Docker/Podman for workers (`Dockerfile.worker`).
- Graceful shutdown: drain HTTP → close Bull queues → close Mongo. `server.js` has a single SIGTERM/SIGINT handler and writes a shutdown audit log.
- Redis connection errors are treated as infrastructure flakiness and logged, not fatal (unless `EXIT_ON_UNHANDLED_REJECTION=true`).

---

## 8. What I would not do again / open questions

- The code-exec sandbox is “good enough for students,” not hostile-user grade. If this ever runs truly untrusted code, it needs gVisor/Firecracker-level isolation.
- Polling Redis for job state works but adds latency. Revisit if Bull’s newer versions fix ElastiCache Serverless pub/sub.
- Tenant scoping is enforced by convention + middleware. A bug that forgets `vendorId` in a new route is a cross-tenant leak. Consider a Mongoose plugin that forces the filter.

---

*Personal notes. Not for external submission.*
