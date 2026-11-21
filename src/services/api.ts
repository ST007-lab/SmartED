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
  UsageQuotaInfo,
} from '../types/learning';
import { auth } from './firebase';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly usage?: UsageQuotaInfo;

  constructor(message: string, status: number, code: string, usage?: UsageQuotaInfo) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.usage = usage;
  }
}

async function getBearerToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

async function authorizedFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const buildHeaders = async (forceRefresh: boolean): Promise<HeadersInit> => {
    const token = await getBearerToken(forceRefresh);
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  let res = await fetch(url, {
    ...init,
    headers: await buildHeaders(false),
  });

  // If ID token just expired, refresh once and retry
  if (res.status === 401 && auth.currentUser) {
    res = await fetch(url, {
      ...init,
      headers: await buildHeaders(true),
    });
  }

  return res;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await authorizedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    usage?: UsageQuotaInfo;
  };

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${res.status}`,
      res.status,
      data.code || 'API_ERROR',
      data.usage
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

export async function fetchUsageQuota(): Promise<UsageQuotaInfo> {
  const res = await authorizedFetch('/api/ai/usage');
  const data = (await res.json().catch(() => ({}))) as Partial<UsageQuotaInfo> & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      data.error || 'Unable to load daily usage quota.',
      res.status,
      data.code || 'USAGE_ERROR'
    );
  }
  return data as UsageQuotaInfo;
}

export async function generateLessonApi(params: {
  topic: string;
  level: KnowledgeLevel;
  language: string;
  objective?: string;
  providerPreference: ProviderPreference;
}): Promise<{
  lesson: GeneratedLessonPayload;
  meta: ProviderMeta;
  usage?: UsageQuotaInfo;
}> {
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
