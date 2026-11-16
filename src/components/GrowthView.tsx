import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { getFirebaseProjectUrl } from '../services/firebase';
import { fetchPlatformGrowthData } from '../services/firestoreSync';
import type { PlatformGrowthSnapshot } from '../types/learning';

export const GrowthView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<PlatformGrowthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadGrowth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformGrowthData();
      setSnapshot(data);
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
        </>
      ) : null}
    </div>
  );
};
