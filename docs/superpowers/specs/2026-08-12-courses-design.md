# Courses Feature — Design Spec

**Date:** 2026-08-12  
**Status:** Approved for staged implementation  
**Architecture:** Platform catalog + allocation + enrollment + progress (Approach 1)

## Goals

Multi-tenant courses: Super Admin builds curriculum; vendors allocate to students; students complete modules with gated progress, HLS video (private R2), notes (PDF + rich HTML), and optional module tests from the existing question bank.

## Locked decisions

| Topic | Choice |
|--------|--------|
| Delivery | Master architecture; implement in 6 phases |
| Video | Private R2 + ffmpeg HLS worker + signed/proxied playback |
| Watch complete | ≥90% unique watched seconds (seeking allowed) |
| Module unlock | All lectures complete + module test submitted once if present (no pass %) |
| Quiz optional | Yes — no quiz → unlock on lectures alone |
| Vendors | Allocate + dueAt/visibility only (no curriculum edit) |
| Module tests | Link existing Test or assemble new from question bank |

## Data model

- `Course` — global catalog (`draft` \| `published` \| `archived`)
- `CourseModule` — ordered under course; optional `testId`
- `CourseLecture` — video metadata, `notesPdfKey`, `notesHtml`
- `CourseVendorAllocation` — course ↔ vendor + dueAt/visibility
- `CourseEnrollment` — student assignment (classroom \| individual)
- `CourseProgress` — per enrollment watch intervals, lecture/module completion, overall %

## Media

- Private R2 keys under `courses/{courseId}/lectures/{lectureId}/…`
- Presigned PUT for uploads; Bull HLS transcode worker
- Playback: authz + short-lived media token; m3u8 rewritten with short-lived signed segment URLs
- Notes PDF via signed GET; HTML via API (sanitized)

## Progress & gating

- Heartbeats every ~10–15s; server clamps deltas; merge watched intervals
- Module 1 open on enroll; N+1 locked until N complete
- Server enforces locks on playback/quiz/content APIs

## Roles & APIs

- `/api/super-admin/courses` — CMS, media, quiz attach, vendor allocate
- `/api/vendor-admin/courses` — list, due/visibility, assign, progress
- `/api/student/courses` — learn, playback, heartbeat, quiz, progress

## Phases

1. Curriculum CMS (models + super-admin CRUD UI)
2. Media pipeline (upload, HLS, signed playback)
3. Progress + gating
4. Module assessments (Test/Result reuse)
5. Vendor allocation + student assign
6. Student learning UI + progress charts

## Ops notes

- **ffmpeg + ffprobe** must be installed on the API/worker host for HLS transcoding.
- Redis required for the `{cp}hls-transcode` Bull queue (loaded in-process with the API; or `npm run worker:hls`).
- Course objects are private in R2; use signed PUT/GET. Optional `PUBLIC_API_ORIGIN` for HLS playlist rewrite across domains.
- Optional `COURSE_MEDIA_JWT_SECRET` (falls back to `JWT_SECRET`).

## Non-goals (v1)

- Vendor curriculum editing
- Pass-percentage unlock gates
- Cloudflare Stream
- Certificates / certificates marketplace
