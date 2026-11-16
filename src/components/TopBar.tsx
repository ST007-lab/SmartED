import React from 'react';
import { Menu, Plus } from 'lucide-react';
import type { NavRoute, ProviderPreference, ProviderStatusInfo } from '../types/learning';

interface TopBarProps {
  activeRoute: NavRoute;
  activeTopicTitle?: string;
  onOpenMobileMenu: () => void;
  onStartNewTopic: () => void;
  providerStatus: ProviderStatusInfo | null;
  providerPreference: ProviderPreference;
}

const ROUTE_TITLES: Record<NavRoute, string> = {
  home: 'Home Workspace',
  learn: 'AI Learning Engine',
  'my-learning': 'My Learning Library',
  tutor: 'AI Tutor',
  assessments: 'Interactive Assessments',
  progress: 'Learning Progress',
  growth: 'Platform Growth',
  settings: 'Settings & AI Engine',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeRoute,
  activeTopicTitle,
  onOpenMobileMenu,
  onStartNewTopic,
  providerStatus,
  providerPreference,
}) => {
  const effectiveEngineLabel = (() => {
    if (providerPreference === 'demo') return 'Demonstration Mode';
    if (!providerStatus) return 'Checking AI Engine';
    if (!providerStatus.liveAvailable) return 'Demonstration Mode (Offline)';
    if (providerPreference === 'gemini-lite') return 'Gemini 3.1 Flash Lite';
    if (providerPreference === 'open-compatible') return 'Open Inference';
    return 'Gemini 4 Hydrogen';
  })();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-800/80 bg-[#060913]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
      {/* Zone 1: Navigation context & mobile trigger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex lg:hidden h-11 w-11 -ml-2 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0 text-sm">
          <span className="font-display font-semibold text-white whitespace-nowrap">
            {ROUTE_TITLES[activeRoute]}
          </span>
          {activeRoute === 'learn' && activeTopicTitle && (
            <>
              <span className="text-slate-600 shrink-0" aria-hidden="true">
                /
              </span>
              <span className="truncate text-slate-400 max-w-[220px] sm:max-w-[360px]">
                {activeTopicTitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Zone 2: Quiet engine state text + Zone 3: Primary CTA */}
      <div className="flex items-center gap-5 shrink-0">
        <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap">
          Engine: {effectiveEngineLabel}
        </span>
        <button
          type="button"
          onClick={onStartNewTopic}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 px-4 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Plus className="h-4 w-4" />
          <span>New Topic</span>
        </button>
      </div>
    </header>
  );
};
