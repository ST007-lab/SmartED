import type {
  AIProviderAdapter,
  AnswerEvaluationRequest,
  AnswerEvaluationResult,
  AssessmentGenerationRequest,
  AssessmentGenerationResult,
  GeneratedLessonPayload,
  GeneratedQuestion,
  KnowledgeLevel,
  LessonGenerationResult,
  ProviderMeta,
  TutorRequestPayload,
  TutorResponseResult,
} from '../types.ts';
import { ProviderRequestError } from './geminiProvider.ts';

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
    return Boolean(baseUrl && model);
  }

  private getMeta(model: string): ProviderMeta {
    return {
      providerId: this.id,
      providerLabel: `Open Inference (${model})`,
      modelName: model,
      isDemo: false,
    };
  }

  private async chatJson<T>(system: string, user: string): Promise<{ data: T; model: string }> {
    const { baseUrl, model, apiKey } = this.getConfig();
    if (!baseUrl || !model) {
      throw new ProviderRequestError(
        'Open-source compatible provider is not configured on the server.',
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

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${system}\nReturn valid JSON only.` },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderRequestError(
        `Open inference endpoint error (${res.status}): ${text.slice(0, 180)}`,
        res.status === 429 ? 429 : 502,
        'OPEN_COMPAT_ERROR'
      );
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ProviderRequestError('Empty response from open inference endpoint.', 502, 'EMPTY_RESPONSE');
    }

    try {
      return { data: JSON.parse(content) as T, model };
    } catch {
      const fenced = content.match(/```json\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        return { data: JSON.parse(fenced[1].trim()) as T, model };
      }
      throw new ProviderRequestError('Malformed JSON from open inference endpoint.', 502, 'MALFORMED_JSON');
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
    >(system, user);

    return {
      lesson: {
        topic: params.topic,
        level: params.level,
        language: params.language,
        objective: params.objective,
        ...data,
      },
      meta: this.getMeta(model),
    };
  }

  async respondAsTutor(params: TutorRequestPayload): Promise<TutorResponseResult> {
    const system = `You are SmartEd AI Tutor by ST Group. Mode: ${params.mode}. Never blindly agree with incorrect assumptions and admit uncertainty rather than inventing facts. Context: ${JSON.stringify(params.lessonContext || {})}. Return JSON: { "reply": "markdown string", "followUpSuggestions": ["q1", "q2", "q3"] }`;
    const user = `History: ${JSON.stringify(params.history.slice(-8))}\nMessage: ${params.message}`;
    const { data, model } = await this.chatJson<{
      reply: string;
      followUpSuggestions: string[];
    }>(system, user);

    return {
      reply: data.reply,
      followUpSuggestions: (data.followUpSuggestions || []).slice(0, 3),
      meta: this.getMeta(model),
    };
  }

  async generateAssessment(
    params: AssessmentGenerationRequest
  ): Promise<AssessmentGenerationResult> {
    const system = `Generate ${params.questionCount} questions JSON { "questions": [{ id, type, prompt, options, correctAnswer, acceptedKeywords, explanation }] } using ONLY types: ${params.questionTypes.join(', ')}.`;
    const user = `Topic: ${params.topic}\nLevel: ${params.level}\nDifficulty: ${params.difficulty}`;
    const { data, model } = await this.chatJson<{ questions: GeneratedQuestion[] }>(system, user);

    return {
      topic: params.topic,
      difficulty: params.difficulty,
      questions: data.questions || [],
      meta: this.getMeta(model),
    };
  }

  async evaluateShortAnswer(
    params: AnswerEvaluationRequest
  ): Promise<AnswerEvaluationResult> {
    const system = `Grade learner answer fairly. Return JSON: { "isCorrect": boolean, "scoreRatio": number, "feedback": string }`;
    const user = `Question: ${params.questionPrompt}\nExpected: ${params.expectedAnswer}\nLearner Answer: ${params.userAnswer}`;
    const { data, model } = await this.chatJson<{
      isCorrect: boolean;
      scoreRatio: number;
      feedback: string;
    }>(system, user);

    return {
      isCorrect: Boolean(data.isCorrect),
      scoreRatio: Math.max(0, Math.min(1, Number(data.scoreRatio) || 0)),
      feedback: data.feedback,
      meta: this.getMeta(model),
    };
  }
}
