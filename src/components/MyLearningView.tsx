import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  AssessmentAttempt,
  NavRoute,
  SavedLesson,
} from '../types/learning';

interface MyLearningViewProps {
  lessons: SavedLesson[];
  assessments: AssessmentAttempt[];
  onOpenLesson: (lessonId: string) => void;
  onToggleBookmark: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onAskTutorForLesson: (lesson: SavedLesson) => void;
  onAssessLesson: (lesson: SavedLesson) => void;
  onNavigate: (route: NavRoute) => void;
}

type LibraryFilter = 'all' | 'in-progress' | 'completed' | 'bookmarked';

export const MyLearningView: React.FC<MyLearningViewProps> = ({
  lessons,
  assessments,
  onOpenLesson,
  onToggleBookmark,
  onDeleteLesson,
  onAskTutorForLesson,
  onAssessLesson,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: lessons.length,
      'in-progress': lessons.filter((l) => !l.isCompleted).length,
      completed: lessons.filter((l) => l.isCompleted).length,
      bookmarked: lessons.filter((l) => l.isBookmarked).length,
    }),
    [lessons]
  );

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...lessons]
      .sort(
        (a, b) =>
          new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
      )
      .filter((lesson) => {
        if (filter === 'in-progress' && lesson.isCompleted) return false;
        if (filter === 'completed' && !lesson.isCompleted) return false;
        if (filter === 'bookmarked' && !lesson.isBookmarked) return false;
        if (!q) return true;
        return (
          lesson.payload.topic.toLowerCase().includes(q) ||
          lesson.payload.normalizedTitle.toLowerCase().includes(q) ||
          lesson.payload.level.toLowerCase().includes(q)
        );
      });
  }, [lessons, filter, search]);

  return (
    <div className="mx-auto max-w-[1160px] space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            My Learning Library
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Revisit saved lessons, track bookmarks, and review your assessment history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('learn')}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white transition-colors self-start sm:self-auto"
        >
          <BookOpen className="h-4 w-4" />
          <span>Start New Lesson</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0B1120] p-1">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'in-progress', label: `In Progress (${counts['in-progress']})` },
              { id: 'completed', label: `Completed (${counts.completed})` },
              { id: 'bookmarked', label: `Bookmarked (${counts.bookmarked})` },
            ] as Array<{ id: LibraryFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3.5 py-1.5 min-h-[36px] text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter saved topics..."
            aria-label="Filter saved topics"
            className="w-full h-10 rounded-lg border border-slate-800 bg-[#0B1120] pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Lessons List */}
      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-10 text-center space-y-3">
          <BookOpen className="mx-auto h-7 w-7 text-sky-400" />
          <h2 className="font-display text-lg font-semibold text-white">
            Your learning library is empty
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
            Every lesson you generate is automatically saved here so you can resume sections,
            bookmark references, and retake assessments anytime.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Explore a Topic
            </button>
          </div>
        </div>
      ) : filteredLessons.length === 0 ? (
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-8 text-center text-sm text-slate-400">
          No saved lessons match your current filter or search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLessons.map((lesson) => {
            const pct = Math.round((lesson.completedSectionKeys.length / 9) * 100);
            const isDeleting = confirmDeleteId === lesson.id;

            return (
              <article
                key={lesson.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#0B1120] p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{lesson.payload.level}</span>
                      <span aria-hidden="true">·</span>
                      <span>{lesson.payload.language}</span>
                      {lesson.isCompleted && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Completed</span>
                          </span>
                        </>
                      )}
                      {lesson.meta.isDemo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-300">Sample Demo</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleBookmark(lesson.id)}
                      aria-label={
                        lesson.isBookmarked ? 'Remove bookmark' : 'Bookmark lesson'
                      }
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                        lesson.isBookmarked
                          ? 'text-cyan-400 bg-cyan-950/40'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  </div>

                  <h2 className="font-display text-lg font-semibold text-white">
                    {lesson.payload.normalizedTitle}
                  </h2>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {lesson.payload.introduction.overview}
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 transition-all"
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-400">
                      {lesson.completedSectionKeys.length}/9 sections
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenLesson(lesson.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 min-h-[36px] text-xs font-semibold text-white transition-colors"
                    >
                      <span>{lesson.isCompleted ? 'Revisit' : 'Continue'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onAskTutorForLesson(lesson)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-300 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-300 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Tutor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAssessLesson(lesson)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-sky-500/50 hover:text-sky-300 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-300 transition-colors"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span>Quiz</span>
                    </button>
                  </div>

                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteLesson(lesson.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-md bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(lesson.id)}
                      aria-label={`Remove ${lesson.payload.topic}`}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-300 hover:bg-slate-800/60 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Assessment History Section */}
      {assessments.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Recent Assessment Attempts
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('assessments')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              Take new assessment
            </button>
          </div>
          <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0B1120]">
            {[...assessments]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .slice(0, 5)
              .map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {attempt.topic}
                    </div>
                    <div className="text-xs text-slate-400">
                      {attempt.difficulty} · {new Date(attempt.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-cyan-300">
                      {attempt.scorePercent}%
                    </div>
                    <div className="font-mono text-xs tabular-nums text-slate-400">
                      {attempt.correctCount}/{attempt.totalQuestions} correct
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};
