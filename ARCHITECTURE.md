# SmartED Architecture

This document outlines the technical architecture of **SmartED** (by **ST Group**, Founder: **John Nikson**).

---

## High-Level System Overview

```text
+-------------------------------------------------------------------+
|                     React 19 + Vite Frontend                      |
|  LandingPage -> Auth Gate -> Sidebar Workspace                    |
|  (Home, Learn, My Learning, AI Tutor, Assessments, Progress,      |
|   Growth Analytics [Admin], Settings, Onboarding, Feedback)       |
+---------------------+-----------------------------+---------------+
                      | HTTPS + Firebase ID Token   | Firebase SDK
                      v                             v
+---------------------------------------+  +------------------------+
|      Express 4 Backend (Port 3000)    |  |   Cloud Firestore &    |
|  - Security Headers & 512kb JSON Cap  |  |   Firebase Auth        |
|  - RS256 ID Token Verifier            |  |   (splendid-app-cc62s) |
|  - Sliding-Window Rate Limiter        |  |   Strict Owner/Admin   |
|  - Daily 5-Lesson Quota (w/ Rollback) |  |   firestore.rules      |
|  - Shared Lesson Cache (LRU + Disk)   |  +------------------------+
|  - Provider Router + Validators       |
+---+---------------+---------------+---+
    |               |               |
    v               v               v
Gemini 4 Hydrogen  Gemini 3.1    OpenAI-Compatible   Demo Provider
(Balanced)         Flash Lite    (SSRF-Guarded)      (Explicit Only)
```

---

## Frontend Architecture (`/src`)

- **Entry & Routing (`src/App.tsx`)**: Manages Google Sign-In state (`onAuthStateChanged`), automatic landing-page-to-workspace transition, offline/online local fallback synchronization, onboarding modal (`OnboardingModal.tsx`), legal/support modal (`LegalSupportModal.tsx`), and learner feedback modal (`FeedbackModal.tsx`).
- **Core Learning Modules (`src/components/`)**:
  - `LandingPage.tsx`: Brand hero featuring the SRV book-and-brain emblem, pedagogical overview, founder attribution, and Google Sign-In CTA.
  - `LearnView.tsx`: 9-section structured lesson reader with completion tracking, section navigation, inline knowledge checks, and completion celebration animation.
  - `AITutorView.tsx`: Multi-mode personal AI teacher (`standard`, `simplify`, `analogy`, `step-by-step`, `challenge`) aware of the learner's active lesson section and objectives.
  - `AssessmentView.tsx`: Customizable quiz generator grounded in the studied lesson's objectives, core concepts, and terminology, with objective + AI short-answer evaluation and mistake analysis.
  - `MyLearningView.tsx`, `ProgressView.tsx`, `SettingsView.tsx`, `GrowthView.tsx`: Saved library, topic/mastery analytics, model/quota settings, and admin-only platform growth telemetry.
- **API & Sync Layer (`src/services/`)**:
  - `api.ts`: Attaches `Authorization: Bearer <idToken>` automatically on protected backend calls with a single forced-refresh retry on `401`.
  - `firestoreSync.ts`: Real-time Firestore persistence for user profiles, lessons, tutor conversations, assessments, daily activity, admin analytics, and immutable learner feedback submissions.

---

## Backend Architecture (`/server` & `/server.ts`)

1. **HTTP Server (`server.ts`)**:
   - Disables `x-powered-by`, enforces `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`, preserves AI Studio iframe preview compatibility, caps JSON payloads at `512kb`, and traps `SyntaxError` JSON body errors cleanly (`400 INVALID_JSON`).
   - Serves Vite middleware in development and `dist/` static assets in production on port `3000`.
2. **Authentication Middleware (`server/middleware/auth.ts`)**:
   - Dependency-free RS256 Firebase ID token verification using Node `node:crypto` and Google's public x509 certificates (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`), cached according to HTTP `Cache-Control: max-age` headers with automatic refresh on unknown `kid`.
   - Validates signature (`RS256`), `iss`, `aud`, `exp`, `iat`, `auth_time`, non-empty `sub`, and `email_verified === true`.
3. **Quota & Rate Limiting (`server/services/usageLimiter.ts`)**:
   - Sliding-window per-endpoint rate limiting (`lesson`: 12/min, `tutor`: 25/min, `assessment`: 12/min, `evaluate`: 40/min, `usage`: 60/min, `status`: 120/min).
   - Daily unique lesson allowance (`DAILY_FREE_LESSON_LIMIT`, default `5`) keyed by `uid + UTC date` and persisted to `.smarted-cache/usage.json`. Repeated requests for an already generated topic key today do not double-charge the user, and upstream generation errors automatically release the reserved slot (`releaseDailyLessonSlot`).
4. **Shared Lesson Cache (`server/ai/lessonCache.ts`)**:
   - LRU in-memory + disk-persisted cache (`.smarted-cache/lessons.json`) with in-flight request deduplication (`getOrGenerate`) so concurrent learners requesting the same topic share one upstream inference call.
5. **AI Provider Orchestration & Validation (`server/ai/`)**:
   - `provider.ts`: Task-aware candidate ordering (`evaluate` prioritizes `gemini-3.1-flash-lite` for speed/cost; `lesson`, `tutor`, `assessment` prioritize `gemini-4-hydrogen`), transient 45-second failure cooldown tracking, and multi-candidate failover without silently faking live AI failures with Demo Mode.
   - `geminiProvider.ts`: Enforces per-task timeouts (`45s` lesson, `30s` assessment, `25s` tutor, `15s` evaluate), 3-attempt jittered exponential backoff retries, deterministic exact-match fast-path for short answers, and sanitized `normalizeGeminiError`.
   - `openAiCompatibleProvider.ts`: Enforces `isSafeProviderBaseUrl()` SSRF protection, `AbortController` timeouts, and error sanitization.
   - `validators.ts`: Runtime structural validation on all parsed AI responses (`validateLessonPayload`, `validateTutorResponse`, `validateAssessmentResult`, `validateEvaluationResult`).

---

## Horizontal Scaling Notes

- Currently, `.smarted-cache/lessons.json` and `.smarted-cache/usage.json` use local disk + in-memory storage, ideal for single-instance Node/Cloud Run deployments.
- For multi-instance auto-scaling beyond one container, replace the backing stores in `server/ai/lessonCache.ts` and `server/services/usageLimiter.ts` with Redis or Firestore atomic transactions while keeping the same interfaces.
