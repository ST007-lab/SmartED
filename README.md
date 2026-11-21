# SmartED — Learn Anything. Understand Everything.

**SmartED** is an AI-powered universal learning platform developed by **ST Group** and founded by **John Nikson**. SmartED turns any educational topic into a structured 9-section interactive lesson, pairs learners with a context-aware AI Teacher across multiple explanation styles, generates lesson-grounded assessments, and syncs user progress across devices via Firebase Authentication and Cloud Firestore.

---

## Key Capabilities

- **9-Section Structured AI Lessons**: Every topic is organized into Topic Introduction, Learning Objectives, Fundamental Concepts, Step-by-Step Explanations, Practical Examples, Real-World Applications, Important Terminology, Summary, and interactive Knowledge-Check Questions with completion celebration.
- **Context-Aware AI Tutor**: Supports `standard`, `simplify`, `analogy`, `step-by-step`, and `challenge` pedagogical modes, grounded in the learner's active lesson section and objectives.
- **Interactive Assessments & Mistake Review**: Supports `multiple_choice`, `true_false`, `fill_blank`, and `short_answer` questions with instant objective grading, short-answer semantic evaluation, detailed explanations, and recommended review focus.
- **Multi-Provider AI Routing & Zero-Cost Lesson Caching**: Intelligent model selection across Gemini 4 Hydrogen (`gemini-4-hydrogen`), Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`), optional OpenAI-compatible endpoints, and clearly labeled Demonstration Mode, paired with an in-memory + disk-backed shared lesson cache (`.smarted-cache/lessons.json`) to eliminate duplicate inference calls.
- **Authentication, Quotas & Cloud Persistence**: Google Sign-In via Firebase Auth, server-side cryptographic RS256 ID-token verification on all AI endpoints, configurable daily free lesson allowance (`DAILY_FREE_LESSON_LIMIT=5`), strict Firestore security rules, learner feedback submission, and an Admin Growth Analytics dashboard.

---

## Quick Start

### 1. Prerequisites
- Node.js 20+ (tested on Node 22)
- `npm` or `bun`

### 2. Environment Variables
Copy `.env.example` to `.env` (never commit `.env` or secret keys):

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Recommended | Server-side Gemini API key (automatically injected in AI Studio). |
| `APP_URL` | Optional | Hosted application URL. |
| `PORT` | Optional | HTTP port (defaults to `3000`). |
| `DAILY_FREE_LESSON_LIMIT` | Optional | Free daily unique lesson generations per user (defaults to `5`). |
| `AI_COMPAT_BASE_URL` | Optional | Server-configured HTTPS (or loopback HTTP) OpenAI-compatible endpoint. |
| `AI_COMPAT_API_KEY` | Optional | Bearer key for custom OpenAI-compatible endpoint. |
| `AI_COMPAT_MODEL` | Optional | Model identifier for custom OpenAI-compatible endpoint. |

### 3. Install & Run

```bash
npm install
npm run dev
```

The Express + Vite full-stack server runs on `http://localhost:3000`.

### 4. Production Build & Start

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

---

## API Reference

All `/api/ai/*` endpoints except `/api/ai/status` require an `Authorization: Bearer <firebase_id_token>` header verified cryptographically on the backend.

| Endpoint | Auth | Rate Limit | Description |
| --- | --- | --- | --- |
| `GET /api/health` | Public | — | Server liveness check. |
| `GET /api/ai/status` | Public | 120 req/min (IP) | Non-sensitive provider availability & `dailyFreeLessonLimit`. |
| `GET /api/ai/usage` | Bearer ID Token | 60 req/min (UID) | Returns remaining daily free lesson allowance and UTC reset time. |
| `POST /api/ai/lesson` | Bearer ID Token | 12 req/min (UID) | Generates or retrieves a cached 9-section lesson (`X-SmartEd-Cache: HIT \| MISS`). Counts unique lessons against the daily free quota with rollback on failure. |
| `POST /api/ai/tutor` | Bearer ID Token | 25 req/min (UID) | Context-aware AI tutor turn grounded in active lesson section and objectives. |
| `POST /api/ai/assessment` | Bearer ID Token | 12 req/min (UID) | Generates lesson-grounded assessment questions. |
| `POST /api/ai/evaluate` | Bearer ID Token | 40 req/min (UID) | Grades `fill_blank` and `short_answer` responses (exact fast-path + LLM fallback). |

---

## Organization & Support

- **Product**: SmartED
- **Organization**: ST Group
- **Founder**: John Nikson
- **Support**: `sharmifrancis123@gmail.com`
