# SmartED Security Architecture & Audit Report

This document details the security controls implemented across **SmartED** (ST Group) across backend authentication, AI integrations, Firestore access control, input validation, and dependency hygiene.

---

## 1. Authentication & Token Verification (`server/middleware/auth.ts`)

- All protected AI endpoints (`GET /api/ai/usage`, `POST /api/ai/lesson`, `POST /api/ai/tutor`, `POST /api/ai/assessment`, `POST /api/ai/evaluate`) require a valid Firebase ID token in `Authorization: Bearer <token>`.
- Verification uses pure Node `node:crypto` RS256 verification against Google's official x509 certificate endpoint, eliminating `firebase-admin` service-account IAM dependencies on Starter-tier environments.
- Strict claim checks enforced:
  - Header algorithm must be `RS256` (`alg=none` or HS256 confusion rejected).
  - Certificate `kid` must match a valid Google x509 key (with automatic cache refresh on key rotation).
  - `iss` must equal `https://securetoken.google.com/splendid-app-cc62s`.
  - `aud` must equal `splendid-app-cc62s`.
  - `exp` must be in the future; `iat` and `auth_time` must not be in the future (60s clock skew tolerance).
  - `sub` must be a non-empty UID and `email_verified` must be `true`.

---

## 2. Authorization & Cloud Firestore Rules (`firestore.rules`)

- **Default Deny**: Global `match /{document=**} { allow read, write: if false; }`.
- **Identity & Ownership**: Users can only read/write their own `/users/{userId}` document and subcollections (`lessons`, `conversations`, `assessments`, `activity`) when `request.auth.uid == userId` and `email_verified == true`.
- **Privilege Escalation Prevention**: Users cannot promote themselves to `role: 'admin'` or overwrite immutable audit fields (`uid`, `email`, `createdAt`, or assessment history).
- **Immutable Feedback (`/feedback/{feedbackId}`)**: Verified users may create feedback (`createdAt == request.time`, validated integer ratings `1..5` and allowed categories), read their own submissions, and cannot tamper with past records (`allow update: if false`).
- **Rule Linting & Deployment**: Verified clean with `npx eslint firestore.rules` (0 errors) and deployed to Firestore database `ai-studio-smartedbystgroup-e98fc6c6-8643-463a-ae99-172b873cc17a`.

---

## 3. Abuse Prevention, Quotas & SSRF Protection

- **Daily Free Lesson Quota (`server/services/usageLimiter.ts`)**: Enforces `DAILY_FREE_LESSON_LIMIT` (default `5`) per verified UID per UTC day. Repeat requests for the same lesson key today do not consume extra slots, and failed AI generations atomically release the reserved slot.
- **Endpoint Rate Limiting**: Sliding-window limiters guard against burst abuse (`12/min` lesson & assessment, `25/min` tutor, `40/min` evaluation, `60/min` usage, `120/min` public status).
- **SSRF Guard (`server/ai/openAiCompatibleProvider.ts`)**: `isSafeProviderBaseUrl()` permits only `https:` URLs (or explicit loopback `http://localhost` / `http://127.0.0.1` / `http://[::1]`) and blocks link-local metadata endpoints (`169.254.169.254`), `.internal` domains, and embedded URL credentials.

---

## 4. Input Validation, HTTP Hardening & Error Sanitization

- **HTTP Hardening (`server.ts`)**: Disables `x-powered-by`, enforces `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`, caps JSON bodies at `512kb`, and returns sanitized `400 INVALID_JSON` on malformed payloads.
- **Strict Length Bounds (`server/routes/ai.ts`)**: Validates and bounds topic length (`2..200`), tutor messages (`1..2000`), bounded conversation history (last 10 turns), and assessment counts (`1..12`).
- **AI Output Validation (`server/ai/validators.ts`)**: Every parsed LLM response passes runtime schema validation (`validateLessonPayload`, `validateTutorResponse`, `validateAssessmentResult`, `validateEvaluationResult`), returning `502 INVALID_AI_STRUCTURE` instead of corrupting UI state or Firestore documents.
- **Zero Secret/Stack Leakage**: `normalizeGeminiError()` and `handleRouteError()` map upstream SDK/HTTP errors to sanitized user-safe messages and never forward stack traces, raw SDK messages, or API keys to clients.

---

## 5. Dependency Audit Summary (`bun audit`)

Observed audit run on `bun audit v1.4.4`:
- **3 transitive advisories reported**:
  - `@grpc/grpc-js@1.9.16` (via `firebase > @firebase/firestore-compat > @firebase/firestore`): 1 high (`GHSA-m9gg-hp2v-232j`), 1 low (`GHSA-f596-whhp-79r4`) — client Firestore transport dependency inside official `firebase@13.3.0`.
  - `minimatch@11.0.8, 10.2.6` (via `eslint` and `@firebase/eslint-plugin-security-rules`): 1 moderate (`GHSA-g3hv-75wg-m249`) — dev/tooling dependency only, not shipped in runtime production bundles.
- No hardcoded credentials or client-exposed API secrets exist anywhere in `src/` or `server/`.
