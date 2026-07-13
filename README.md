# Nerdified — API Server

Backend for **Nerdified**, a live, instructor-led online learning platform.
Built with **NestJS 9**, **Prisma 5**, and **PostgreSQL**. Handles auth, courses
and enrollment, live scheduling and video, real-time messaging, notifications,
payments and tutor payouts, and completion certificates.

> The Next.js frontend lives in the separate `nerdified-client` repo.

---

## Tech stack

- **NestJS 9** (REST + WebSockets) / **TypeScript**
- **Prisma 5** ORM over **PostgreSQL**
- **Passport JWT** — access + refresh tokens in httpOnly cookies
- **socket.io** (`@nestjs/websockets`) — real-time messaging
- **@nestjs/schedule** — cron jobs (class reminders)
- **LiveKit** (`livekit-server-sdk`) — live video tokens + session recording (egress)
- **Cloudinary** — image and certificate storage
- **Brevo** — transactional email
- **Paystack** — payment verification + tutor payout transfers
- **pdfkit** — certificate PDF generation

---

## Features

### Authentication & authorization
- Email/password sign-up and unified sign-in for **students, tutors, and admins**.
- **Google OAuth** sign-in (authorization-code flow) — verified Google emails are
  auto-verified; new tutors still require admin approval.
- **Email verification** — signed-link verification email on sign-up, resend
  endpoint, verified status surfaced on `GET /auth/me`.
- JWT access + refresh tokens delivered as httpOnly cookies; role-aware
  `auth_session` cookie for frontend middleware.
- **Role-based access control** via `RolesGuard` + `@Roles()` — student, tutor,
  and admin routes are enforced server-side (not just by URL).

### Courses & enrollment
- Course CRUD with draft/publish, group and one-on-one delivery modes, dual
  pricing, curriculum/outcomes, and Cloudinary cover images.
- Enrollment with **server-side Paystack payment verification** — price is
  derived from the course, the transaction is verified against Paystack, and the
  payment reference is unique (replay/idempotency protection).

### Live sessions & scheduling
- Tutor availability, group and 1:1 sessions, student bookings, timezone-aware
  scheduling, and suggested slots.
- **Reschedule** and **add-session** requests with admin approval.
- **LiveKit live classroom** — per-participant join tokens.
- **Session recording** — LiveKit room-composite egress to S3-compatible storage
  (AWS S3, Cloudflare R2, Backblaze B2, MinIO), started/stopped by the tutor;
  the recording URL is saved and students are notified.

### Real-time messaging
- **socket.io gateway** authenticated by the access-token cookie.
- **Direct messages** (student ↔ tutor) with live delivery and read receipts.
- **Course chat rooms** with tutor announcements, membership-checked joins, and
  sender-name enrichment.
- Conversation-partners endpoint powering the chat UI.

### Notifications & email
- In-app notification feed (enrollment, direct messages, schedule changes,
  payouts, certificates, class reminders) with unread counts.
- Transactional email via Brevo (enrollment confirmations, schedule changes,
  payout updates, verification, class reminders) — best-effort, never blocks the
  triggering action.
- **Automated class reminders** — a cron job (every 5 min) notifies the tutor and
  booked students of sessions starting within `CLASS_REMINDER_LEAD_MINUTES`
  (default 60), in-app + email, deduplicated per session.

### Payments & tutor payouts
- Commission-aware balance engine (`PLATFORM_COMMISSION_RATE`, default 15%)
  computing gross/net/paid-out/pending/available balances.
- Admin payout creation and management; tutor payout history.
- **Automated disbursement via Paystack Transfers** — tutors save a bank account
  (verified + a transfer recipient created), admins disburse a payout, and an
  outcome is confirmed via a **signature-verified webhook**
  (`transfer.success` → completed, `transfer.failed`/`reversed` → failed).

### Certificates
- Branded **completion-certificate PDFs** generated with pdfkit, stored on
  Cloudinary, and auto-issued when an admin marks a course's enrollments
  `FINISHED`. Idempotent; students are notified and can download.

### Other
- Reviews, wishlist, and a blog module with Cloudinary images.
- Admin: tutor approval, course/enrollment management, moderation, payouts, and
  student management.

---

## Getting started

### Prerequisites
- Node.js 18+
- A PostgreSQL database

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in the values (see the table below).
At minimum you need `DATABASE_URL`, `AT_SECRET_KEY`, and `RT_SECRET_KEY`; the
rest gate optional integrations and degrade gracefully when unset.

### Database

```bash
npx prisma migrate deploy   # apply migrations
npx prisma generate         # generate the client (also runs on postinstall/build)
```

### Run

```bash
npm run start:dev    # watch mode (http://localhost:3100)
npm run start:prod   # production (after npm run build)
```

The API is served under the `/api` prefix (e.g. `http://localhost:3100/api`).

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `AT_SECRET_KEY` / `RT_SECRET_KEY` | JWT access/refresh signing secrets (**required**, 32+ chars) |
| `FRONTEND_BASE_URL` | Frontend origin(s) for CORS and email/OAuth redirects |
| `PORT` | API port (default `3100`) |
| `CLOUD_NAME` / `API_KEY` / `API_SECRET` | Cloudinary (images + certificates) |
| `LIVEKIT_WS_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit live video + recording |
| `PAYSTACK_SECRET_KEY` | Paystack — payment verification **and** payout transfers |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Brevo transactional email |
| `PLATFORM_COMMISSION_RATE` | Payout commission fraction 0–1 (default `0.15`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth sign-in |
| `CLASS_REMINDER_LEAD_MINUTES` | Minutes before a session to send reminders (default `60`) |
| `RECORDING_S3_KEY_ID` / `_SECRET` / `_BUCKET` / `_REGION` | S3-compatible storage for recordings |
| `RECORDING_S3_ENDPOINT` | Custom S3 endpoint (R2/B2/MinIO); omit for AWS |
| `RECORDING_PUBLIC_BASE_URL` | Optional public base URL for recording links |

Optional integrations (Cloudinary, LiveKit, Paystack, Brevo, Google, recording)
are **config-gated**: if unset, the related feature is disabled with a clear
message and the rest of the app runs normally.

### Webhooks
For asynchronous payout confirmation, add a Paystack webhook pointing at:

```
<API_BASE_URL>/api/payouts/webhook/paystack
```

(`transfer.success` / `transfer.failed` / `transfer.reversed`). The signature is
verified (HMAC-SHA512) against the raw request body.

---

## Admin account

```bash
npm run create-admin
```

Creates a SUPER admin account (skips if one with that email already exists).

---

## Testing

```bash
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # coverage
```
