# SmartED Testing & Load Benchmark Report

This document summarizes the automated security, AI reliability, build, rule linting, and concurrency load tests executed on **SmartED**.

---

## 1. Automated Verification Commands

```bash
# TypeScript type-checking
npm run lint

# Vite production build
npm run build

# Security & AI unit/integration suite
npx tsx --test tests/security-and-ai.test.ts

# Firestore rules static security lint
npx eslint firestore.rules

# Repeatable multi-user load test
npx tsx scripts/load-test.ts
```

---

## 2. Unit & Security Integration Suite (`tests/security-and-ai.test.ts`)

Result: **8 / 8 tests passed (0 failed)** in `1740ms`:

1. `verifyFirebaseIdToken` validates legitimate RS256 token signatures and platform admin identity.
2. `verifyFirebaseIdToken` rejects expired, wrong-audience, tampered, `alg=none`/algorithm-confused, and unverified (`email_verified: false`) tokens.
3. `UsageAndRateLimiter` enforces `5 lessons/day`, deduplicates repeat lesson keys within the same UTC day, rolls back slots on failed AI generation, and enforces sliding-window rate limits.
4. `isSafeProviderBaseUrl` allows HTTPS and loopback HTTP endpoints while blocking SSRF targets (`169.254.169.254`, `metadata.google.internal`, `file://`, credential-embedded URLs, non-loopback `http://`).
5. AI runtime validators (`validateLessonPayload`, `validateTutorResponse`, `validateAssessmentResult`, `validateEvaluationResult`) accept valid structured payloads and throw `502 INVALID_AI_STRUCTURE` on malformed outputs.
6. `selectProviderCandidates` optimizes model selection per task (`evaluate` -> `gemini-3.1-flash-lite` first; `lesson`/`tutor`/`assessment` -> `gemini-4-hydrogen` first), respects 45s cooldowns after failures, and throws `503 PROVIDER_UNCONFIGURED` rather than silently substituting Demo Mode on explicit live selections.
7. `normalizeGeminiError` maps rate limits, timeouts, and upstream failures to safe user messages without leaking raw upstream text or secrets.
8. Express route guard tests confirm unauthenticated requests to `/api/ai/usage`, `/api/ai/lesson`, `/api/ai/tutor`, `/api/ai/assessment`, and `/api/ai/evaluate` return `401 AUTH_REQUIRED`, while `/api/ai/status` remains publicly accessible.

---

## 3. Repeatable Concurrency Load Benchmark (`scripts/load-test.ts`)

Tested against an isolated Express instance over HTTP on `127.0.0.1` exercising health checks, LRU cached lesson delivery (`GET /api/bench/cached-lesson`), and unauthenticated AI route rejection (`POST /api/ai/lesson` returning `401` before any LLM call).

| Scenario | Concurrent Users | Total Reqs | Expected Status | Unexpected Errors | Throughput (req/s) | p50 (ms) | p95 (ms) | Max (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /api/health` | 10 | 50 | 50/50 | 0 | 295.4 | 13.47 | 97.21 | 110.51 |
| `GET /api/bench/cached-lesson` | 10 | 50 | 50/50 | 0 | 526.5 | 15.74 | 23.36 | 26.15 |
| `POST /api/ai/lesson (unauth 401 guard)` | 10 | 50 | 50/50 | 0 | 442.3 | 16.19 | 40.66 | 42.27 |
| `GET /api/health` | 20 | 100 | 100/100 | 0 | 770.5 | 15.63 | 60.20 | 90.90 |
| `GET /api/bench/cached-lesson` | 20 | 100 | 100/100 | 0 | 604.8 | 29.15 | 51.81 | 71.01 |
| `POST /api/ai/lesson (unauth 401 guard)` | 20 | 100 | 100/100 | 0 | 695.9 | 26.31 | 31.16 | 38.32 |
| `GET /api/health` | 50 | 250 | 250/250 | 0 | 991.7 | 17.57 | 155.25 | 202.59 |
| `GET /api/bench/cached-lesson` | 50 | 250 | 250/250 | 0 | 829.8 | 45.07 | 79.53 | 222.95 |
| `POST /api/ai/lesson (unauth 401 guard)` | 50 | 250 | 250/250 | 0 | 813.9 | 54.35 | 78.42 | 227.34 |
| `GET /api/health` | 100 | 500 | 500/500 | 0 | 1082.7 | 16.21 | 268.61 | 341.56 |
| `GET /api/bench/cached-lesson` | 100 | 500 | 500/500 | 0 | 1073.1 | 92.36 | 103.31 | 146.08 |
| `POST /api/ai/lesson (unauth 401 guard)` | 100 | 500 | 500/500 | 0 | 987.6 | 95.74 | 110.30 | 302.82 |

**Observations**:
- **0 unexpected errors** across all **2,700 benchmark requests** spanning 10, 20, 50, and 100 concurrent virtual users.
- Cached lesson reads sustained **1,073.1 req/s** at 100 concurrent users with a `92.36ms` median (`p95: 103.31ms`).
- Unauthenticated `POST /api/ai/lesson` requests were rejected early in middleware at **987.6 req/s** without incurring AI inference costs.
