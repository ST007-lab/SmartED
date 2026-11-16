import type {
  AIProviderAdapter,
  ProviderPreference,
} from '../types.ts';
import { DemoAIProvider } from './demoProvider.ts';
import { GeminiAIProvider, ProviderRequestError } from './geminiProvider.ts';
import { OpenAICompatibleProvider } from './openAiCompatibleProvider.ts';

const geminiProvider = new GeminiAIProvider();
const openCompatibleProvider = new OpenAICompatibleProvider();
const demoProvider = new DemoAIProvider();

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

export function resolveProvider(preference?: ProviderPreference): {
  adapter: AIProviderAdapter;
  modelOverride?: string;
} {
  const pref = preference ?? 'auto';

  if (pref === 'demo') {
    return { adapter: demoProvider };
  }

  if (pref === 'open-compatible') {
    if (!openCompatibleProvider.isAvailable()) {
      throw new ProviderRequestError(
        'Open-source inference endpoint is not configured on the server.',
        503,
        'PROVIDER_UNCONFIGURED'
      );
    }
    return { adapter: openCompatibleProvider };
  }

  if (pref === 'gemini-lite' || pref === 'gemini-hydrogen') {
    if (!geminiProvider.isAvailable()) {
      throw new ProviderRequestError(
        'Live Gemini AI is currently unavailable on the server. Switch to Demonstration Mode or try again later.',
        503,
        'PROVIDER_UNCONFIGURED'
      );
    }
    return {
      adapter: geminiProvider,
      modelOverride: pref === 'gemini-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
    };
  }

  // 'auto': prioritize live free-tier Gemini, then open-compatible, then clearly labeled Demo
  if (geminiProvider.isAvailable()) {
    return { adapter: geminiProvider, modelOverride: 'gemini-4-hydrogen' };
  }
  if (openCompatibleProvider.isAvailable()) {
    return { adapter: openCompatibleProvider };
  }
  return { adapter: demoProvider };
}
