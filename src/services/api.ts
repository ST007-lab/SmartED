import type {
  AssessmentDifficulty,
  GeneratedLessonPayload,
  GeneratedQuestion,
  KnowledgeLevel,
  ProviderMeta,
  ProviderPreference,
  ProviderStatusInfo,
  QuestionType,
  TutorMode,
} from '../types/learning';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${res.status}`,
      res.status,
      data.code || 'API_ERROR'
    );
  }
  return data as T;
}

export async function fetchProviderStatus(): Promise<ProviderStatusInfo> {
  const res = await fetch('/api/ai/status');
  if (!res.ok) {
    throw new ApiError('Unable to check AI provider status.', res.status, 'STATUS_ERROR');
  }
  return (await res.json()) as ProviderStatusInfo;
}

export async function generateLessonApi(params: {
  topic: string;
  level: KnowledgeLevel;
  language: string;
  objective?: string;
  providerPreference: ProviderPreference;
}): Promise<{ lesson: GeneratedLessonPayload; meta: ProviderMeta }> {
  return postJson('/api/ai/lesson', params);
}

export async function sendTutorMessageApi(params: {
  message: string;
  history: Array<{ role: 'user' | 'tutor'; content: string }>;
  mode: TutorMode;
  lessonContext?: {
    topic: string;
    level: KnowledgeLevel;
    language?: string;
    activeSectionTitle?: string;
    activeSectionContent?: string;
    learningObjectives?: string[];
  };
  providerPreference: ProviderPreference;
}): Promise<{
  reply: string;
  followUpSuggestions: string[];
  meta: ProviderMeta;
}> {
  return postJson('/api/ai/tutor', params);
}

export async function generateAssessmentApi(params: {
  topic: string;
  level: KnowledgeLevel;
  difficulty: AssessmentDifficulty;
  questionCount: number;
  questionTypes: QuestionType[];
  language?: string;
  lessonContextSummary?: string;
  providerPreference: ProviderPreference;
}): Promise<{
  topic: string;
  difficulty: AssessmentDifficulty;
  questions: GeneratedQuestion[];
  meta: ProviderMeta;
}> {
  return postJson('/api/ai/assessment', params);
}

export async function evaluateAnswerApi(params: {
  questionPrompt: string;
  questionType: QuestionType;
  expectedAnswer: string;
  acceptedKeywords?: string[];
  userAnswer: string;
  topic: string;
  providerPreference: ProviderPreference;
}): Promise<{
  isCorrect: boolean;
  scoreRatio: number;
  feedback: string;
  meta: ProviderMeta;
}> {
  return postJson('/api/ai/evaluate', params);
}
