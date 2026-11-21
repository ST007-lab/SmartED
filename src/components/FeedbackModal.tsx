import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, MessageSquarePlus, X } from 'lucide-react';
import {
  fetchUserFeedback,
  submitFeedbackToFirestore,
} from '../services/firestoreSync';
import type {
  FeedbackCategory,
  FeedbackRatings,
  FeedbackSubmission,
} from '../types/learning';

interface FeedbackModalProps {
  open: boolean;
  uid: string;
  userDisplayName: string;
  userEmail: string;
  defaultTopic?: string;
  onClose: () => void;
}

const RATING_FIELDS: Array<{ key: keyof FeedbackRatings; label: string }> = [
  { key: 'lessonUsefulness', label: 'Lesson Usefulness' },
  { key: 'explanationClarity', label: 'Explanation Clarity' },
  { key: 'assessmentQuality', label: 'Assessment Quality' },
  { key: 'overallExperience', label: 'Overall Experience' },
];

const CATEGORIES: Array<{ id: FeedbackCategory; label: string }> = [
  { id: 'general', label: 'General Feedback' },
  { id: 'feature', label: 'Feature Request' },
  { id: 'issue', label: 'Report Issue / Inaccuracy' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  uid,
  userDisplayName,
  userEmail,
  defaultTopic,
  onClose,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [topicContext, setTopicContext] = useState(defaultTopic || '');
  const [ratings, setRatings] = useState<FeedbackRatings>({
    lessonUsefulness: 5,
    explanationClarity: 5,
    assessmentQuality: 5,
    overallExperience: 5,
  });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [history, setHistory] = useState<FeedbackSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTopicContext(defaultTopic || '');
    setSubmitSuccess(false);
    setSubmitError(null);
    setLoadingHistory(true);
    fetchUserFeedback(uid)
      .then(setHistory)
      .catch(() => {
        // Non-blocking
      })
      .finally(() => setLoadingHistory(false));
  }, [open, uid, defaultTopic]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const saved = await submitFeedbackToFirestore({
        uid,
        userDisplayName,
        userEmail,
        category,
        topicContext,
        ratings,
        comment,
      });
      setHistory((prev) => [saved, ...prev]);
      setComment('');
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to save feedback right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportMine = () => {
    const json = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        platform: 'SmartEd by ST Group',
        submissions: history,
      },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smarted-my-feedback-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#0B1120] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <MessageSquarePlus className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="feedback-modal-title" className="font-display text-lg font-bold text-white">
                Learner Feedback &amp; Issue Report
              </h2>
              <p className="text-xs text-slate-400">
                Rate lesson quality, request features, or report any inaccuracy to ST Group.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback modal"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Submission Type
              </span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-lg border px-3.5 py-2 min-h-[38px] text-xs font-medium transition-colors whitespace-nowrap ${
                      category === cat.id
                        ? 'border-sky-500/60 bg-sky-600/20 text-sky-200'
                        : 'border-slate-800 bg-[#060913] text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 1-5 Ratings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RATING_FIELDS.map((field) => {
                const current = ratings[field.key];
                return (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-800 bg-[#060913] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{field.label}</span>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {current}/5
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() =>
                            setRatings((prev) => ({ ...prev, [field.key]: score }))
                          }
                          aria-label={`${field.label}: ${score} out of 5`}
                          className={`rounded-md py-1.5 font-mono text-xs font-semibold transition-colors ${
                            current === score
                              ? 'bg-sky-600 text-white'
                              : 'bg-[#0B1120] text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="feedback-topic-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Related Lesson Topic (optional)
              </label>
              <input
                id="feedback-topic-input"
                type="text"
                maxLength={200}
                value={topicContext}
                onChange={(e) => setTopicContext(e.target.value)}
                placeholder="e.g., Quantum Computing"
                className="w-full h-10 rounded-lg border border-slate-700 bg-[#060913] px-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="feedback-comment-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Comments, Feature Requests, or Issue Details
              </label>
              <textarea
                id="feedback-comment-input"
                rows={3}
                maxLength={2000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us what worked well or what could be clearer..."
                className="w-full rounded-xl border border-slate-700 bg-[#060913] p-3.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200"
              >
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Thank you! Your feedback has been saved for ST Group review.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {history.length > 0 ? (
                <button
                  type="button"
                  onClick={handleExportMine}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 hover:border-sky-500/50 hover:text-sky-300 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-300 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export My Feedback ({history.length})</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-5 py-2 min-h-[40px] text-xs font-semibold text-white transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Submit Feedback</span>
                )}
              </button>
            </div>
          </form>

          {/* Past User Submissions */}
          {!loadingHistory && history.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <div className="text-xs font-medium text-slate-400">
                Your Recent Submissions
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-800/80 bg-[#060913] px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 text-slate-400">
                      <span className="capitalize font-medium text-slate-200">
                        {item.category}
                        {item.topicContext ? ` · ${item.topicContext}` : ''}
                      </span>
                      <span className="font-mono tabular-nums text-cyan-300">
                        Overall {item.ratings.overallExperience}/5
                      </span>
                    </div>
                    {item.comment && (
                      <p className="mt-1 text-slate-300 line-clamp-2">{item.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
