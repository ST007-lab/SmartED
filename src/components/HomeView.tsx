import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Compass } from 'lucide-react';
import { CURATED_TOPIC_PROMPTS } from '../data/suggestedTopics';
import type {
  AssessmentAttempt,
  KnowledgeLevel,
  NavRoute,
  ProviderStatusInfo,
  SavedLesson,
  UserPreferences,
} from '../types/learning';
import { TopicLauncherForm } from './TopicLauncherForm';

interface HomeViewProps {
  lessons: SavedLesson[];
  assessments: AssessmentAttempt[];
  preferences: UserPreferences;
  providerStatus: ProviderStatusInfo | null;
  isGenerating: boolean;
  generationError: string | null;
  onStartLesson: (params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }) => void;
  onOpenLesson: (lessonId: string) => void;
  onNavigate: (route: NavRoute) => void;
}

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const HomeView: React.FC<HomeViewProps> = ({
  lessons,
  assessments,
  preferences,
  providerStatus,
  isGenerating,
  generationError,
  onStartLesson,
  onOpenLesson,
  onNavigate,
}) => {
  const sortedByRecent = [...lessons].sort(
    (a, b) =>
      new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
  );
  const inProgressLessons = sortedByRecent.filter((l) => !l.isCompleted);
  const completedLessons = sortedByRecent.filter((l) => l.isCompleted);

  const avgScore =
    assessments.length > 0
      ? Math.round(
          assessments.reduce((acc, item) => acc + item.scorePercent, 0) /
            assessments.length
        )
      : null;

  // Recommendations derived from real follow-up topics in studied lessons
  const followUpRecommendations = Array.from(
    new Set(
      sortedByRecent.flatMap((l) => l.payload.recommendedFollowUps || [])
    )
  )
    .filter(
      (rec) =>
        !lessons.some(
          (l) => l.payload.topic.toLowerCase() === rec.toLowerCase()
        )
    )
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-[1200px] space-y-10 pb-12">
      {/* Hero / Prominent Topic Input */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl"
        />

        <div className="relative max-w-3xl">
          <p className="text-xs font-medium tracking-wide text-cyan-400">
            SmartEd Personal Learning Environment · ST Group
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Learn Anything. Understand Everything.
          </h1>
          <p className="mt-3 text-base text-slate-300 leading-relaxed max-w-[65ch]">
            Enter any subject to generate a structured nine-part lesson, explore concepts
            with your context-aware AI tutor, and validate mastery with interactive assessments.
          </p>
        </div>

        <div className="relative mt-7">
          <TopicLauncherForm
            defaultLevel={preferences.defaultLevel}
            defaultLanguage={preferences.defaultLanguage}
            isGenerating={isGenerating}
            errorMessage={generationError}
            onSubmit={onStartLesson}
          />
        </div>

        {providerStatus && !providerStatus.liveAvailable && (
          <p className="mt-4 text-xs text-amber-300/90">
            Demonstration Mode active: Live AI provider is not currently configured on the
            server, so lessons will load clearly labeled sample curriculum.
          </p>
        )}
      </section>

      {/* Progress Overview Strip (Strictly Real Data) */}
      <section aria-label="Progress Overview">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Progress Overview
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('progress')}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
          >
            View full analytics
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
            <div className="text-xs font-medium text-slate-400">Topics Studied</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
              {lessons.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {lessons.length === 0 ? 'Start a topic above' : 'Saved in library'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
            <div className="text-xs font-medium text-slate-400">Lessons Completed</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
              {completedLessons.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {inProgressLessons.length} in progress
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
            <div className="text-xs font-medium text-slate-400">Assessments Taken</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
              {assessments.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {assessments.length === 0 ? 'No attempts yet' : 'Scored attempts'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
            <div className="text-xs font-medium text-slate-400">Average Score</div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-cyan-300">
              {avgScore !== null ? `${avgScore}%` : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {avgScore !== null ? 'Across completed quizzes' : 'Take a quiz to score'}
            </div>
          </div>
        </div>
      </section>

      {/* Continue Learning & Recently Studied */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Continue Learning (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Continue Learning
            </h2>
            {lessons.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('my-learning')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                Open library
              </button>
            )}
          </div>

          {inProgressLessons.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-sky-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {completedLessons.length > 0
                      ? 'All started lessons are complete'
                      : 'No lessons in progress yet'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                    {completedLessons.length > 0
                      ? 'Enter a new topic above or pick a recommended follow-up topic to keep building mastery.'
                      : 'Search any concept above or select an exploration topic to generate your first structured lesson.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0B1120]">
              {inProgressLessons.slice(0, 4).map((lesson) => {
                const pct = Math.round((lesson.completedSectionKeys.length / 9) * 100);
                return (
                  <div
                    key={lesson.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-800/25 transition-colors"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{lesson.payload.level}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.payload.language}</span>
                        <span aria-hidden="true">·</span>
                        <span>Studied {formatRelativeDate(lesson.lastStudiedAt)}</span>
                        {lesson.meta.isDemo && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300">Sample Demo</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-base font-semibold text-white truncate">
                        {lesson.payload.normalizedTitle}
                      </h3>
                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-1.5 w-36 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-slate-400">
                          {lesson.completedSectionKeys.length}/9 sections
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenLesson(lesson.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-sky-500/60 hover:text-sky-300 px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Resume</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recently Studied Topics */}
          {sortedByRecent.length > 0 && (
            <div className="pt-4 space-y-3">
              <h2 className="font-display text-lg font-semibold text-white">
                Recently Studied Topics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedByRecent.slice(0, 4).map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onOpenLesson(lesson.id)}
                    className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 text-left hover:border-sky-500/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{lesson.payload.level}</span>
                        {lesson.isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="font-mono tabular-nums">
                            {lesson.completedSectionKeys.length}/9
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-display text-sm font-semibold text-white line-clamp-1">
                        {lesson.payload.topic}
                      </h3>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Updated {formatRelativeDate(lesson.lastStudiedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Recommendations & Quick Exploration (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              {followUpRecommendations.length > 0
                ? 'Recommended Next Topics'
                : 'Explore a Topic'}
            </h2>
            <span className="text-xs text-slate-400">
              {followUpRecommendations.length > 0 ? 'Based on your lessons' : 'Starter ideas'}
            </span>
          </div>

          <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0B1120]">
            {followUpRecommendations.length > 0
              ? followUpRecommendations.map((topicName) => (
                  <div
                    key={topicName}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-slate-800/25 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-cyan-400">Recommended Follow-Up</div>
                      <div className="mt-0.5 text-sm font-medium text-white truncate">
                        {topicName}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() =>
                        onStartLesson({
                          topic: topicName,
                          level: preferences.defaultLevel,
                          language: preferences.defaultLanguage,
                        })
                      }
                      className="rounded-lg border border-slate-700 hover:border-sky-500/60 hover:text-sky-300 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      Learn
                    </button>
                  </div>
                ))
              : CURATED_TOPIC_PROMPTS.map((item) => (
                  <div
                    key={item.topic}
                    className="flex items-start justify-between gap-3 p-4 hover:bg-slate-800/25 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{item.discipline}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.suggestedLevel}</span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-white">
                        {item.topic}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() =>
                        onStartLesson({
                          topic: item.topic,
                          level: item.suggestedLevel,
                          language: preferences.defaultLanguage,
                        })
                      }
                      className="mt-1 rounded-lg border border-slate-700 hover:border-sky-500/60 hover:text-sky-300 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      Start
                    </button>
                  </div>
                ))}
          </div>

          {/* Quick Jump Workflows */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('tutor')}
              className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 text-left hover:border-sky-500/50 transition-colors"
            >
              <Compass className="h-4 w-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">Ask AI Tutor</div>
                <div className="text-[11px] text-slate-400 truncate">Clear doubts</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('assessments')}
              className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 text-left hover:border-sky-500/50 transition-colors"
            >
              <ClipboardCheck className="h-4 w-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">Assessments</div>
                <div className="text-[11px] text-slate-400 truncate">Test mastery</div>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
