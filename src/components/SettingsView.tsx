import React, { useState } from 'react';
import { Check, Download, Trash2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/suggestedTopics';
import type {
  KnowledgeLevel,
  ProviderPreference,
  ProviderStatusInfo,
  UserPreferences,
} from '../types/learning';

interface SettingsViewProps {
  preferences: UserPreferences;
  providerStatus: ProviderStatusInfo | null;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onExportData: () => void;
  onClearAllData: () => void;
}

const LEVELS: KnowledgeLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  providerStatus,
  onUpdatePreferences,
  onExportData,
  onClearAllData,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const triggerSaved = () => {
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const handlePrefChange = (patch: Partial<UserPreferences>) => {
    onUpdatePreferences(patch);
    triggerSaved();
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Settings &amp; Preferences
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure your default learning level, language, AI inference mode, and
            locally persisted study data.
          </p>
        </div>

        {savedNotice && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Check className="h-4 w-4" />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* Learning Defaults */}
      <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Learning Defaults
        </h2>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-400">
            Default Knowledge Level
          </span>
          <div className="inline-flex rounded-lg border border-slate-800 bg-[#060913] p-1">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => handlePrefChange({ defaultLevel: lvl })}
                className={`rounded-md px-4 py-1.5 min-h-[36px] text-xs font-medium transition-colors ${
                  preferences.defaultLevel === lvl
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-xs space-y-2">
          <label
            htmlFor="pref-language"
            className="block text-xs font-medium text-slate-400"
          >
            Default Learning Language
          </label>
          <select
            id="pref-language"
            value={preferences.defaultLanguage}
            onChange={(e) => handlePrefChange({ defaultLanguage: e.target.value })}
            className="w-full h-11 rounded-lg border border-slate-700 bg-[#060913] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* AI Inference Provider Selection (No API key fields) */}
      <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            AI Inference Engine
          </h2>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            SmartEd routes all AI generation through secure server-side endpoints. Choose
            Automatic selection or pick a specific available engine below.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => handlePrefChange({ providerPreference: 'auto' })}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              preferences.providerPreference === 'auto'
                ? 'border-sky-500/60 bg-sky-600/12'
                : 'border-slate-800 bg-[#060913] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">
                Automatic (Recommended)
              </span>
              <span className="text-xs text-cyan-300">
                {providerStatus?.liveAvailable
                  ? 'Live AI Ready'
                  : 'Falls back to Sample Demo'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Uses the primary configured live AI model on the server and gracefully
              falls back to Demonstration Mode if no live provider is configured.
            </p>
          </button>

          {providerStatus?.providers.map((prov) => {
            const selected = preferences.providerPreference === prov.id;
            const disabled = !prov.available;
            return (
              <button
                key={prov.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  handlePrefChange({
                    providerPreference: prov.id as ProviderPreference,
                  })
                }
                className={`w-full rounded-xl border p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? 'border-sky-500/60 bg-sky-600/12'
                    : 'border-slate-800 bg-[#060913] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">
                    {prov.label}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      prov.isDemo
                        ? 'text-amber-300'
                        : prov.available
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {prov.isDemo
                      ? 'Offline Sample Mode'
                      : prov.available
                      ? 'Available'
                      : 'Not Configured on Server'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{prov.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Privacy & Cloud Data Management */}
      <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Data &amp; Privacy
          </h2>
          <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
            Your saved lessons, assessment scores, tutor conversations, and learning
            preferences are persisted in Cloud Firestore under your signed-in Google
            account so you can continue across sessions and devices. AI requests are sent
            only when you generate a lesson, message the AI tutor, or take an assessment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/70">
          <button
            type="button"
            onClick={onExportData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 hover:border-sky-500/50 hover:text-sky-300 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-slate-200 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Learning Data (JSON)</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/25 hover:bg-rose-950/45 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-rose-300 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Study Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-950/35 px-3 py-1.5">
              <span className="text-xs text-rose-200">
                Delete all lessons, chats, and scores?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClear(false);
                }}
                className="rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
