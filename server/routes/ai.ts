import express from 'express';
import { ProviderRequestError } from '../ai/geminiProvider.ts';
import { buildLessonCacheKey, sharedLessonCache } from '../ai/lessonCache.ts';
import { getProviderStatus, resolveProvider } from '../ai/provider.ts';
import type {
  AssessmentDifficulty,
  KnowledgeLevel,
  ProviderPreference,
  QuestionType,
  TutorMode,
} from '../types.ts';

const UNCACHED_WINDOW_MS = 60_000;
const MAX_UNCACHED_GENERATIONS_PER_WINDOW = 30;
const ipGenerationHits = new Map<string, number[]>();

function checkUncachedRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const cutoff = now - UNCACHED_WINDOW_MS;
  const existing = (ipGenerationHits.get(clientKey) ?? []).filter((ts) => ts > cutoff);
  if (existing.length >= MAX_UNCACHED_GENERATIONS_PER_WINDOW) {
    ipGenerationHits.set(clientKey, existing);
    return false;
  }
  existing.push(now);
  ipGenerationHits.set(clientKey, existing);
  if (ipGenerationHits.size > 5000) {
    const oldestKey = ipGenerationHits.keys().next().value;
    if (oldestKey) ipGenerationHits.delete(oldestKey);
  }
  return true;
}

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

function handleRouteError(res: express.Response, err: unknown) {
  if (err instanceof ProviderRequestError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}

export function createAIRouter(): express.Router {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    res.json(getProviderStatus());
  });

  router.post('/lesson', async (req, res) => {
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

      const { adapter, modelOverride } = resolveProvider(preference);
      const providerScope = `${adapter.id}:${modelOverride ?? 'default'}`;
      const cacheKey = buildLessonCacheKey({
        topic,
        level,
        language,
        objective,
        providerScope,
      });

      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const { result, cacheHit } = await sharedLessonCache.getOrGenerate(
        cacheKey,
        async () => {
          if (adapter.id !== 'demo' && !checkUncachedRateLimit(clientIp)) {
            throw new ProviderRequestError(
              'Too many new uncached lessons requested in a short time. Please wait a moment and try again.',
              429,
              'RATE_LIMIT'
            );
          }
          return adapter.generateLesson({
            topic,
            level,
            language,
            objective,
            modelOverride,
          });
        }
      );

      res.setHeader('X-SmartEd-Cache', cacheHit ? 'HIT' : 'MISS');
      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  router.post('/tutor', async (req, res) => {
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
        .slice(-12);

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
                : undefined,
            }
          : undefined;

      const preference = parsePreference(body.providerPreference);
      const { adapter } = resolveProvider(preference);
      const result = await adapter.respondAsTutor({
        message,
        history,
        mode,
        lessonContext,
        providerPreference: preference,
      });

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  router.post('/assessment', async (req, res) => {
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

      const { adapter } = resolveProvider(preference);
      const result = await adapter.generateAssessment({
        topic,
        level,
        difficulty,
        questionCount,
        questionTypes: finalTypes,
        language,
        lessonContextSummary,
        providerPreference: preference,
      });

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  router.post('/evaluate', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const questionPrompt =
        typeof body.questionPrompt === 'string' ? body.questionPrompt.trim() : '';
      const expectedAnswer =
        typeof body.expectedAnswer === 'string' ? body.expectedAnswer.trim() : '';
      const userAnswer =
        typeof body.userAnswer === 'string' ? body.userAnswer.trim() : '';
      const topic = typeof body.topic === 'string' ? body.topic.trim() : 'General';
      const questionType: QuestionType = VALID_QUESTION_TYPES.has(
        body.questionType as QuestionType
      )
        ? (body.questionType as QuestionType)
        : 'short_answer';
      const acceptedKeywords = Array.isArray(body.acceptedKeywords)
        ? body.acceptedKeywords.filter((k): k is string => typeof k === 'string')
        : undefined;

      if (!questionPrompt || !expectedAnswer) {
        res.status(400).json({
          error: 'Missing question evaluation payload.',
          code: 'INVALID_EVALUATION',
        });
        return;
      }

      const preference = parsePreference(body.providerPreference);
      const { adapter } = resolveProvider(preference);
      const result = await adapter.evaluateShortAnswer({
        questionPrompt,
        questionType,
        expectedAnswer,
        acceptedKeywords,
        userAnswer,
        topic,
        providerPreference: preference,
      });

      res.json(result);
    } catch (err) {
      handleRouteError(res, err);
    }
  });

  return router;
}
