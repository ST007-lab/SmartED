import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/suggestedTopics';
import type { KnowledgeLevel } from '../types/learning';

interface TopicLauncherFormProps {
  defaultLevel: KnowledgeLevel;
  defaultLanguage: string;
  isGenerating: boolean;
  errorMessage?: string | null;
  onSubmit: (params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }) => void;
  compact?: boolean;
}

const LEVELS: KnowledgeLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

export const TopicLauncherForm: React.FC<TopicLauncherFormProps> = ({
  defaultLevel,
  defaultLanguage,
  isGenerating,
  errorMessage,
  onSubmit,
  compact = false,
}) => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<KnowledgeLevel>(defaultLevel);
  const [language, setLanguage] = useState(defaultLanguage);
  const [objective, setObjective] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = topic.trim();
    if (!cleaned || isGenerating) return;
    onSubmit({
      topic: cleaned,
      level,
      language: language.trim() || 'English',
      objective: objective.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to learn today?"
            aria-label="What do you want to learn today?"
            maxLength={200}
            required
            disabled={isGenerating}
            className={`w-full rounded-xl border border-slate-700/80 bg-[#060913] pl-12 pr-4 text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 transition-colors disabled:opacity-60 ${
              compact ? 'h-12 text-sm' : 'h-14 text-base'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={isGenerating || topic.trim().length < 2}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:bg-slate-800 disabled:text-slate-500 px-6 font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            compact ? 'h-12 text-sm' : 'h-14 text-sm'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Building Lesson...</span>
            </>
          ) : (
            <>
              <span>Start Learning</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Knowledge Level Segmented Control + Optional Fields Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Knowledge Level</span>
          <div
            role="group"
            aria-label="Knowledge level"
            className="inline-flex items-center rounded-lg border border-slate-800 bg-[#060913] p-1"
          >
            {LEVELS.map((lvl) => {
              const active = level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  disabled={isGenerating}
                  className={`rounded-md px-3.5 py-1.5 min-h-[34px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50 transition-colors whitespace-nowrap"
        >
          <span>Language & Objective</span>
          {showAdvanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/70">
          <div>
            <label
              htmlFor="topic-language"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Learning Language (optional)
            </label>
            <select
              id="topic-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isGenerating}
              className="w-full h-11 rounded-lg border border-slate-700/80 bg-[#060913] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="topic-objective"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Learning Objective (optional)
            </label>
            <input
              id="topic-objective"
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g., Prepare for a university exam or build an intuition"
              maxLength={300}
              disabled={isGenerating}
              className="w-full h-11 rounded-lg border border-slate-700/80 bg-[#060913] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
            />
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
        >
          {errorMessage}
        </div>
      )}
    </form>
  );
};
