import express from 'express';
import { ProviderRequestError } from '../ai/errors.ts';
import { buildLessonCacheKey, sharedLessonCache } from '../ai/lessonCache.ts';
import {
  executeWithProviderFallback,
  getProviderStatus,
  resolveProvider,
} from '../ai/provider.ts';
import {
  type AuthenticatedRequest,
  requireFirebaseAuth,
} from '../middleware/auth.ts';
import {
  getConfiguredDailyLessonLimit,
  usageAndRateLimiter,
} from '../services/usageLimiter.ts';
import type {
  AssessmentDifficulty,
  KnowledgeLevel,
  ProviderPreference,
  QuestionType,
  TutorMode,
} from '../types.ts';

const VALID_LEVELS = new Set<KnowledgeLevel>(['Beginner', 'Intermediate', 'Advanced']);
const VALID_DIFFICULTIES = new Set<AssessmentDifficulty>(['Easy', 'Medium', 'Hard']);
const VALID_MODES = new Set<TutorMode>([
  'standard',
  'simplify',
  'analogy',
  'step-by-step',
  'challenge',
]);
const VALID_QUESTION_TYPES = new Set<QuestionType>([
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
]);
const VALID_PREFERENCES = new Set<ProviderPreference>([
  'auto',
  'gemini-hydrogen',
  'gemini-lite',
  'open-compatible',
  'demo',
]);

function parsePreference(val: unknown): ProviderPreference {
  return typeof val === 'string' && VALID_PREFERENCES.has(val as ProviderPreference)
    ? (val as ProviderPreference)
    : 'auto';
}

function getClientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function enforceEndpointRateLimit(
  res: express.Response,
  scope: string,
  actorKey: string,
  maxRequests: number,
  windowMs = 60_000
): boolean {
  const verdict = usageAndRateLimiter.checkRateLimit(scope, actorKey, maxRequests, windowMs);
  if (!verdict.allowed) {
    res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
    res.status(429).json({
      error: `Too many requests in a short period. Please wait ${verdict.retryAfterSeconds}s and try again.`,
      code: 'RATE_LIMIT',
    });
    return false;
  }
  return true;
}

function handleRouteError(res: express.Response, err: unknown) {
  if (err instanceof ProviderRequestError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }
  console.error('[SmartEd AI Route Error]', err instanceof Error ? err.name : 'UnknownError');
  res.status(500).json({
    error: 'An unexpected server error occurred while processing your learning request.',
    code: 'INTERNAL_ERROR',
  });
}

export function createAIRouter(): express.Router {
  const router = express.Router();

  // Public non-sensitive capability metadata (rate-limited by IP)
  router.get('/status', (req, res) => {
    if (!enforceEndpointRateLimit(res, 'status', getClientIp(req), 120)) return;
    res.json({
      ...getProviderStatus(),
      dailyFreeLessonLimit: getConfiguredDailyLessonLimit(),
    });
  });

  // Protected: check verified user's server-enforced daily lesson allowance
  router.get('/usage', requireFirebaseAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    if (!enforceEndpointRateLimit(res, 'usage', uid, 60)) return;
    res.json(usageAndRateLimiter.getDailyUsage(uid));
  });

  // Protected: generate or retrieve a cached structured 9-section lesson (5/day free limit)
  router.post('/lesson', requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    if (!enforceEndpointRateLimit(res, 'lesson', uid, 12)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
      if (!topic || topic.length < 2 || topic.length > 200) {
        res.status(400).json({
          error: 'Please enter a topic between 2 and 200 characters.',
          code: 'INVALID_TOPIC',
        });
        return;
      }

      const level: KnowledgeLevel = VALID_LEVELS.has(body.level as KnowledgeLevel)
        ? (body.level as KnowledgeLevel)
        : 'Beginner';
      const language =
        typeof body.language === 'string' && body.language.trim()
          ? body.language.trim().slice(0, 60)
          : 'English';
      const objective =
        typeof body.objective === 'string' && body.objective.trim()
          ? body.objective.trim().slice(0, 300)
          : undefined;
      const preference = parsePreference(body.providerPreference);

      const primaryResolved = resolveProvider(preference, 'lesson');
      const providerScope = `${primaryResolved.adapter.id}:${primaryResolved.modelOverride ?? 'default'}`;
      const cacheKey = buildLessonCacheKey({
        topic,
        level,
        language,
        objective,
        providerScope,
      });

      const quotaKey = buildLessonCacheKey({
        topic,
        level,
        language,
        objective,
        providerScope: 'daily-quota',
      });

      const reservation = usageAndRateLimiter.reserveDailyLessonSlot(uid, quotaKey);
      if (!reservation.allowed) {
        res.status(429).json({
          error: `Daily free limit reached (${reservation.snapshot.dailyLimit} lessons per day). Your allowance resets at ${new Date(
            reservation.snapshot.resetAtIso
          ).toUTCString()}.`,
          code: 'DAILY_LIMIT_REACHED',
          usage: reservation.snapshot,
        });
        return;
      }

      let result;
      let cacheHit = false;
      try {
        const cachedOrFresh = await sharedLessonCache.getOrGenerate(cacheKey, async () =>
          executeWithProviderFallback(preference, 'lesson', (candidate) =>
            candidate.adapter.generateLesson({
              topic,
              level,
              language,
              objective,
              modelOverride: candidate.modelOverride,
            })
          )
        );
        result = cachedOrFresh.result;
        cacheHit = cachedOrFresh.cacheHit;
      } catch (genErr) {
        if (!reservation.alreadyCountedToday) {
          usageAndRateLimiter.releaseDailyLessonSlot(uid, quotaKey);
        }
        throw genErr;
      }

      res.setHeader('X-SmartEd-Cache', cacheHit ? 'HIT' : 'MISS');
      res.json({
        ...result,
        usage: usageAndRateLimiter.getDailyUsage(uid),
      });
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  // Protected: context-aware AI tutor turn
  router.post('/tutor', requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    if (!enforceEndpointRateLimit(res, 'tutor', uid, 25)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 2000) {
        res.status(400).json({
          error: 'Please provide a question between 1 and 2000 characters.',
          code: 'INVALID_MESSAGE',
        });
        return;
      }

      const mode: TutorMode = VALID_MODES.has(body.mode as TutorMode)
        ? (body.mode as TutorMode)
        : 'standard';

      const rawHistory = Array.isArray(body.history) ? body.history : [];
      const history = rawHistory
        .filter(
          (item): item is { role: 'user' | 'tutor'; content: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            ((item as { role?: unknown }).role === 'user' ||
              (item as { role?: unknown }).role === 'tutor') &&
            typeof (item as { content?: unknown }).content === 'string'
        )
        .slice(-10)
        .map((turn) => ({
          role: turn.role,
          content: turn.content.slice(0, 2000),
        }));

      const rawCtx =
        body.lessonContext && typeof body.lessonContext === 'object'
          ? (body.lessonContext as Record<string, unknown>)
          : undefined;

      const lessonContext =
        rawCtx && typeof rawCtx.topic === 'string' && rawCtx.topic.trim()
          ? {
              topic: rawCtx.topic.trim().slice(0, 200),
              level: VALID_LEVELS.has(rawCtx.level as KnowledgeLevel)
                ? (rawCtx.level as KnowledgeLevel)
                : 'Beginner',
              language:
                typeof rawCtx.language === 'string'
                  ? rawCtx.language.trim().slice(0, 60)
                  : undefined,
              activeSectionTitle:
                typeof rawCtx.activeSectionTitle === 'string'
                  ? rawCtx.activeSectionTitle.trim().slice(0, 120)
                  : undefined,
              activeSectionContent:
                typeof rawCtx.activeSectionContent === 'string'
                  ? rawCtx.activeSectionContent.slice(0, 2000)
                  : undefined,
              learningObjectives: Array.isArray(rawCtx.learningObjectives)
                ? rawCtx.learningObjectives
                    .filter((x): x is string => typeof x === 'string')
                    .slice(0, 6)
                    .map((x) => x.slice(0, 300))
                : undefined,
            }
          : undefined;

      const preference = parsePreference(body.providerPreference);
      const result = await executeWithProviderFallback(preference, 'tutor', (candidate) =>
        candidate.adapter.respondAsTutor({
          message,
          history,
          mode,
          lessonContext,
          providerPreference: preference,
          modelOverride: candidate.modelOverride,
        })
      );

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  // Protected: generate topic/lesson-grounded assessment questions
  router.post('/assessment', requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    if (!enforceEndpointRateLimit(res, 'assessment', uid, 12)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
      if (!topic || topic.length < 2 || topic.length > 200) {
        res.status(400).json({
          error: 'Please specify a valid topic between 2 and 200 characters.',
          code: 'INVALID_TOPIC',
        });
        return;
      }

      const level: KnowledgeLevel = VALID_LEVELS.has(body.level as KnowledgeLevel)
        ? (body.level as KnowledgeLevel)
        : 'Beginner';
      const difficulty: AssessmentDifficulty = VALID_DIFFICULTIES.has(
        body.difficulty as AssessmentDifficulty
      )
        ? (body.difficulty as AssessmentDifficulty)
        : 'Medium';
      const questionCount = Math.max(
        1,
        Math.min(12, Number.parseInt(String(body.questionCount ?? 5), 10) || 5)
      );

      const rawTypes = Array.isArray(body.questionTypes) ? body.questionTypes : [];
      const questionTypes = rawTypes.filter((t): t is QuestionType =>
        VALID_QUESTION_TYPES.has(t as QuestionType)
      );
      const finalTypes: QuestionType[] =
        questionTypes.length > 0
          ? questionTypes
          : ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'];

      const language =
        typeof body.language === 'string' && body.language.trim()
          ? body.language.trim().slice(0, 60)
          : 'English';
      const lessonContextSummary =
        typeof body.lessonContextSummary === 'string'
          ? body.lessonContextSummary.slice(0, 1800)
          : undefined;
      const preference = parsePreference(body.providerPreference);

      const result = await executeWithProviderFallback(preference, 'assessment', (candidate) =>
        candidate.adapter.generateAssessment({
          topic,
          level,
          difficulty,
          questionCount,
          questionTypes: finalTypes,
          language,
          lessonContextSummary,
          providerPreference: preference,
          modelOverride: candidate.modelOverride,
        })
      );

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  // Protected: evaluate short/fill-in-the-blank answer
  router.post('/evaluate', requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.authUser!.uid;
    if (!enforceEndpointRateLimit(res, 'evaluate', uid, 40)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const questionPrompt =
        typeof body.questionPrompt === 'string' ? body.questionPrompt.trim().slice(0, 1000) : '';
      const expectedAnswer =
        typeof body.expectedAnswer === 'string' ? body.expectedAnswer.trim().slice(0, 600) : '';
      const userAnswer =
        typeof body.userAnswer === 'string' ? body.userAnswer.trim().slice(0, 1500) : '';
      const topic =
        typeof body.topic === 'string' && body.topic.trim()
          ? body.topic.trim().slice(0, 200)
          : 'General';
      const questionType: QuestionType = VALID_QUESTION_TYPES.has(
        body.questionType as QuestionType
      )
        ? (body.questionType as QuestionType)
        : 'short_answer';
      const acceptedKeywords = Array.isArray(body.acceptedKeywords)
        ? body.acceptedKeywords
            .filter((k): k is string => typeof k === 'string')
            .slice(0, 10)
            .map((k) => k.slice(0, 120))
        : undefined;

      if (!questionPrompt || !expectedAnswer) {
        res.status(400).json({
          error: 'Missing question evaluation payload.',
          code: 'INVALID_EVALUATION',
        });
        return;
      }

      const preference = parsePreference(body.providerPreference);
      const result = await executeWithProviderFallback(preference, 'evaluate', (candidate) =>
        candidate.adapter.evaluateShortAnswer({
          questionPrompt,
          questionType,
          expectedAnswer,
          acceptedKeywords,
          userAnswer,
          topic,
          providerPreference: preference,
        })
      );

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  return router;
}
