import type {
  AIProviderAdapter,
  ProviderPreference,
} from '../types.ts';
import { DemoAIProvider } from './demoProvider.ts';
import { ProviderRequestError } from './errors.ts';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiAIProvider,
  LITE_GEMINI_MODEL,
} from './geminiProvider.ts';
import { OpenAICompatibleProvider } from './openAiCompatibleProvider.ts';

export type AITaskType = 'lesson' | 'tutor' | 'assessment' | 'evaluate';

export interface ProviderCandidate {
  adapter: AIProviderAdapter;
  modelOverride?: string;
  key: string;
}

const geminiProvider = new GeminiAIProvider();
const openCompatibleProvider = new OpenAICompatibleProvider();
const demoProvider = new DemoAIProvider();

const COOLDOWN_MS = 45_000;
const providerCooldownUntil = new Map<string, number>();

export function markProviderFailure(candidateKey: string, statusCode?: number): void {
  if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return;
  }
  providerCooldownUntil.set(candidateKey, Date.now() + COOLDOWN_MS);
}

export function markProviderSuccess(candidateKey: string): void {
  providerCooldownUntil.delete(candidateKey);
}

export function isProviderCoolingDown(candidateKey: string, nowMs = Date.now()): boolean {
  const until = providerCooldownUntil.get(candidateKey);
  if (!until) return false;
  if (nowMs >= until) {
    providerCooldownUntil.delete(candidateKey);
    return false;
  }
  return true;
}

export function resetProviderHealthForTests(): void {
  providerCooldownUntil.clear();
}

export interface ProviderStatusSnapshot {
  liveAvailable: boolean;
  defaultProviderId: string;
  providers: Array<{
    id: ProviderPreference;
    label: string;
    available: boolean;
    isDemo: boolean;
    description: string;
  }>;
}

export function getProviderStatus(): ProviderStatusSnapshot {
  const geminiReady = geminiProvider.isAvailable();
  const openReady = openCompatibleProvider.isAvailable();

  return {
    liveAvailable: geminiReady || openReady,
    defaultProviderId: geminiReady
      ? 'gemini-hydrogen'
      : openReady
      ? 'open-compatible'
      : 'demo',
    providers: [
      {
        id: 'gemini-hydrogen',
        label: 'Gemini 4 Hydrogen (Balanced)',
        available: geminiReady,
        isDemo: false,
        description: 'Structured reasoning, full lesson generation, and nuanced tutoring.',
      },
      {
        id: 'gemini-lite',
        label: 'Gemini 3.1 Flash Lite (Fast)',
        available: geminiReady,
        isDemo: false,
        description: 'Low-latency responses for quick tutoring and rapid quiz checks.',
      },
      {
        id: 'open-compatible',
        label: 'Open-Source / Custom Endpoint',
        available: openReady,
        isDemo: false,
        description:
          'Server-configured OpenAI-compatible inference (e.g., Ollama or OpenRouter).',
      },
      {
        id: 'demo',
        label: 'Demonstration Mode (Sample Content)',
        available: true,
        isDemo: true,
        description:
          'Offline pre-authored sample lessons and quizzes clearly labeled as demonstration content.',
      },
    ],
  };
}

/**
 * Selects ordered provider/model candidates based on task requirements, availability,
 * latency/cost tier, and recent transient health cooldowns.
 */
export function selectProviderCandidates(
  preference?: ProviderPreference,
  taskType: AITaskType = 'lesson',
  availabilityOverride?: { gemini?: boolean; openCompatible?: boolean }
): ProviderCandidate[] {
  const pref = preference ?? 'auto';
  const geminiOk = availabilityOverride?.gemini ?? geminiProvider.isAvailable();
  const openOk = availabilityOverride?.openCompatible ?? openCompatibleProvider.isAvailable();

  if (pref === 'demo') {
    return [{ adapter: demoProvider, key: 'demo:default' }];
  }

  if (pref === 'open-compatible') {
    if (!openOk) {
      throw new ProviderRequestError(
        'Open-source inference endpoint is not configured on the server.',
        503,
        'PROVIDER_UNCONFIGURED'
      );
    }
    return [{ adapter: openCompatibleProvider, key: 'open-compatible:default' }];
  }

  if (pref === 'gemini-lite' || pref === 'gemini-hydrogen') {
    if (!geminiOk) {
      throw new ProviderRequestError(
        'Live Gemini AI is currently unavailable on the server. Switch to Demonstration Mode or try again later.',
        503,
        'PROVIDER_UNCONFIGURED'
      );
    }
    const primaryModel = pref === 'gemini-lite' ? LITE_GEMINI_MODEL : DEFAULT_GEMINI_MODEL;
    const secondaryModel = pref === 'gemini-lite' ? DEFAULT_GEMINI_MODEL : LITE_GEMINI_MODEL;
    const ordered = [
      { adapter: geminiProvider, modelOverride: primaryModel, key: `gemini:${primaryModel}` },
      { adapter: geminiProvider, modelOverride: secondaryModel, key: `gemini:${secondaryModel}` },
    ];
    return ordered;
  }

  // 'auto': intelligent task-aware selection
  const liveCandidates: ProviderCandidate[] = [];
  if (geminiOk) {
    if (taskType === 'evaluate') {
      // Optimize latency & token cost on short answer grading
      liveCandidates.push(
        {
          adapter: geminiProvider,
          modelOverride: LITE_GEMINI_MODEL,
          key: `gemini:${LITE_GEMINI_MODEL}`,
        },
        {
          adapter: geminiProvider,
          modelOverride: DEFAULT_GEMINI_MODEL,
          key: `gemini:${DEFAULT_GEMINI_MODEL}`,
        }
      );
    } else {
      liveCandidates.push(
        {
          adapter: geminiProvider,
          modelOverride: DEFAULT_GEMINI_MODEL,
          key: `gemini:${DEFAULT_GEMINI_MODEL}`,
        },
        {
          adapter: geminiProvider,
          modelOverride: LITE_GEMINI_MODEL,
          key: `gemini:${LITE_GEMINI_MODEL}`,
        }
      );
    }
  }

  if (openOk) {
    liveCandidates.push({
      adapter: openCompatibleProvider,
      key: 'open-compatible:default',
    });
  }

  if (liveCandidates.length === 0) {
    return [{ adapter: demoProvider, key: 'demo:default' }];
  }

  // Order healthy candidates ahead of cooling-down candidates
  const healthy = liveCandidates.filter((c) => !isProviderCoolingDown(c.key));
  const cooling = liveCandidates.filter((c) => isProviderCoolingDown(c.key));
  return [...healthy, ...cooling];
}

export function resolveProvider(
  preference?: ProviderPreference,
  taskType: AITaskType = 'lesson'
): {
  adapter: AIProviderAdapter;
  modelOverride?: string;
  key: string;
} {
  return selectProviderCandidates(preference, taskType)[0];
}

export async function executeWithProviderFallback<T>(
  preference: ProviderPreference | undefined,
  taskType: AITaskType,
  runner: (candidate: ProviderCandidate) => Promise<T>
): Promise<T> {
  const candidates = selectProviderCandidates(preference, taskType);
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const result = await runner(candidate);
      markProviderSuccess(candidate.key);
      return result;
    } catch (err) {
      lastError = err;
      const status = err instanceof ProviderRequestError ? err.statusCode : 502;
      markProviderFailure(candidate.key, status);

      // Do not retry/failover client-side 4xx errors (except 429 rate-limit cross-model attempt)
      if (status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (i === candidates.length - 1) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderRequestError('AI provider request failed.', 502, 'UPSTREAM_ERROR');
}
