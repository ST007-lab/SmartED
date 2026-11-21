import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { getFirebaseProjectUrl } from '../services/firebase';
import {
  fetchAllFeedbackForAdmin,
  fetchPlatformGrowthData,
} from '../services/firestoreSync';
import type {
  FeedbackSubmission,
  PlatformGrowthSnapshot,
} from '../types/learning';

export const GrowthView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<PlatformGrowthSnapshot | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadGrowth = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, feedback] = await Promise.all([
        fetchPlatformGrowthData(),
        fetchAllFeedbackForAdmin().catch(() => [] as FeedbackSubmission[]),
      ]);
      setSnapshot(data);
      setFeedbackList(feedback);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load platform growth metrics.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGrowth();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!snapshot) return [];
    const q = search.trim().toLowerCase();
    if (!q) return snapshot.users;
    return snapshot.users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [snapshot, search]);

  const feedbackAverages = useMemo(() => {
    if (feedbackList.length === 0) return null;
    const sum = feedbackList.reduce(
      (acc, f) => ({
        lessonUsefulness: acc.lessonUsefulness + f.ratings.lessonUsefulness,
        explanationClarity: acc.explanationClarity + f.ratings.explanationClarity,
        assessmentQuality: acc.assessmentQuality + f.ratings.assessmentQuality,
        overallExperience: acc.overallExperience + f.ratings.overallExperience,
      }),
      {
        lessonUsefulness: 0,
        explanationClarity: 0,
        assessmentQuality: 0,
        overallExperience: 0,
      }
    );
    const n = feedbackList.length;
    return {
      lessonUsefulness: (sum.lessonUsefulness / n).toFixed(1),
      explanationClarity: (sum.explanationClarity / n).toFixed(1),
      assessmentQuality: (sum.assessmentQuality / n).toFixed(1),
      overallExperience: (sum.overallExperience / n).toFixed(1),
    };
  }, [feedbackList]);

  const exportFeedbackJson = () => {
    const json = JSON.stringify(
      { exportedAt: new Date().toISOString(), count: feedbackList.length, feedback: feedbackList },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smarted-platform-feedback-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFeedbackCsv = () => {
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = [
      'id',
      'createdAt',
      'userDisplayName',
      'userEmail',
      'category',
      'topicContext',
      'lessonUsefulness',
      'explanationClarity',
      'assessmentQuality',
      'overallExperience',
      'comment',
    ].join(',');
    const rows = feedbackList.map((f) =>
      [
        f.id,
        f.createdAt,
        f.userDisplayName,
        f.userEmail,
        f.category,
        f.topicContext ?? '',
        f.ratings.lessonUsefulness,
        f.ratings.explanationClarity,
        f.ratings.assessmentQuality,
        f.ratings.overallExperience,
        f.comment,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smarted-platform-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            ST Group Owner Analytics
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            SmartEd Platform Growth
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live registered learners, sign-up growth, lesson volume, and quiz performance
            queried directly from Cloud Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadGrowth()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0B1120] hover:border-sky-500/60 hover:text-sky-300 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <a
            href={getFirebaseProjectUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
          >
            <span>Open Firebase Console</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-12 text-center space-y-3">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-400" />
          <p className="text-sm text-slate-400">
            Loading live platform metrics from Firestore...
          </p>
        </div>
      ) : snapshot ? (
        <>
          {/* Platform KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
              <div className="text-xs font-medium text-slate-400">
                Registered Users
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-white">
                {snapshot.totalUsers}
              </div>
              <div className="mt-1 text-xs text-cyan-300 font-mono tabular-nums">
                {snapshot.activeLast7Days} active in last 7d
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
              <div className="text-xs font-medium text-slate-400">
                Total Lessons Generated
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-white">
                {snapshot.totalLessons}
              </div>
              <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                {snapshot.completedLessons} completed
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
              <div className="text-xs font-medium text-slate-400">
                Assessments Completed
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-white">
                {snapshot.totalAssessments}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Across all learners
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5">
              <div className="text-xs font-medium text-slate-400">
                Global Average Score
              </div>
              <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-cyan-300">
                {snapshot.globalAverageScore !== null
                  ? `${snapshot.globalAverageScore}%`
                  : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Real submitted attempts
              </div>
            </div>
          </div>

          {/* Growth Chart + Top Topics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-white">
                  Cumulative User Growth
                </h2>
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {snapshot.signupsByDate.length} signup day
                  {snapshot.signupsByDate.length === 1 ? '' : 's'}
                </span>
              </div>

              {snapshot.signupsByDate.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  User growth curve appears as learners register with Google.
                </div>
              ) : (
                <svg
                  viewBox="0 0 460 190"
                  className="w-full h-48 overflow-visible"
                  role="img"
                  aria-label="Cumulative registered users growth chart"
                >
                  {(() => {
                    const data = snapshot.signupsByDate.slice(-12);
                    const maxCum = Math.max(1, ...data.map((d) => d.cumulativeUsers));
                    const slotW = (440 - 44) / Math.max(1, data.length);
                    return (
                      <>
                        <line
                          x1="36"
                          x2="444"
                          y1="154"
                          y2="154"
                          stroke="#1e293b"
                          strokeWidth="1"
                        />
                        {data.map((pt, idx) => {
                          const barW = Math.min(34, slotW * 0.6);
                          const x = 44 + idx * slotW + (slotW - barW) / 2;
                          const h = Math.max(8, (pt.cumulativeUsers / maxCum) * 124);
                          const y = 154 - h;
                          return (
                            <g key={pt.date}>
                              <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={h}
                                rx="4"
                                fill="#0284c7"
                              />
                              <text
                                x={x + barW / 2}
                                y={y - 6}
                                textAnchor="middle"
                                fill="#e0f2fe"
                                fontSize="10"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {pt.cumulativeUsers}
                              </text>
                              <text
                                x={x + barW / 2}
                                y="172"
                                textAnchor="middle"
                                fill="#94a3b8"
                                fontSize="9"
                                fontFamily="IBM Plex Mono, monospace"
                              >
                                {pt.date.slice(5)}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}
            </section>

            <section className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 space-y-5">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Popular Topics &amp; Levels
                </h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums">
                  <span>Beginner: {snapshot.levelDistribution.Beginner}</span>
                  <span>·</span>
                  <span>Intermediate: {snapshot.levelDistribution.Intermediate}</span>
                  <span>·</span>
                  <span>Advanced: {snapshot.levelDistribution.Advanced}</span>
                </div>
              </div>

              {snapshot.topTopics.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No lessons generated across the platform yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {snapshot.topTopics.map((item) => (
                    <div
                      key={item.topic}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-sm"
                    >
                      <span className="text-slate-200 truncate pr-3">
                        {item.topic}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-cyan-300 shrink-0">
                        {item.count} lesson{item.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Registered Learners Table */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Registered Learners ({snapshot.totalUsers})
                </h2>
              </div>

              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search learners by name or email..."
                  aria-label="Search registered learners"
                  className="w-full h-10 rounded-lg border border-slate-800 bg-[#0B1120] pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#0B1120]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Learner</th>
                    <th className="px-5 py-3 font-medium">Level</th>
                    <th className="px-5 py-3 font-medium text-right">Lessons</th>
                    <th className="px-5 py-3 font-medium text-right">Completed</th>
                    <th className="px-5 py-3 font-medium text-right">Quizzes</th>
                    <th className="px-5 py-3 font-medium text-right">Avg Score</th>
                    <th className="px-5 py-3 font-medium text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-800/25">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{u.displayName}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {u.defaultLevel}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-200">
                        {u.lessonsCount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-300">
                        {u.completedLessonsCount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-300">
                        {u.assessmentsCount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-cyan-300">
                        {u.assessmentsCount > 0 ? `${u.averageScore}%` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Learner Feedback & Quality Ratings */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-cyan-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Learner Feedback &amp; Issue Reports ({feedbackList.length})
                </h2>
              </div>

              {feedbackList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={exportFeedbackJson}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-sky-500/60 hover:text-sky-300 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-200 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportFeedbackCsv}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-cyan-500/60 hover:text-cyan-300 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-200 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              )}
            </div>

            {feedbackAverages && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4">
                  <div className="text-xs text-slate-400">Lesson Usefulness</div>
                  <div className="mt-1 font-mono text-xl font-bold text-white">
                    {feedbackAverages.lessonUsefulness} / 5
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4">
                  <div className="text-xs text-slate-400">Explanation Clarity</div>
                  <div className="mt-1 font-mono text-xl font-bold text-white">
                    {feedbackAverages.explanationClarity} / 5
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4">
                  <div className="text-xs text-slate-400">Assessment Quality</div>
                  <div className="mt-1 font-mono text-xl font-bold text-white">
                    {feedbackAverages.assessmentQuality} / 5
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4">
                  <div className="text-xs text-slate-400">Overall Experience</div>
                  <div className="mt-1 font-mono text-xl font-bold text-cyan-300">
                    {feedbackAverages.overallExperience} / 5
                  </div>
                </div>
              </div>
            )}

            {feedbackList.length === 0 ? (
              <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-6 text-sm text-slate-400">
                No learner feedback submissions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0B1120]">
                {feedbackList.slice(0, 12).map((fb) => (
                  <div key={fb.id} className="p-4 space-y-1.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-slate-200 font-medium">
                        {fb.userDisplayName}{' '}
                        <span className="text-slate-500">({fb.userEmail})</span>
                        <span className="ml-2 uppercase text-cyan-400">
                          {fb.category}
                        </span>
                        {fb.topicContext && (
                          <span className="ml-2 text-slate-400">
                            · {fb.topicContext}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        Overall {fb.ratings.overallExperience}/5 ·{' '}
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comment && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {fb.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};
