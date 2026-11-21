import type {
  AnswerEvaluationResult,
  AssessmentDifficulty,
  AssessmentGenerationResult,
  GeneratedLessonPayload,
  GeneratedQuestion,
  KnowledgeLevel,
  ProviderMeta,
  QuestionType,
  TutorResponseResult,
} from '../types.ts';
import { ProviderRequestError } from './errors.ts';

function asNonEmptyString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function asStringArray(value: unknown, minItems: number, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((item) => asNonEmptyString(item, maxLen))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  if (cleaned.length < minItems) return [];
  return cleaned;
}

export function validateLessonPayload(
  raw: unknown,
  context: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }
): GeneratedLessonPayload {
  if (!raw || typeof raw !== 'object') {
    throw new ProviderRequestError(
      'The AI service returned an incomplete lesson structure. Please retry.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const obj = raw as Record<string, unknown>;
  const introRaw =
    obj.introduction && typeof obj.introduction === 'object'
      ? (obj.introduction as Record<string, unknown>)
      : null;

  const hook = asNonEmptyString(introRaw?.hook, 800);
  const overview = asNonEmptyString(introRaw?.overview, 2000);
  const whyItMatters = asNonEmptyString(introRaw?.whyItMatters, 1500);

  if (!hook || !overview || !whyItMatters) {
    throw new ProviderRequestError(
      'The AI lesson introduction was incomplete. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const learningObjectives = asStringArray(obj.learningObjectives, 1, 8, 400);
  if (learningObjectives.length === 0) {
    throw new ProviderRequestError(
      'The AI lesson omitted learning objectives. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const fundamentalConcepts = Array.isArray(obj.fundamentalConcepts)
    ? obj.fundamentalConcepts
        .map((c) => {
          if (!c || typeof c !== 'object') return null;
          const rec = c as Record<string, unknown>;
          const title = asNonEmptyString(rec.title, 200);
          const explanation = asNonEmptyString(rec.explanation, 2400);
          const keyTakeaway = asNonEmptyString(rec.keyTakeaway, 500);
          if (!title || !explanation || !keyTakeaway) return null;
          return { title, explanation, keyTakeaway };
        })
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .slice(0, 8)
    : [];

  if (fundamentalConcepts.length === 0) {
    throw new ProviderRequestError(
      'The AI lesson omitted fundamental concepts. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const stepByStepExplanations = Array.isArray(obj.stepByStepExplanations)
    ? obj.stepByStepExplanations
        .map((s, idx) => {
          if (!s || typeof s !== 'object') return null;
          const rec = s as Record<string, unknown>;
          const title = asNonEmptyString(rec.title, 200);
          const explanation = asNonEmptyString(rec.explanation, 2400);
          const formulaOrCue = asNonEmptyString(rec.formulaOrCue, 500) ?? undefined;
          if (!title || !explanation) return null;
          const stepNumber =
            typeof rec.stepNumber === 'number' && Number.isFinite(rec.stepNumber) && rec.stepNumber > 0
              ? Math.round(rec.stepNumber)
              : idx + 1;
          return { stepNumber, title, explanation, ...(formulaOrCue ? { formulaOrCue } : {}) };
        })
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .slice(0, 10)
    : [];

  if (stepByStepExplanations.length === 0) {
    throw new ProviderRequestError(
      'The AI lesson omitted step-by-step explanations. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const practicalExamples = Array.isArray(obj.practicalExamples)
    ? obj.practicalExamples
        .map((ex) => {
          if (!ex || typeof ex !== 'object') return null;
          const rec = ex as Record<string, unknown>;
          const title = asNonEmptyString(rec.title, 200);
          const scenario = asNonEmptyString(rec.scenario, 1200);
          const walkthrough = asNonEmptyString(rec.walkthrough, 1800);
          const outcome = asNonEmptyString(rec.outcome, 1000);
          if (!title || !scenario || !walkthrough || !outcome) return null;
          return { title, scenario, walkthrough, outcome };
        })
        .filter((ex): ex is NonNullable<typeof ex> => Boolean(ex))
        .slice(0, 6)
    : [];

  const realWorldApplications = Array.isArray(obj.realWorldApplications)
    ? obj.realWorldApplications
        .map((app) => {
          if (!app || typeof app !== 'object') return null;
          const rec = app as Record<string, unknown>;
          const domain = asNonEmptyString(rec.domain, 160);
          const useCase = asNonEmptyString(rec.useCase, 1000);
          const impact = asNonEmptyString(rec.impact, 800);
          if (!domain || !useCase || !impact) return null;
          return { domain, useCase, impact };
        })
        .filter((app): app is NonNullable<typeof app> => Boolean(app))
        .slice(0, 6)
    : [];

  const importantTerminology = Array.isArray(obj.importantTerminology)
    ? obj.importantTerminology
        .map((term) => {
          if (!term || typeof term !== 'object') return null;
          const rec = term as Record<string, unknown>;
          const termName = asNonEmptyString(rec.term, 140);
          const definition = asNonEmptyString(rec.definition, 900);
          const contextExample = asNonEmptyString(rec.contextExample, 700) || definition;
          if (!termName || !definition || !contextExample) return null;
          return { term: termName, definition, contextExample };
        })
        .filter((term): term is NonNullable<typeof term> => Boolean(term))
        .slice(0, 12)
    : [];

  const summaryRaw =
    obj.summary && typeof obj.summary === 'object'
      ? (obj.summary as Record<string, unknown>)
      : null;
  const recapPoints = asStringArray(summaryRaw?.recapPoints, 1, 8, 500);
  const nextSteps = asStringArray(summaryRaw?.nextSteps, 1, 8, 500);

  if (
    practicalExamples.length === 0 ||
    realWorldApplications.length === 0 ||
    importantTerminology.length === 0 ||
    recapPoints.length === 0 ||
    nextSteps.length === 0
  ) {
    throw new ProviderRequestError(
      'The AI lesson missed required curriculum sections. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const knowledgeCheck = Array.isArray(obj.knowledgeCheck)
    ? obj.knowledgeCheck
        .map((kc, idx) => {
          if (!kc || typeof kc !== 'object') return null;
          const rec = kc as Record<string, unknown>;
          const question = asNonEmptyString(rec.question, 600);
          const options = asStringArray(rec.options, 2, 6, 300);
          const explanation = asNonEmptyString(rec.explanation, 900);
          if (!question || options.length < 2 || !explanation) return null;
          const rawIdx = Number(rec.correctIndex);
          const correctIndex = Number.isInteger(rawIdx)
            ? Math.max(0, Math.min(options.length - 1, rawIdx))
            : 0;
          return {
            id: asNonEmptyString(rec.id, 64) || `kc-${idx + 1}`,
            question,
            options,
            correctIndex,
            explanation,
          };
        })
        .filter((kc): kc is NonNullable<typeof kc> => Boolean(kc))
        .slice(0, 6)
    : [];

  if (knowledgeCheck.length === 0) {
    throw new ProviderRequestError(
      'The AI lesson omitted knowledge-check questions. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const normalizedTitle =
    asNonEmptyString(obj.normalizedTitle, 220) || context.topic.slice(0, 220);
  const estimatedMinutes = Math.max(
    5,
    Math.min(45, Math.round(Number(obj.estimatedMinutes) || 12))
  );
  const recommendedFollowUps = asStringArray(obj.recommendedFollowUps, 0, 5, 160);

  return {
    topic: context.topic,
    normalizedTitle,
    level: context.level,
    language: context.language,
    ...(context.objective ? { objective: context.objective } : {}),
    estimatedMinutes,
    introduction: {
      hook,
      overview,
      whyItMatters,
    },
    learningObjectives,
    fundamentalConcepts,
    stepByStepExplanations,
    practicalExamples,
    realWorldApplications,
    importantTerminology,
    summary: {
      recapPoints,
      nextSteps,
    },
    knowledgeCheck,
    recommendedFollowUps,
  };
}

export function validateTutorResponse(
  raw: unknown,
  meta: ProviderMeta
): TutorResponseResult {
  if (!raw || typeof raw !== 'object') {
    throw new ProviderRequestError(
      'The AI Tutor returned an unexpected response format. Please retry.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }
  const obj = raw as Record<string, unknown>;
  const reply = asNonEmptyString(obj.reply, 12000);
  if (!reply) {
    throw new ProviderRequestError(
      'The AI Tutor returned an empty explanation. Please ask again.',
      502,
      'EMPTY_RESPONSE'
    );
  }
  const followUpSuggestions = asStringArray(obj.followUpSuggestions, 0, 3, 220);
  return {
    reply,
    followUpSuggestions,
    meta,
  };
}

export function validateAssessmentResult(
  raw: unknown,
  context: {
    topic: string;
    difficulty: AssessmentDifficulty;
    allowedTypes: QuestionType[];
    questionCount: number;
  },
  meta: ProviderMeta
): AssessmentGenerationResult {
  if (!raw || typeof raw !== 'object') {
    throw new ProviderRequestError(
      'The AI service returned an invalid assessment format. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) {
    throw new ProviderRequestError(
      'No assessment questions were returned by the AI service.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  const allowedSet = new Set<QuestionType>(context.allowedTypes);
  const questions: GeneratedQuestion[] = [];

  for (let idx = 0; idx < obj.questions.length && questions.length < context.questionCount; idx++) {
    const q = obj.questions[idx];
    if (!q || typeof q !== 'object') continue;
    const rec = q as Record<string, unknown>;

    const prompt = asNonEmptyString(rec.prompt, 1000);
    const correctAnswer = asNonEmptyString(rec.correctAnswer, 600);
    const explanation = asNonEmptyString(rec.explanation, 1200);
    if (!prompt || !correctAnswer || !explanation) continue;

    const rawType = typeof rec.type === 'string' ? (rec.type as QuestionType) : undefined;
    const type: QuestionType =
      rawType && allowedSet.has(rawType)
        ? rawType
        : context.allowedTypes[questions.length % context.allowedTypes.length];

    let options: string[] | undefined;
    let normalizedCorrect = correctAnswer;

    if (type === 'true_false') {
      options = ['True', 'False'];
      normalizedCorrect = /^false$/i.test(correctAnswer) ? 'False' : 'True';
    } else if (type === 'multiple_choice') {
      const cleanedOpts = asStringArray(rec.options, 2, 6, 300);
      if (cleanedOpts.length < 2) continue;
      const uniqueOpts = Array.from(new Set(cleanedOpts));
      if (!uniqueOpts.some((o) => o.toLowerCase() === normalizedCorrect.toLowerCase())) {
        if (uniqueOpts.length >= 4) {
          uniqueOpts[0] = normalizedCorrect;
        } else {
          uniqueOpts.unshift(normalizedCorrect);
        }
      }
      if (uniqueOpts.length < 2) continue;
      options = uniqueOpts.slice(0, 4);
    } else {
      options = undefined;
    }

    const acceptedKeywords =
      type === 'fill_blank' || type === 'short_answer'
        ? asStringArray(rec.acceptedKeywords, 0, 8, 120)
        : undefined;

    questions.push({
      id: asNonEmptyString(rec.id, 64) || `q-${questions.length + 1}`,
      type,
      prompt,
      ...(options ? { options } : {}),
      correctAnswer: normalizedCorrect,
      ...(acceptedKeywords && acceptedKeywords.length > 0 ? { acceptedKeywords } : {}),
      explanation,
    });
  }

  if (questions.length === 0) {
    throw new ProviderRequestError(
      'The AI service did not produce valid assessment questions. Please try again.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }

  return {
    topic: context.topic,
    difficulty: context.difficulty,
    questions,
    meta,
  };
}

export function validateEvaluationResult(
  raw: unknown,
  meta: ProviderMeta
): AnswerEvaluationResult {
  if (!raw || typeof raw !== 'object') {
    throw new ProviderRequestError(
      'The AI evaluator returned an invalid grading response.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }
  const obj = raw as Record<string, unknown>;
  const feedback = asNonEmptyString(obj.feedback, 800);
  if (!feedback) {
    throw new ProviderRequestError(
      'The AI evaluator returned empty feedback.',
      502,
      'INVALID_AI_STRUCTURE'
    );
  }
  const rawScore = Number(obj.scoreRatio);
  const scoreRatio = Number.isFinite(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0;
  return {
    isCorrect: Boolean(obj.isCorrect),
    scoreRatio,
    feedback,
    meta,
  };
}
