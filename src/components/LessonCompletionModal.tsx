import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import type { SavedLesson } from '../types/learning';
import { SrvLogo } from './SrvLogo';

interface LessonCompletionModalProps {
  open: boolean;
  lesson: SavedLesson | null;
  onClose: () => void;
  onStartAssessment: (lesson: SavedLesson) => void;
  onStartNextTopic?: (topic: string) => void;
}

const BURST_RAYS = [
  { angle: 0, distance: 56, delay: 0.14 },
  { angle: 45, distance: 62, delay: 0.18 },
  { angle: 90, distance: 56, delay: 0.16 },
  { angle: 135, distance: 62, delay: 0.2 },
  { angle: 180, distance: 56, delay: 0.14 },
  { angle: 225, distance: 62, delay: 0.19 },
  { angle: 270, distance: 56, delay: 0.15 },
  { angle: 315, distance: 62, delay: 0.21 },
];

export const LessonCompletionModal: React.FC<LessonCompletionModalProps> = ({
  open,
  lesson,
  onClose,
  onStartAssessment,
  onStartNextTopic,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const nextTopic = lesson?.payload.recommendedFollowUps?.[0];
  const sectionsCompleted = lesson?.completedSectionKeys.length ?? 0;

  return (
    <AnimatePresence>
      {open && lesson && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03060E]/80 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lesson-completion-heading"
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.92, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={{
              duration: prefersReducedMotion ? 0 : 0.32,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-sky-500/35 bg-[#0B1120] p-6 sm:p-8 shadow-2xl shadow-sky-950/50"
          >
            {/* Top accent hairline beam */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close completion dialog"
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Animated Mastery Seal */}
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              {/* Radiating geometric burst nodes */}
              {!prefersReducedMotion &&
                BURST_RAYS.map((ray) => {
                  const rad = (ray.angle * Math.PI) / 180;
                  const tx = Math.cos(rad) * ray.distance;
                  const ty = Math.sin(rad) * ray.distance;
                  return (
                    <motion.span
                      key={ray.angle}
                      aria-hidden="true"
                      initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
                      animate={{
                        opacity: [0, 0.95, 0],
                        scale: [0.5, 1.15, 0.7],
                        x: [0, tx * 0.78, tx],
                        y: [0, ty * 0.78, ty],
                      }}
                      transition={{
                        duration: 0.95,
                        delay: ray.delay,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="pointer-events-none absolute h-1.5 w-1.5 rotate-45 bg-cyan-300"
                    />
                  );
                })}

              {/* Concentric animated SVG completion ring */}
              <svg
                viewBox="0 0 120 120"
                className="h-32 w-32"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="completion-ring-grad"
                    x1="0"
                    y1="0"
                    x2="120"
                    y2="120"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(56, 189, 248, 0.14)"
                  strokeWidth="2.5"
                />

                <motion.circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#completion-ring-grad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  initial={{ pathLength: prefersReducedMotion ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </svg>

              {/* Center emblem + animated check badge */}
              <motion.div
                initial={
                  prefersReducedMotion ? { scale: 1 } : { scale: 0.75, opacity: 0 }
                }
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.38,
                  delay: prefersReducedMotion ? 0 : 0.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <SrvLogo size={46} showMonogram={false} />
                <motion.div
                  initial={
                    prefersReducedMotion ? { scale: 1 } : { scale: 0, opacity: 0 }
                  }
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.3,
                    delay: prefersReducedMotion ? 0 : 0.45,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="-mt-1 inline-flex items-center gap-1 rounded-md bg-[#060913] border border-emerald-500/45 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>Completed</span>
                </motion.div>
              </motion.div>
            </div>

            {/* Celebration Copy */}
            <div className="mt-4 text-center space-y-2">
              <div className="text-xs font-medium tracking-wide text-cyan-400">
                Lesson Milestone Reached
              </div>
              <h2
                id="lesson-completion-heading"
                className="font-display text-2xl font-bold text-white"
              >
                {lesson.payload.normalizedTitle}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                You completed this lesson and saved your progress to your SmartEd
                workspace.
              </p>
              <div className="pt-1 flex items-center justify-center gap-2 text-xs text-slate-400 tabular-nums">
                <span>{lesson.payload.level}</span>
                <span aria-hidden="true">·</span>
                <span>{lesson.payload.language}</span>
                <span aria-hidden="true">·</span>
                <span>{sectionsCompleted}/9 sections explored</span>
              </div>
            </div>

            {/* Next Actions */}
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartAssessment(lesson);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Take Full Assessment</span>
              </button>

              {nextTopic && onStartNextTopic && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartNextTopic(nextTopic);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/45 bg-cyan-950/30 hover:border-cyan-400 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-cyan-200 transition-colors"
                >
                  <span className="truncate max-w-[180px]">Next: {nextTopic}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 hover:border-slate-500 px-4 py-2.5 min-h-[44px] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                Continue Reviewing
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
