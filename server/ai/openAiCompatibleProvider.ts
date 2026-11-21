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
import { ProviderRequestError } from './errors.ts';
import {
  validateAssessmentResult,
  validateEvaluationResult,
  validateLessonPayload,
  validateTutorResponse,
} from './validators.ts';

const DEFAULT_TIMEOUT_MS = 35_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Validates that the configured OpenAI-compatible base URL uses HTTPS
 * or explicitly targets a local loopback development daemon (e.g. Ollama/LM Studio).
 * Blocks link-local/cloud metadata SSRF targets (e.g. 169.254.169.254).
 */
export function isSafeProviderBaseUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      const host = parsed.hostname.toLowerCase();
      if (host === '169.254.169.254' || host.endsWith('.internal')) return false;
      return true;
    }
    if (parsed.protocol === 'http:') {
      return LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Optional provider adapter for self-hosted or free-tier OpenAI-compatible inference endpoints
 * (e.g., Ollama, vLLM, LM Studio, or OpenRouter) configured via server environment variables:
 *   AI_COMPAT_BASE_URL (e.g., http://localhost:11434/v1)
 *   AI_COMPAT_MODEL    (e.g., llama3.1:8b)
 *   AI_COMPAT_API_KEY  (optional)
 */
export class OpenAICompatibleProvider implements AIProviderAdapter {
  readonly id = 'open-compatible';
  readonly label = 'Open-Source / Custom Endpoint';

  private getConfig() {
    const baseUrl = process.env.AI_COMPAT_BASE_URL?.trim().replace(/\/$/, '');
    const model = process.env.AI_COMPAT_MODEL?.trim();
    const apiKey = process.env.AI_COMPAT_API_KEY?.trim();
    return { baseUrl, model, apiKey };
  }

  isAvailable(): boolean {
    const { baseUrl, model } = this.getConfig();
    return Boolean(baseUrl && model && isSafeProviderBaseUrl(baseUrl));
  }

  private getMeta(model: string): ProviderMeta {
    return {
      providerId: this.id,
      providerLabel: `Open Inference (${model})`,
      modelName: model,
      isDemo: false,
    };
  }

  private async chatJson<T>(
    system: string,
    user: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<{ data: T; model: string }> {
    const { baseUrl, model, apiKey } = this.getConfig();
    if (!baseUrl || !model || !isSafeProviderBaseUrl(baseUrl)) {
      throw new ProviderRequestError(
        'Open-source compatible provider is not securely configured on the server.',
        503,
        'PROVIDER_UNCONFIGURED'
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${system}\nReturn valid JSON only.` },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new ProviderRequestError(
        isAbort
          ? 'Open inference endpoint timed out. Please try again.'
          : 'Unable to reach open inference endpoint.',
        isAbort ? 504 : 502,
        isAbort ? 'AI_TIMEOUT' : 'OPEN_COMPAT_UNREACHABLE'
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new ProviderRequestError(
        res.status === 429
          ? 'Open inference endpoint rate limit reached. Please retry shortly.'
          : 'Open inference endpoint could not complete this request.',
        res.status === 429 ? 429 : 502,
        'OPEN_COMPAT_ERROR'
      );
    }

    const json = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ProviderRequestError(
        'Empty response from open inference endpoint.',
        502,
        'EMPTY_RESPONSE'
      );
    }

    try {
      return { data: JSON.parse(content) as T, model };
    } catch {
      const fenced = content.match(/```json\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        try {
          return { data: JSON.parse(fenced[1].trim()) as T, model };
        } catch {
          // Fall through
        }
      }
      throw new ProviderRequestError(
        'Malformed JSON returned by open inference endpoint.',
        502,
        'MALFORMED_JSON'
      );
    }
  }

  async generateLesson(params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }): Promise<LessonGenerationResult> {
    const system = `You are SmartEd by ST Group. Generate a complete structured lesson JSON with keys: normalizedTitle, estimatedMinutes, introduction ({hook, overview, whyItMatters}), learningObjectives (string[]), fundamentalConcepts ([{title, explanation, keyTakeaway}]), stepByStepExplanations ([{stepNumber, title, explanation, formulaOrCue}]), practicalExamples ([{title, scenario, walkthrough, outcome}]), realWorldApplications ([{domain, useCase, impact}]), importantTerminology ([{term, definition, contextExample}]), summary ({recapPoints, nextSteps}), knowledgeCheck ([{id, question, options, correctIndex, explanation}]), recommendedFollowUps (string[]).`;
    const user = `Topic: ${params.topic}\nLevel: ${params.level}\nLanguage: ${params.language}${params.objective ? `\nObjective: ${params.objective}` : ''}`;

    const { data, model } = await this.chatJson<
      Omit<GeneratedLessonPayload, 'topic' | 'level' | 'language' | 'objective'>
    >(system, user, 45_000);

    const lesson = validateLessonPayload(data, {
      topic: params.topic,
      level: params.level,
      language: params.language,
      objective: params.objective,
    });

    return {
      lesson,
      meta: this.getMeta(model),
    };
  }

  async respondAsTutor(params: TutorRequestPayload): Promise<TutorResponseResult> {
    const system = `You are SmartEd AI Tutor by ST Group. Mode: ${params.mode}. Never blindly agree with incorrect assumptions and admit uncertainty rather than inventing facts. Context: ${JSON.stringify(params.lessonContext || {})}. Return JSON: { "reply": "markdown string", "followUpSuggestions": ["q1", "q2", "q3"] }`;
    const user = `History: ${JSON.stringify(params.history.slice(-8))}\nMessage: ${params.message}`;
    const { data, model } = await this.chatJson<{
      reply: string;
      followUpSuggestions: string[];
    }>(system, user, 25_000);

    return validateTutorResponse(data, this.getMeta(model));
  }

  async generateAssessment(
    params: AssessmentGenerationRequest
  ): Promise<AssessmentGenerationResult> {
    const system = `Generate ${params.questionCount} questions JSON { "questions": [{ id, type, prompt, options, correctAnswer, acceptedKeywords, explanation }] } using ONLY types: ${params.questionTypes.join(', ')}.`;
    const user = `Topic: ${params.topic}\nLevel: ${params.level}\nDifficulty: ${params.difficulty}${params.lessonContextSummary ? `\nContext:\n${params.lessonContextSummary.slice(0, 1200)}` : ''}`;
    const { data, model } = await this.chatJson<{ questions: unknown[] }>(system, user, 30_000);

    return validateAssessmentResult(
      data,
      {
        topic: params.topic,
        difficulty: params.difficulty,
        allowedTypes: params.questionTypes,
        questionCount: params.questionCount,
      },
      this.getMeta(model)
    );
  }

  async evaluateShortAnswer(
    params: AnswerEvaluationRequest
  ): Promise<AnswerEvaluationResult> {
    const system = `Grade learner answer fairly. Return JSON: { "isCorrect": boolean, "scoreRatio": number, "feedback": string }`;
    const user = `Question: ${params.questionPrompt}\nExpected: ${params.expectedAnswer}\nLearner Answer: ${params.userAnswer.slice(0, 1200)}`;
    const { data, model } = await this.chatJson<{
      isCorrect: boolean;
      scoreRatio: number;
      feedback: string;
    }>(system, user, 15_000);

    return validateEvaluationResult(data, this.getMeta(model));
  }
}
