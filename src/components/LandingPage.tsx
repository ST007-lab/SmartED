import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  GraduationCap,
  Loader2,
  MessageSquare,
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  authError: string | null;
}

const HERO_IMAGE_PATH = '/src/assets/images/hero_smarted_workspace_1794738910334.jpg';

const WORKFLOW_STEPS = [
  {
    index: '01',
    title: 'Enter Any Topic & Depth',
    description:
      'Choose any subject, pick Beginner, Intermediate, or Advanced, and optionally specify your learning language or goal.',
  },
  {
    index: '02',
    title: 'Learn Through 9 Structured Sections',
    description:
      'Progress step by step through introductions, objectives, core concepts, worked examples, terminology, and inline checks.',
  },
  {
    index: '03',
    title: 'Clear Doubts with Context-Aware AI',
    description:
      'Ask your AI tutor about the exact section you are reading—request analogies, simpler terms, or step-by-step derivations.',
  },
  {
    index: '04',
    title: 'Verify Mastery & Sync Progress',
    description:
      'Complete multi-format assessments with instant explanations and save every lesson, conversation, and score to your account.',
  },
];

const LESSON_BLUEPRINT_ITEMS = [
  '01. Topic Introduction',
  '02. Learning Objectives',
  '03. Fundamental Concepts',
  '04. Step-by-Step Explanations',
  '05. Practical Examples',
  '06. Real-World Applications',
  '07. Important Terminology',
  '08. Summary & Next Steps',
  '09. Interactive Knowledge Check',
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isSigningIn,
  authError,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060913]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] flex h-16 items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-element brand wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            SmartEd
          </a>

          {/* Zone 2: Concise single-line nav links */}
          <nav
            aria-label="Landing sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <a
              href="#workflow"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#capabilities"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#architecture"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Curriculum
            </a>
            <a
              href="#st-group"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              ST Group
            </a>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-60 px-4 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In with Google</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-16 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium tracking-wide text-cyan-400">
                ST Group Educational Technology
              </p>

              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)' }}
              >
                Learn Anything. Understand Everything.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[58ch]">
                SmartEd turns any subject into a structured nine-section lesson, pairs it
                with a context-aware AI tutor that checks your reasoning honestly, and
                saves every quiz and milestone to your Google account.
              </p>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
                >
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-60 px-6 py-3.5 min-h-[48px] text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Connecting Google Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with Google</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <a
                  href="#workflow"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 hover:border-slate-500 px-5 py-3.5 min-h-[48px] text-sm font-medium text-slate-200 transition-colors whitespace-nowrap"
                >
                  See How It Works
                </a>
              </div>

              <div className="pt-2 text-xs text-slate-400">
                Google Sign-In · Cloud Firestore Sync · Beginner to Advanced
              </div>
            </div>

            {/* Hero Visual Container */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0B1120] min-h-[280px] lg:min-h-[380px]">
                {!imageFailed ? (
                  <>
                    <img
                      src={HERO_IMAGE_PATH}
                      alt="SmartEd dark architectural study workspace with interconnected knowledge pathways"
                      referrerPolicy="no-referrer"
                      onError={() => setImageFailed(true)}
                      className="h-full w-full object-cover"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#060913]/85 via-[#060913]/20 to-transparent"
                    />
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-10 bg-gradient-to-br from-[#0B1120] via-[#060913] to-[#0E172A]">
                    <GraduationCap className="h-12 w-12 text-sky-400" />
                    <div className="mt-4 font-display text-lg font-semibold text-white">
                      SmartEd Learning Workspace
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 p-6">
                  <div className="text-xs font-medium text-cyan-300">
                    Personal AI Teaching Workspace
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold text-white">
                    Structured lessons, live tutoring, and verified assessments in one flow.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mechanism / Workflow Section */}
        <section
          id="workflow"
          className="border-t border-slate-800/70 bg-[#080D1A] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-cyan-400">Learning Workflow</p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white">
                Built around genuine comprehension, not passive reading
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.index}
                  className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-3"
                >
                  <div className="font-mono text-xs font-semibold tabular-nums text-sky-400">
                    {step.index}
                  </div>
                  <h3 className="font-display text-base font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Capabilities Asymmetric Grid */}
        <section
          id="capabilities"
          className="border-t border-slate-800/70 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-cyan-400">Platform Capabilities</p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white">
                Four integrated engines inside one workspace
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-7 space-y-4">
                <BookOpen className="h-6 w-6 text-sky-400" />
                <h3 className="font-display text-xl font-semibold text-white">
                  01. Adaptive Nine-Section Learning Engine
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Every topic you enter—from quantum interference to macroeconomic policy—is
                  organized into nine navigable sections tailored to your selected
                  knowledge level and preferred language. Revisit any section at any time
                  and track section-by-section completion.
                </p>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-7 space-y-4">
                <MessageSquare className="h-6 w-6 text-cyan-400" />
                <h3 className="font-display text-xl font-semibold text-white">
                  02. Context-Grounded AI Tutor
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Switch between Clear Explanation, Simplify, Analogy, Step-by-Step, and
                  Intuition Testing. Your tutor challenges faulty premises honestly and
                  acknowledges uncertainty rather than fabricating answers.
                </p>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-7 space-y-4">
                <ClipboardCheck className="h-6 w-6 text-sky-400" />
                <h3 className="font-display text-xl font-semibold text-white">
                  03. Interactive Assessment Engine
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Practice with multiple choice, true/false, fill-in-the-blanks, and short
                  answers one question at a time. Answers stay hidden until submission,
                  followed by immediate explanations and incorrect-only review.
                </p>
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-7 space-y-4">
                <Database className="h-6 w-6 text-cyan-400" />
                <h3 className="font-display text-xl font-semibold text-white">
                  04. Persistent Cloud Database &amp; Real Progress Tracking
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Sign in once with your Google account to sync saved lessons, bookmarks,
                  tutor conversation history, assessment scores, and daily study activity
                  across devices—powered by Firebase Authentication and Cloud Firestore.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Curriculum Structure & CTA */}
        <section
          id="architecture"
          className="border-t border-slate-800/70 bg-[#080D1A] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-6 space-y-4">
              <p className="text-xs font-medium text-cyan-400">Lesson Architecture</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                What every SmartEd lesson builds for you
              </h2>
              <p className="text-base text-slate-300 leading-relaxed max-w-[54ch]">
                Rather than dumping a wall of unstructured text, SmartEd generates a
                consistent nine-part study guide you can read step by step and verify
                before moving on.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-6 py-3 min-h-[44px] text-sm font-semibold text-white transition-colors"
                >
                  <span>Sign In with Google to Open Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8">
              <ol className="divide-y divide-slate-800/70">
                {LESSON_BLUEPRINT_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 text-sm text-slate-200"
                  >
                    <span>{item}</span>
                    <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer
        id="st-group"
        className="border-t border-slate-800/80 bg-[#060913] py-10"
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-display text-base font-bold text-white">
              SmartEd by ST Group
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Learn Anything. Understand Everything.
            </div>
          </div>

          <button
            type="button"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </footer>
    </div>
  );
};
