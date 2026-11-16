import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
  MessageSquare,
  PlusCircle,
  XCircle,
} from 'lucide-react';
import type {
  KnowledgeLevel,
  LessonSectionKey,
  SavedLesson,
  UserPreferences,
} from '../types/learning';
import { TopicLauncherForm } from './TopicLauncherForm';

interface LearnViewProps {
  activeLesson: SavedLesson | null;
  allLessons: SavedLesson[];
  preferences: UserPreferences;
  isGenerating: boolean;
  generationError: string | null;
  onStartLesson: (params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }) => void;
  onSelectLesson: (lessonId: string) => void;
  onSelectSection: (lessonId: string, index: number, key: LessonSectionKey) => void;
  onToggleCompleteLesson: (lessonId: string) => void;
  onToggleBookmark: (lessonId: string) => void;
  onAnswerKnowledgeCheck: (
    lessonId: string,
    questionId: string,
    optionIndex: number
  ) => void;
  onAskTutorAboutSection: (lesson: SavedLesson, sectionTitle: string, sectionText: string) => void;
  onLaunchAssessmentForLesson: (lesson: SavedLesson) => void;
}

export const LESSON_SECTIONS: Array<{
  key: LessonSectionKey;
  number: string;
  title: string;
}> = [
  { key: 'introduction', number: '01', title: 'Topic Introduction' },
  { key: 'objectives', number: '02', title: 'Learning Objectives' },
  { key: 'concepts', number: '03', title: 'Fundamental Concepts' },
  { key: 'steps', number: '04', title: 'Step-by-Step Explanations' },
  { key: 'examples', number: '05', title: 'Practical Examples' },
  { key: 'applications', number: '06', title: 'Real-World Applications' },
  { key: 'terminology', number: '07', title: 'Important Terminology' },
  { key: 'summary', number: '08', title: 'Summary' },
  { key: 'knowledge-check', number: '09', title: 'Knowledge Check' },
];

export function extractSectionPlainText(
  lesson: SavedLesson,
  key: LessonSectionKey
): string {
  const p = lesson.payload;
  switch (key) {
    case 'introduction':
      return `${p.introduction.hook}\n${p.introduction.overview}\nWhy it matters: ${p.introduction.whyItMatters}`;
    case 'objectives':
      return p.learningObjectives.join('\n');
    case 'concepts':
      return p.fundamentalConcepts
        .map((c) => `${c.title}: ${c.explanation} (Takeaway: ${c.keyTakeaway})`)
        .join('\n\n');
    case 'steps':
      return p.stepByStepExplanations
        .map((s) => `Step ${s.stepNumber} — ${s.title}: ${s.explanation}`)
        .join('\n\n');
    case 'examples':
      return p.practicalExamples
        .map((e) => `${e.title}: ${e.scenario} | ${e.walkthrough} | Outcome: ${e.outcome}`)
        .join('\n\n');
    case 'applications':
      return p.realWorldApplications
        .map((a) => `${a.domain}: ${a.useCase} (${a.impact})`)
        .join('\n\n');
    case 'terminology':
      return p.importantTerminology
        .map((t) => `${t.term}: ${t.definition}`)
        .join('\n');
    case 'summary':
      return `Recap: ${p.summary.recapPoints.join('; ')}`;
    case 'knowledge-check':
      return p.knowledgeCheck.map((q) => q.question).join('\n');
  }
}

export const LearnView: React.FC<LearnViewProps> = ({
  activeLesson,
  allLessons,
  preferences,
  isGenerating,
  generationError,
  onStartLesson,
  onSelectLesson,
  onSelectSection,
  onToggleCompleteLesson,
  onToggleBookmark,
  onAnswerKnowledgeCheck,
  onAskTutorAboutSection,
  onLaunchAssessmentForLesson,
}) => {
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);

  const currentIndex = activeLesson
    ? Math.max(0, Math.min(LESSON_SECTIONS.length - 1, activeLesson.currentSectionIndex))
    : 0;
  const currentSection = LESSON_SECTIONS[currentIndex];

  const currentSectionText = useMemo(() => {
    if (!activeLesson) return '';
    return extractSectionPlainText(activeLesson, currentSection.key);
  }, [activeLesson, currentSection.key]);

  if (isGenerating && !activeLesson) {
    return (
      <div className="mx-auto max-w-[960px] py-16">
        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-10 text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-400" />
          <h2 className="font-display text-xl font-semibold text-white">
            Structuring Your Lesson
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
            Organizing objectives, core concepts, step-by-step explanations, practical
            examples, terminology, and knowledge checks...
          </p>
        </div>
      </div>
    );
  }

  if (!activeLesson || showNewTopicForm) {
    return (
      <div className="mx-auto max-w-[960px] space-y-8 pb-12">
        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                {activeLesson ? 'Start a New Lesson' : 'AI Learning Engine'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Choose any subject and knowledge depth to generate a structured 9-section lesson.
              </p>
            </div>
            {activeLesson && (
              <button
                type="button"
                onClick={() => setShowNewTopicForm(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors"
              >
                Back to Active Lesson
              </button>
            )}
          </div>

          <TopicLauncherForm
            defaultLevel={preferences.defaultLevel}
            defaultLanguage={preferences.defaultLanguage}
            isGenerating={isGenerating}
            errorMessage={generationError}
            onSubmit={(params) => {
              setShowNewTopicForm(false);
              onStartLesson(params);
            }}
          />
        </div>

        {allLessons.length > 0 && !activeLesson && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Revisit a Saved Lesson
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allLessons.slice(0, 6).map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onSelectLesson(lesson.id)}
                  className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5 text-left hover:border-sky-500/50 transition-colors"
                >
                  <div className="text-xs text-slate-400">
                    {lesson.payload.level} · {lesson.payload.language} ·{' '}
                    {lesson.completedSectionKeys.length}/9 sections
                  </div>
                  <div className="mt-1.5 font-display text-base font-semibold text-white">
                    {lesson.payload.normalizedTitle}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  const p = activeLesson.payload;
  const completedCount = activeLesson.completedSectionKeys.length;
  const progressPct = Math.round((completedCount / LESSON_SECTIONS.length) * 100);

  const goPrev = () => {
    if (currentIndex > 0) {
      const targetIdx = currentIndex - 1;
      onSelectSection(activeLesson.id, targetIdx, LESSON_SECTIONS[targetIdx].key);
    }
  };

  const goNext = () => {
    if (currentIndex < LESSON_SECTIONS.length - 1) {
      const targetIdx = currentIndex + 1;
      onSelectSection(activeLesson.id, targetIdx, LESSON_SECTIONS[targetIdx].key);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-14">
      {/* Generation overlay notice if switching while generating */}
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-200">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Generating your new structured lesson...</span>
        </div>
      )}

      {generationError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
        >
          {generationError}
        </div>
      )}

      {/* Clear Demo Banner when using Demonstration Mode */}
      {activeLesson.meta.isDemo && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-xs sm:text-sm text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" />
          <span>
            <strong>Sample Demonstration Content:</strong> This lesson is provided from
            SmartEd&apos;s offline demonstration curriculum and was not generated by live AI.
          </span>
        </div>
      )}

      {/* Lesson Header */}
      <header className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{p.level}</span>
              <span aria-hidden="true">·</span>
              <span>{p.language}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">~{p.estimatedMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <span>{activeLesson.meta.providerLabel}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {p.normalizedTitle}
            </h1>
            {p.objective && (
              <p className="text-sm text-slate-300">
                Goal: {p.objective}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleBookmark(activeLesson.id)}
              aria-pressed={activeLesson.isBookmarked}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap ${
                activeLesson.isBookmarked
                  ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-700 bg-[#060913] text-slate-300 hover:border-slate-500'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>{activeLesson.isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewTopicForm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#060913] hover:border-sky-500/50 hover:text-sky-300 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Lesson</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleCompleteLesson(activeLesson.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 min-h-[40px] text-xs font-semibold transition-colors whitespace-nowrap ${
                activeLesson.isCompleted
                  ? 'border border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {activeLesson.isCompleted ? 'Lesson Completed' : 'Complete Lesson'}
              </span>
            </button>
          </div>
        </div>

        {/* Lesson Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="h-2 flex-1 max-w-sm rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-300">
              {completedCount}/9 sections ({progressPct}%)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onAskTutorAboutSection(
                  activeLesson,
                  `${currentSection.number}. ${currentSection.title}`,
                  currentSectionText
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-cyan-500/50 px-3 py-1.5 min-h-[36px] text-xs font-medium text-cyan-300 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Ask AI Tutor About Section</span>
            </button>

            <button
              type="button"
              onClick={() => onLaunchAssessmentForLesson(activeLesson)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-sky-500/50 px-3 py-1.5 min-h-[36px] text-xs font-medium text-sky-300 transition-colors whitespace-nowrap"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Take Assessment</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column Lesson Layout: Section Rail + Active Section Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section Navigator Rail (4 cols on lg, horizontal scroll on mobile) */}
        <nav
          aria-label="Lesson sections"
          className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3"
        >
          <div className="px-2 pb-2 text-xs font-medium text-slate-400">
            Lesson Structure
          </div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {LESSON_SECTIONS.map((sec, idx) => {
              const isCurrent = idx === currentIndex;
              const isVisited = activeLesson.completedSectionKeys.includes(sec.key);
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => onSelectSection(activeLesson.id, idx, sec.key)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 min-h-[42px] text-left text-xs sm:text-sm transition-colors whitespace-nowrap lg:whitespace-normal shrink-0 ${
                    isCurrent
                      ? 'bg-sky-600/15 text-sky-300 border border-sky-500/35 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {sec.number}
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </span>
                  {isVisited && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      aria-label="Section visited"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active Section Reading Stage (8 cols) */}
        <article className="lg:col-span-8 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
            <div>
              <div className="font-mono text-xs text-cyan-400">
                Section {currentSection.number} of 09
              </div>
              <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold text-white">
                {currentSection.title}
              </h2>
            </div>
          </div>

          {/* Section Body */}
          <div className="max-w-[70ch] space-y-6">
            {currentSection.key === 'introduction' && (
              <div className="space-y-6">
                <p className="text-lg font-medium text-sky-100 leading-relaxed">
                  {p.introduction.hook}
                </p>
                <div className="space-y-2">
                  <h3 className="font-display text-sm font-semibold text-slate-300">
                    Overview
                  </h3>
                  <p className="text-[15px] text-slate-200 leading-relaxed">
                    {p.introduction.overview}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/70 space-y-2">
                  <h3 className="font-display text-sm font-semibold text-cyan-300">
                    Why It Matters
                  </h3>
                  <p className="text-[15px] text-slate-200 leading-relaxed">
                    {p.introduction.whyItMatters}
                  </p>
                </div>
              </div>
            )}

            {currentSection.key === 'objectives' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  By the end of this lesson, you will be able to:
                </p>
                <ol className="divide-y divide-slate-800/70 border-y border-slate-800/70">
                  {p.learningObjectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-4 py-4">
                      <span className="font-mono text-sm font-semibold tabular-nums text-sky-400 pt-0.5">
                        0{idx + 1}.
                      </span>
                      <span className="text-[15px] text-slate-100 leading-relaxed">
                        {obj}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {currentSection.key === 'concepts' && (
              <div className="divide-y divide-slate-800/70">
                {p.fundamentalConcepts.map((concept, idx) => (
                  <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-2.5">
                    <h3 className="font-display text-lg font-semibold text-white">
                      {concept.title}
                    </h3>
                    <p className="text-[15px] text-slate-200 leading-relaxed">
                      {concept.explanation}
                    </p>
                    <p className="text-sm text-cyan-300">
                      Key takeaway: {concept.keyTakeaway}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {currentSection.key === 'steps' && (
              <div className="divide-y divide-slate-800/70">
                {p.stepByStepExplanations.map((step, idx) => (
                  <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs font-semibold tabular-nums text-sky-400">
                        Step {String(step.stepNumber || idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-display text-lg font-semibold text-white">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-[15px] text-slate-200 leading-relaxed">
                      {step.explanation}
                    </p>
                    {step.formulaOrCue && (
                      <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-800 bg-[#060913] px-4 py-2.5 font-mono text-xs text-cyan-200">
                        {step.formulaOrCue}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentSection.key === 'examples' && (
              <div className="divide-y divide-slate-800/70">
                {p.practicalExamples.map((ex, idx) => (
                  <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-3">
                    <h3 className="font-display text-lg font-semibold text-white">
                      {ex.title}
                    </h3>
                    <div className="space-y-2 text-[15px] leading-relaxed">
                      <p className="text-slate-300">
                        <strong className="text-slate-100 font-semibold">Scenario: </strong>
                        {ex.scenario}
                      </p>
                      <p className="text-slate-200">
                        <strong className="text-slate-100 font-semibold">Walkthrough: </strong>
                        {ex.walkthrough}
                      </p>
                      <p className="text-cyan-300">
                        <strong className="font-semibold">Outcome: </strong>
                        {ex.outcome}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentSection.key === 'applications' && (
              <div className="divide-y divide-slate-800/70">
                {p.realWorldApplications.map((appItem, idx) => (
                  <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-2">
                    <div className="text-xs font-semibold text-cyan-400">
                      {appItem.domain}
                    </div>
                    <p className="text-[15px] text-slate-100 leading-relaxed">
                      {appItem.useCase}
                    </p>
                    <p className="text-sm text-slate-400">
                      Impact: {appItem.impact}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {currentSection.key === 'terminology' && (
              <dl className="divide-y divide-slate-800/70 border-y border-slate-800/70">
                {p.importantTerminology.map((entry, idx) => (
                  <div key={idx} className="py-4 space-y-1.5">
                    <dt className="font-display text-base font-semibold text-white">
                      {entry.term}
                    </dt>
                    <dd className="text-[15px] text-slate-200 leading-relaxed">
                      {entry.definition}
                    </dd>
                    <dd className="text-xs text-slate-400">
                      In context: {entry.contextExample}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {currentSection.key === 'summary' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-display text-base font-semibold text-white">
                    Key Recap Points
                  </h3>
                  <ul className="space-y-2.5 pl-5 list-disc marker:text-sky-400">
                    {p.summary.recapPoints.map((pt, idx) => (
                      <li key={idx} className="text-[15px] text-slate-200 leading-relaxed">
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-800/70 space-y-3">
                  <h3 className="font-display text-base font-semibold text-cyan-300">
                    Recommended Next Steps
                  </h3>
                  <ul className="space-y-2 pl-5 list-disc marker:text-cyan-400">
                    {p.summary.nextSteps.map((step, idx) => (
                      <li key={idx} className="text-sm text-slate-300 leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>

                {p.recommendedFollowUps?.length > 0 && (
                  <div className="pt-4 border-t border-slate-800/70 space-y-3">
                    <h3 className="font-display text-sm font-semibold text-slate-300">
                      Explore Related Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {p.recommendedFollowUps.map((nextTopic) => (
                        <button
                          key={nextTopic}
                          type="button"
                          disabled={isGenerating}
                          onClick={() =>
                            onStartLesson({
                              topic: nextTopic,
                              level: p.level,
                              language: p.language,
                            })
                          }
                          className="rounded-lg border border-slate-700 bg-[#060913] hover:border-sky-500/60 hover:text-sky-300 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors"
                        >
                          Learn: {nextTopic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentSection.key === 'knowledge-check' && (
              <div className="space-y-6">
                <p className="text-sm text-slate-400">
                  Check your grasp of {p.topic} before taking a full graded assessment.
                </p>

                {p.knowledgeCheck.map((item, qIdx) => {
                  const chosen = activeLesson.knowledgeCheckAnswers[item.id];
                  const hasAnswered = typeof chosen === 'number';
                  const isCorrect = hasAnswered && chosen === item.correctIndex;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-800 bg-[#060913] p-5 space-y-4"
                    >
                      <div className="font-display text-base font-semibold text-white">
                        {qIdx + 1}. {item.question}
                      </div>

                      <div className="space-y-2">
                        {item.options.map((opt, optIdx) => {
                          const isSelected = chosen === optIdx;
                          const isTarget = optIdx === item.correctIndex;

                          let btnStyle =
                            'border-slate-800 bg-[#0B1120] text-slate-200 hover:border-slate-600';
                          if (hasAnswered) {
                            if (isTarget) {
                              btnStyle =
                                'border-emerald-500/60 bg-emerald-950/30 text-emerald-200';
                            } else if (isSelected && !isTarget) {
                              btnStyle =
                                'border-rose-500/60 bg-rose-950/30 text-rose-200';
                            } else {
                              btnStyle =
                                'border-slate-800/70 bg-[#0B1120]/50 text-slate-400';
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                onAnswerKnowledgeCheck(activeLesson.id, item.id, optIdx)
                              }
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 min-h-[44px] text-left text-sm transition-colors ${btnStyle}`}
                            >
                              <span>{opt}</span>
                              {hasAnswered && isTarget && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                              )}
                              {hasAnswered && isSelected && !isTarget && (
                                <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {hasAnswered && (
                        <div
                          className={`rounded-lg border px-4 py-3 text-sm ${
                            isCorrect
                              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                              : 'border-amber-500/40 bg-amber-950/20 text-amber-100'
                          }`}
                        >
                          <div className="font-semibold mb-1">
                            {isCorrect ? 'Correct' : 'Review Explanation'}
                          </div>
                          <p className="text-slate-200 leading-relaxed">
                            {item.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section Navigation Controls */}
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-800/70">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:hover:border-slate-700 px-4 py-2 min-h-[42px] text-xs font-semibold text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous Section</span>
            </button>

            <div className="flex items-center gap-3">
              {currentIndex < LESSON_SECTIONS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2 min-h-[42px] text-xs font-semibold text-white transition-colors"
                >
                  <span>Next Section</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onLaunchAssessmentForLesson(activeLesson)}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-5 py-2 min-h-[42px] text-xs font-semibold text-white transition-colors"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Start Full Assessment</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};
