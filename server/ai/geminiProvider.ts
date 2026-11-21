import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AIProviderAdapter,
  AnswerEvaluationRequest,
  AnswerEvaluationResult,
  AssessmentGenerationRequest,
  AssessmentGenerationResult,
  GeneratedLessonPayload,
  KnowledgeLevel,
  LessonGenerationResult,
  ProviderMeta,
  TutorRequestPayload,
  TutorResponseResult,
} from '../types.ts';
import { ProviderRequestError, withTimeout } from './errors.ts';
import {
  validateAssessmentResult,
  validateEvaluationResult,
  validateLessonPayload,
  validateTutorResponse,
} from './validators.ts';

export { ProviderRequestError };

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const LITE_GEMINI_MODEL = 'gemini-3.1-flash-lite';

const LESSON_TIMEOUT_MS = 45_000;
const TUTOR_TIMEOUT_MS = 25_000;
const ASSESSMENT_TIMEOUT_MS = 30_000;
const EVALUATE_TIMEOUT_MS = 15_000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderRequestError(
      'Live Gemini AI is not configured on the server.',
      503,
      'PROVIDER_UNCONFIGURED'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(operation(), timeoutMs);
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderRequestError && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }

      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isTimeout = err instanceof ProviderRequestError && err.code === 'AI_TIMEOUT';
      const isTransient =
        isTimeout ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('fetch failed') ||
        msg.includes('unavailable');

      if (!isTransient || attempt === maxAttempts) {
        break;
      }

      const jitterMs = Math.floor(Math.random() * 250);
      const backoffMs = Math.min(3500, 400 * 2 ** (attempt - 1) + jitterMs);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw normalizeGeminiError(lastError);
}

export function normalizeGeminiError(err: unknown): ProviderRequestError {
  if (err instanceof ProviderRequestError) return err;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new ProviderRequestError(
      'AI rate limit reached right now. Please wait a moment and try again, or switch to Demonstration Mode in Settings.',
      429,
      'RATE_LIMITED'
    );
  }
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('401')
  ) {
    return new ProviderRequestError(
      'The server AI service rejected authentication. Please verify the server configuration.',
      503,
      'AI_AUTH_ERROR'
    );
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return new ProviderRequestError(
      'The requested AI model is currently unavailable.',
      502,
      'MODEL_UNAVAILABLE'
    );
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborted')) {
    return new ProviderRequestError(
      'The AI service took too long to respond. Please try again.',
      504,
      'AI_TIMEOUT'
    );
  }
  return new ProviderRequestError(
    'The AI service could not complete this request right now. Please try again shortly.',
    502,
    'UPSTREAM_ERROR'
  );
}

function safeParseJson<T>(rawText: string | undefined, fallbackMsg: string): T {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) {
    throw new ProviderRequestError(fallbackMsg, 502, 'EMPTY_RESPONSE');
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1].trim()) as T;
      } catch {
        // Fall through
      }
    }
    throw new ProviderRequestError(fallbackMsg, 502, 'MALFORMED_JSON');
  }
}

export class GeminiAIProvider implements AIProviderAdapter {
  readonly id = 'gemini';
  readonly label = 'Google Gemini (Live AI)';

  isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  private buildMeta(modelName: string): ProviderMeta {
    return {
      providerId: 'gemini',
      providerLabel:
        modelName === LITE_GEMINI_MODEL
          ? 'Gemini 3.1 Flash Lite (Live AI)'
          : 'Gemini 4 Hydrogen (Live AI)',
      modelName,
      isDemo: false,
    };
  }

  async generateLesson(params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
    modelOverride?: string;
  }): Promise<LessonGenerationResult> {
    const ai = getGeminiClient();
    const model =
      params.modelOverride === LITE_GEMINI_MODEL ? LITE_GEMINI_MODEL : DEFAULT_GEMINI_MODEL;

    const systemInstruction = [
      'You are SmartEd, a rigorous, clear, and encouraging personal AI teacher built by ST Group.',
      `Teach the requested topic accurately in ${params.language} tailored to a ${params.level} learner.`,
      'Do not invent unverified statistics or fake citations. If a topic involves active scientific debate or uncertainty, state that clearly.',
      'Ensure all 9 lesson sections are substantive, concrete, and genuinely educational—never generic filler.',
      'Keep explanations crisp, concise, and structured for screen reading.',
    ].join(' ');

    const userPrompt = [
      `Create a complete structured lesson on: "${params.topic}"`,
      `Knowledge Level: ${params.level}`,
      `Language: ${params.language}`,
      params.objective ? `Learner Goal / Objective: ${params.objective}` : '',
      'Include: introduction (hook, overview, whyItMatters), 3-5 learningObjectives, 3-4 fundamentalConcepts, 3-5 stepByStepExplanations, 2 practicalExamples, 2-3 realWorldApplications, 4-6 importantTerminology entries, summary (recapPoints, nextSteps), 3 knowledgeCheck multiple-choice questions (with 4 options each and 0-based correctIndex), and 3 recommendedFollowUps topics.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction,
            ...(model === DEFAULT_GEMINI_MODEL
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                normalizedTitle: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
                introduction: {
                  type: Type.OBJECT,
                  properties: {
                    hook: { type: Type.STRING },
                    overview: { type: Type.STRING },
                    whyItMatters: { type: Type.STRING },
                  },
                  required: ['hook', 'overview', 'whyItMatters'],
                },
                learningObjectives: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                fundamentalConcepts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      keyTakeaway: { type: Type.STRING },
                    },
                    required: ['title', 'explanation', 'keyTakeaway'],
                  },
                },
                stepByStepExplanations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      formulaOrCue: { type: Type.STRING },
                    },
                    required: ['stepNumber', 'title', 'explanation'],
                  },
                },
                practicalExamples: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      scenario: { type: Type.STRING },
                      walkthrough: { type: Type.STRING },
                      outcome: { type: Type.STRING },
                    },
                    required: ['title', 'scenario', 'walkthrough', 'outcome'],
                  },
                },
                realWorldApplications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      domain: { type: Type.STRING },
                      useCase: { type: Type.STRING },
                      impact: { type: Type.STRING },
                    },
                    required: ['domain', 'useCase', 'impact'],
                  },
                },
                importantTerminology: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      contextExample: { type: Type.STRING },
                    },
                    required: ['term', 'definition', 'contextExample'],
                  },
                },
                summary: {
                  type: Type.OBJECT,
                  properties: {
                    recapPoints: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    nextSteps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['recapPoints', 'nextSteps'],
                },
                knowledgeCheck: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'question', 'options', 'correctIndex', 'explanation'],
                  },
                },
                recommendedFollowUps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'normalizedTitle',
                'estimatedMinutes',
                'introduction',
                'learningObjectives',
                'fundamentalConcepts',
                'stepByStepExplanations',
                'practicalExamples',
                'realWorldApplications',
                'importantTerminology',
                'summary',
                'knowledgeCheck',
                'recommendedFollowUps',
              ],
            },
          },
        }),
      LESSON_TIMEOUT_MS
    );

    const parsed = safeParseJson<
      Omit<GeneratedLessonPayload, 'topic' | 'level' | 'language' | 'objective'>
    >(response.text, 'Failed to parse generated lesson from AI.');

    const lesson = validateLessonPayload(parsed, {
      topic: params.topic,
      level: params.level,
      language: params.language,
      objective: params.objective,
    });

    return {
      lesson,
      meta: this.buildMeta(model),
    };
  }

  async respondAsTutor(
    params: TutorRequestPayload & { modelOverride?: string }
  ): Promise<TutorResponseResult> {
    const ai = getGeminiClient();
    const model =
      params.modelOverride === LITE_GEMINI_MODEL ||
      params.providerPreference === 'gemini-lite'
        ? LITE_GEMINI_MODEL
        : DEFAULT_GEMINI_MODEL;

    const modeGuidance: Record<TutorRequestPayload['mode'], string> = {
      standard: 'Give a clear, structured, pedagogically sound explanation.',
      simplify:
        'Explain using plain everyday words and short sentences without losing factual accuracy.',
      analogy:
        'Teach using one vivid, accurate real-world analogy and explicitly note where the analogy stops holding.',
      'step-by-step':
        'Break the reasoning or problem into numbered sequential steps, explaining why each step follows from the previous one.',
      challenge:
        'Probe the learner’s understanding by testing assumptions and asking a targeted critical-thinking question back.',
    };

    const contextBlock = params.lessonContext
      ? [
          `Active Lesson Topic: ${params.lessonContext.topic}`,
          `Knowledge Level: ${params.lessonContext.level}`,
          params.lessonContext.language
            ? `Language: ${params.lessonContext.language}`
            : '',
          params.lessonContext.activeSectionTitle
            ? `Current Section: ${params.lessonContext.activeSectionTitle}`
            : '',
          params.lessonContext.activeSectionContent
            ? `Section Excerpt:\n${params.lessonContext.activeSectionContent.slice(0, 1400)}`
            : '',
          params.lessonContext.learningObjectives?.length
            ? `Lesson Objectives: ${params.lessonContext.learningObjectives.slice(0, 5).join('; ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'No specific lesson attached; respond as a general SmartEd personal AI teacher.';

    const systemInstruction = [
      'You are the SmartEd AI Tutor by ST Group.',
      modeGuidance[params.mode],
      'CRITICAL INTEGRITY RULES:',
      '1. Never blindly agree with an incorrect user premise or misconception. Politely point out what is inaccurate and explain why.',
      '2. If you are uncertain or a question depends on missing context or unresolved research, state the uncertainty clearly instead of inventing facts.',
      '3. Keep responses scannable using concise paragraphs, numbered steps, or bullet lists.',
      '4. Also output 3 short, relevant follow-up questions the learner could ask next.',
      '',
      'LESSON CONTEXT:',
      contextBlock,
    ].join('\n');

    // Trim history tokens to last 8 turns and bounded length per turn
    const transcript = params.history
      .slice(-8)
      .map(
        (turn) =>
          `${turn.role === 'user' ? 'Learner' : 'Tutor'}: ${turn.content.slice(0, 800)}`
      )
      .join('\n\n');

    const prompt = transcript
      ? `Previous conversation:\n${transcript}\n\nLearner's new message:\n${params.message}`
      : `Learner's question:\n${params.message}`;

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            ...(model === DEFAULT_GEMINI_MODEL
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description: 'Markdown-formatted tutor explanation.',
                },
                followUpSuggestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 concise follow-up questions for the learner.',
                },
              },
              required: ['reply', 'followUpSuggestions'],
            },
          },
        }),
      TUTOR_TIMEOUT_MS
    );

    const parsed = safeParseJson<{ reply: string; followUpSuggestions: string[] }>(
      response.text,
      'Failed to parse AI tutor response.'
    );

    return validateTutorResponse(parsed, this.buildMeta(model));
  }

  async generateAssessment(
    params: AssessmentGenerationRequest & { modelOverride?: string }
  ): Promise<AssessmentGenerationResult> {
    const ai = getGeminiClient();
    const model =
      params.modelOverride === LITE_GEMINI_MODEL ||
      params.providerPreference === 'gemini-lite'
        ? LITE_GEMINI_MODEL
        : DEFAULT_GEMINI_MODEL;

    const typesList = params.questionTypes.join(', ');
    const systemInstruction = [
      'You are the SmartEd Assessment Engine by ST Group.',
      `Generate exactly ${params.questionCount} original assessment questions on "${params.topic}" at ${params.difficulty} difficulty for a ${params.level} learner.`,
      params.language ? `Write in ${params.language}.` : '',
      `Distribute questions across ONLY these requested question types: ${typesList}.`,
      'Rules per question type:',
      '- multiple_choice: Provide exactly 4 distinct options in `options`, and set `correctAnswer` equal to the exact text of the one correct option.',
      '- true_false: Set `options` to ["True", "False"], and `correctAnswer` to "True" or "False".',
      '- fill_blank: Include "____" in `prompt` where the missing word/phrase goes, omit `options`, set `correctAnswer` to the concise target term, and provide 2-4 `acceptedKeywords` synonyms/variants.',
      '- short_answer: Ask a focused conceptual question requiring 1-2 sentences, omit `options`, set `correctAnswer` to a crisp model answer, and provide 3-5 `acceptedKeywords` core concepts.',
      'Provide a clear educational `explanation` for every question.',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = [
      `Topic: ${params.topic}`,
      `Difficulty: ${params.difficulty}`,
      `Question Count: ${params.questionCount}`,
      `Allowed Types: ${typesList}`,
      params.lessonContextSummary
        ? `Lesson Coverage Context:\n${params.lessonContextSummary.slice(0, 1500)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            ...(model === DEFAULT_GEMINI_MODEL
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      type: { type: Type.STRING },
                      prompt: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctAnswer: { type: Type.STRING },
                      acceptedKeywords: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'type', 'prompt', 'correctAnswer', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        }),
      ASSESSMENT_TIMEOUT_MS
    );

    const parsed = safeParseJson<{ questions: unknown[] }>(
      response.text,
      'Failed to parse assessment questions.'
    );

    return validateAssessmentResult(
      parsed,
      {
        topic: params.topic,
        difficulty: params.difficulty,
        allowedTypes: params.questionTypes,
        questionCount: params.questionCount,
      },
      this.buildMeta(model)
    );
  }

  async evaluateShortAnswer(
    params: AnswerEvaluationRequest
  ): Promise<AnswerEvaluationResult> {
    // Deterministic fast-path to optimize latency and token cost
    const normalizedUser = params.userAnswer.trim().toLowerCase();
    const normalizedExpected = params.expectedAnswer.trim().toLowerCase();
    if (!normalizedUser) {
      return {
        isCorrect: false,
        scoreRatio: 0,
        feedback: 'No answer was provided.',
        meta: this.buildMeta(LITE_GEMINI_MODEL),
      };
    }
    if (normalizedUser === normalizedExpected) {
      return {
        isCorrect: true,
        scoreRatio: 1,
        feedback: 'Exact conceptual match with the model answer.',
        meta: this.buildMeta(LITE_GEMINI_MODEL),
      };
    }

    const ai = getGeminiClient();
    const model = LITE_GEMINI_MODEL;

    const prompt = [
      `Topic: ${params.topic}`,
      `Question (${params.questionType}): ${params.questionPrompt}`,
      `Model Answer: ${params.expectedAnswer}`,
      params.acceptedKeywords?.length
        ? `Key Concepts: ${params.acceptedKeywords.join(', ')}`
        : '',
      `Learner's Answer: ${params.userAnswer.slice(0, 1200)}`,
      'Grade fairly on conceptual accuracy (not exact wording). Return isCorrect (boolean), scoreRatio (0 to 1), and 1-2 sentences of constructive feedback.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isCorrect: { type: Type.BOOLEAN },
                scoreRatio: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
              },
              required: ['isCorrect', 'scoreRatio', 'feedback'],
            },
          },
        }),
      EVALUATE_TIMEOUT_MS
    );

    const parsed = safeParseJson<{
      isCorrect: boolean;
      scoreRatio: number;
      feedback: string;
    }>(response.text, 'Failed to evaluate answer.');

    return validateEvaluationResult(parsed, this.buildMeta(model));
  }
}
