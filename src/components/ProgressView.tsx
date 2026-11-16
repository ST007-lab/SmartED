import React from 'react';
import { BarChart3, BookOpen, MessageSquare } from 'lucide-react';
import { getAssessmentWeakTopics } from '../services/storage';
import type {
  AssessmentAttempt,
  DailyActivityRecord,
  NavRoute,
  SavedLesson,
} from '../types/learning';

interface ProgressViewProps {
  lessons: SavedLesson[];
  assessments: AssessmentAttempt[];
  activityByDate: Record<string, DailyActivityRecord>;
  onOpenLesson: (lessonId: string) => void;
  onPracticeWeakArea: (topic: string, prompt: string) => void;
  onNavigate: (route: NavRoute) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  lessons,
  assessments,
  activityByDate,
  onOpenLesson,
  onPracticeWeakArea,
  onNavigate,
}) => {
  const completedLessons = lessons.filter((l) => l.isCompleted);
  const incompleteLessons = lessons.filter((l) => !l.isCompleted);
  const totalSectionsCompleted = lessons.reduce(
    (sum, l) => sum + l.completedSectionKeys.length,
    0
  );
  const avgScore =
    assessments.length > 0
      ? Math.round(
          assessments.reduce((sum, a) => sum + a.scorePercent, 0) /
            assessments.length
        )
      : null;

  const sortedAssessments = [...assessments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const activityEntries = Object.values(activityByDate)
    .filter(
      (d) =>
        d.sectionsCompleted > 0 ||
        d.lessonsCompleted > 0 ||
        d.assessmentsCompleted > 0 ||
        d.tutorTurns > 0
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  const weakTopics = getAssessmentWeakTopics(assessments);
  const hasAnyData =
    lessons.length > 0 || assessments.length > 0 || activityEntries.length > 0;

  return (
    <div className="mx-auto max-w-[1160px] space-y-8 pb-12">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
          Progress Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Every metric below reflects only your real recorded study sessions and quiz
          attempts.
        </p>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
          <div className="text-xs font-medium text-slate-400">Topics Studied</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            {lessons.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
          <div className="text-xs font-medium text-slate-400">Lessons Completed</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            {completedLessons.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
          <div className="text-xs font-medium text-slate-400">Sections Explored</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            {totalSectionsCompleted}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
          <div className="text-xs font-medium text-slate-400">Average Score</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-cyan-300">
            {avgScore !== null ? `${avgScore}%` : '—'}
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-10 text-center space-y-3">
          <BarChart3 className="mx-auto h-8 w-8 text-sky-400" />
          <h2 className="font-display text-lg font-semibold text-white">
            No learning analytics recorded yet
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
            Charts and improvement insights appear automatically once you study lessons or
            submit assessments. Nothing here is simulated.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Start Your First Topic
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Real Charts Grid (rendered strictly when real data exists) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assessment Score Chart */}
            <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-white">
                  Assessment Scores
                </h2>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {sortedAssessments.length} attempt
                  {sortedAssessments.length === 1 ? '' : 's'}
                </span>
              </div>

              {sortedAssessments.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm text-slate-400">
                    Complete an assessment to plot your real score progression.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('assessments')}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                  >
                    Go to Assessments
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg
                    viewBox="0 0 420 180"
                    className="w-full h-44 overflow-visible"
                    role="img"
                    aria-label="Assessment score progression chart"
                  >
                    {/* Horizontal gridlines */}
                    {[0, 25, 50, 75, 100].map((val) => {
                      const y = 150 - (val / 100) * 130;
                      return (
                        <g key={val}>
                          <line
                            x1="34"
                            x2="408"
                            y1={y}
                            y2={y}
                            stroke="#1e293b"
                            strokeWidth="1"
                          />
                          <text
                            x="26"
                            y={y + 4}
                            textAnchor="end"
                            fill="#64748b"
                            fontSize="10"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars for each attempt */}
                    {sortedAssessments.slice(-8).map((attempt, idx, arr) => {
                      const slotW = (408 - 44) / Math.max(1, arr.length);
                      const barW = Math.min(34, slotW * 0.62);
                      const x = 44 + idx * slotW + (slotW - barW) / 2;
                      const barH = Math.max(4, (attempt.scorePercent / 100) * 130);
                      const y = 150 - barH;
                      return (
                        <g key={attempt.id}>
                          <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={barH}
                            rx="4"
                            fill="#0ea5e9"
                          />
                          <text
                            x={x + barW / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fill="#bae6fd"
                            fontSize="10"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {attempt.scorePercent}%
                          </text>
                          <text
                            x={x + barW / 2}
                            y="168"
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="9"
                          >
                            {attempt.topic.slice(0, 8)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </section>

            {/* Real Daily Learning Activity Chart */}
            <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-white">
                  Learning Activity
                </h2>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {activityEntries.length} active day
                  {activityEntries.length === 1 ? '' : 's'}
                </span>
              </div>

              {activityEntries.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  Daily activity bars appear as you explore sections, chat with the AI
                  tutor, and finish quizzes.
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const totals = activityEntries.map(
                      (d) =>
                        d.sectionsCompleted +
                        d.lessonsCompleted * 2 +
                        d.assessmentsCompleted * 2 +
                        d.tutorTurns
                    );
                    const maxVal = Math.max(1, ...totals);

                    return (
                      <svg
                        viewBox="0 0 420 180"
                        className="w-full h-44 overflow-visible"
                        role="img"
                        aria-label="Daily learning activity chart"
                      >
                        <line
                          x1="34"
                          x2="408"
                          y1="150"
                          y2="150"
                          stroke="#1e293b"
                          strokeWidth="1"
                        />
                        {activityEntries.map((entry, idx) => {
                          const total = totals[idx];
                          const slotW = (408 - 44) / Math.max(1, activityEntries.length);
                          const barW = Math.min(34, slotW * 0.62);
                          const x = 44 + idx * slotW + (slotW - barW) / 2;
                          const barH = Math.max(6, (total / maxVal) * 125);
                          const y = 150 - barH;
                          return (
                            <g key={entry.date}>
                              <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={barH}
                                rx="4"
                                fill="#22d3ee"
                              />
                              <text
                                x={x + barW / 2}
                                y={y - 6}
                                textAnchor="middle"
                                fill="#a5f3fc"
                                fontSize="10"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {total}
                              </text>
                              <text
                                x={x + barW / 2}
                                y="168"
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize="9"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {entry.date.slice(5)}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                  <p className="text-xs text-slate-500">
                    Activity units count completed sections, tutor exchanges, and
                    assessments per day.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Areas Needing Improvement */}
          <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">
              Areas Needing Improvement
            </h2>

            {weakTopics.length === 0 && incompleteLessons.length === 0 ? (
              <p className="text-sm text-slate-400">
                No weak areas flagged yet—your completed lessons and assessment scores
                are on track.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {weakTopics.map((item) => (
                  <div
                    key={item.topic}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {item.topic}
                      </div>
                      <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        Accuracy: {item.accuracy}% · {item.missedCount} question
                        {item.missedCount === 1 ? '' : 's'} missed
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onPracticeWeakArea(
                          item.topic,
                          `I had ${item.accuracy}% accuracy in my assessment on ${item.topic}. Can you help me strengthen the core concepts step by step?`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-950/50 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-cyan-300 transition-colors self-start sm:self-auto"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Practice with Tutor</span>
                    </button>
                  </div>
                ))}

                {incompleteLessons.slice(0, 4).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {lesson.payload.normalizedTitle}
                      </div>
                      <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        In progress: {lesson.completedSectionKeys.length}/9 sections
                        completed
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLesson(lesson.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-sky-500/50 hover:text-sky-300 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-slate-200 transition-colors self-start sm:self-auto"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Finish Lesson</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
