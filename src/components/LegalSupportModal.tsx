import React, { useEffect, useState } from 'react';
import { Bot, FileText, HelpCircle, ShieldCheck, X } from 'lucide-react';
import { SrvLogo } from './SrvLogo';

export type LegalTab = 'privacy' | 'terms' | 'ai-disclosure' | 'support';

interface LegalSupportModalProps {
  open: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

const TABS: Array<{ id: LegalTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'terms', label: 'Terms', icon: FileText },
  { id: 'ai-disclosure', label: 'AI Notice', icon: Bot },
  { id: 'support', label: 'Support', icon: HelpCircle },
];

export const LegalSupportModal: React.FC<LegalSupportModalProps> = ({
  open,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0B1120] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <SrvLogo size={28} />
            <div>
              <h2 id="legal-modal-title" className="font-display text-lg font-bold text-white">
                SmartEd Governance, Privacy &amp; Support
              </h2>
              <p className="text-xs text-slate-400">
                ST Group · Founder: John Nikson
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-800/80 bg-[#060913] px-6 py-2.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 min-h-[38px] text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 text-sm text-slate-300 leading-relaxed">
          {activeTab === 'privacy' && (
            <>
              <h3 className="font-display text-base font-semibold text-white">
                Privacy Information
              </h3>
              <p>
                SmartEd (developed by ST Group) uses Google Sign-In via Firebase Authentication
                to identify your learning workspace and protect your personal progress.
              </p>
              <ul className="space-y-2 pl-5 list-disc marker:text-sky-400">
                <li>
                  <strong className="text-slate-100">Stored Account Data:</strong> Your display
                  name, verified email address, learning preferences, saved lessons, tutor
                  conversations, assessment scores, daily study activity, and submitted product
                  feedback are stored in Google Cloud Firestore.
                </li>
                <li>
                  <strong className="text-slate-100">AI Processing:</strong> Topic prompts,
                  questions, and short answers are sent securely through SmartEd&apos;s backend
                  API to the configured AI provider solely to generate your requested lesson,
                  tutor response, or grading feedback.
                </li>
                <li>
                  <strong className="text-slate-100">Data Control:</strong> You can export your
                  entire learning archive as JSON or permanently clear your cloud study history at
                  any time from the <em>Settings</em> page.
                </li>
                <li>
                  <strong className="text-slate-100">Zero Hidden Telemetry:</strong> SmartEd does
                  not sell learner data or embed third-party advertising trackers.
                </li>
              </ul>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <h3 className="font-display text-base font-semibold text-white">
                Terms of Service
              </h3>
              <p>
                By signing in and using SmartEd by ST Group, you agree to use the platform for
                lawful educational and study purposes.
              </p>
              <ul className="space-y-2 pl-5 list-disc marker:text-sky-400">
                <li>
                  <strong className="text-slate-100">Fair-Use Free Allowance:</strong> Standard
                  accounts include up to 5 new structured lessons per UTC day (enforced server-side)
                  to keep the platform fast, reliable, and free for learners worldwide. Revisiting
                  lessons already opened today or saved in your library does not consume extra quota.
                </li>
                <li>
                  <strong className="text-slate-100">Acceptable Use:</strong> Automated scraping,
                  denial-of-service attempts, token forgery, or attempting to bypass server rate
                  limits is prohibited and may result in request throttling.
                </li>
                <li>
                  <strong className="text-slate-100">Service Availability:</strong> SmartEd provides
                  live AI models when available and clearly labeled Demonstration Mode sample
                  curriculum if live inference is temporarily unavailable.
                </li>
              </ul>
            </>
          )}

          {activeTab === 'ai-disclosure' && (
            <>
              <h3 className="font-display text-base font-semibold text-white">
                AI-Generated Content Disclosure
              </h3>
              <p>
                Lessons, tutor replies, and assessment items marked as Live AI are generated
                dynamically by large language models (such as Google Gemini) routed through
                SmartEd&apos;s validation layer. Offline items in Demonstration Mode are clearly
                labeled as sample content.
              </p>
              <ul className="space-y-2 pl-5 list-disc marker:text-cyan-400">
                <li>
                  While SmartEd instructs models to avoid fabricated statistics, challenge flawed
                  premises, and acknowledge uncertainty, AI models can occasionally make mistakes.
                </li>
                <li>
                  For high-stakes academic exams, medical, legal, engineering, or financial
                  decisions, always cross-verify critical facts against primary textbooks or
                  qualified instructors.
                </li>
                <li>
                  Use the <strong>Feedback &amp; Issue Report</strong> form anytime to flag any
                  inaccurate explanation so ST Group can improve prompt grounding.
                </li>
              </ul>
            </>
          )}

          {activeTab === 'support' && (
            <>
              <h3 className="font-display text-base font-semibold text-white">
                Support &amp; Organization Contact
              </h3>
              <p>
                SmartEd is built and maintained by <strong className="text-white">ST Group</strong>
                , founded by <strong className="text-white">John Nikson</strong>, with the mission
                to make structured, personalized teaching accessible to everyone.
              </p>
              <div className="rounded-xl border border-slate-800 bg-[#060913] p-4 space-y-2">
                <div className="text-xs text-slate-400">Platform Support Email</div>
                <a
                  href="mailto:sharmifrancis123@gmail.com"
                  className="font-mono text-sm text-sky-400 hover:text-sky-300 underline underline-offset-4"
                >
                  sharmifrancis123@gmail.com
                </a>
                <p className="text-xs text-slate-400 pt-1">
                  For account questions, educational partnerships, bug reports, or institutional
                  pilot inquiries, please reach out by email or submit structured feedback inside
                  the workspace.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-800 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
