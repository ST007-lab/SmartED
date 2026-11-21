import React, { useEffect } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  X,
} from 'lucide-react';
import { SrvLogo } from './SrvLogo';

interface OnboardingModalProps {
  open: boolean;
  dailyLimit: number;
  onClose: () => void;
  onStartTopic: () => void;
}

const STEPS = [
  {
    step: '01',
    title: 'Structured 9-Section Lessons',
    body: 'Instead of an unstructured chat wall, every topic is taught across 9 guided stages—from hook and objectives to worked examples, terminology, and checks.',
    icon: BookOpen,
  },
  {
    step: '02',
    title: 'Section-Aware AI Teacher',
    body: 'Stuck on a formula or concept? Click "Ask AI Tutor About Section" to open a teacher chat grounded in the exact section you are reading.',
    icon: MessageSquare,
  },
  {
    step: '03',
    title: 'Grounded Quizzes & Mistake Review',
    body: 'Assessments are built directly from your lesson concepts. Review missed questions one by one and jump back into the AI Tutor to reinforce weak areas.',
    icon: ClipboardCheck,
  },
  {
    step: '04',
    title: 'Saved Progress & Fair-Use Allowance',
    body: 'All lessons, chats, and quiz scores sync automatically to your Google account. Standard accounts include up to 5 new topics per day while saved lessons stay free to revisit anytime.',
    icon: BarChart3,
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  dailyLimit,
  onClose,
  onStartTopic,
}) => {
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
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0B1120] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <SrvLogo size={34} />
            <div>
              <p className="text-xs font-medium text-cyan-400">
                Welcome to SmartEd by ST Group
              </p>
              <h2 id="onboarding-title" className="font-display text-xl font-bold text-white">
                How Your Personal AI Teacher Works
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STEPS.map((item) => {
              const Icon = item.icon;
              const bodyText =
                item.step === '04'
                  ? item.body.replace('5 new topics', `${dailyLimit} new topics`)
                  : item.body;
              return (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-800/80 bg-[#060913] p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-sky-400">
                      {item.step}
                    </span>
                    <Icon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {bodyText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4 bg-[#080D1A]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 hover:border-slate-500 px-4 py-2 min-h-[40px] text-xs font-medium text-slate-300 transition-colors"
          >
            Got It
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onStartTopic();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
          >
            <span>Start a Lesson Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
