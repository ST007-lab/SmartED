import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { evaluateAnswerApi, generateAssessmentApi } from '../services/api';
import type {
  AnsweredQuestionRecord,
  AssessmentAttempt,
  AssessmentDifficulty,
  GeneratedQuestion,
  KnowledgeLevel,
  ProviderMeta,
  ProviderPreference,
  QuestionType,
  SavedLesson,
} from '../types/learning';

interface AssessmentViewProps {
  lessons: SavedLesson[];
  assessments: AssessmentAttempt[];
  initialTopic?: string;
  initialLessonId?: string;
  initialLevel?: KnowledgeLevel;
  providerPreference: ProviderPreference;
  onSaveAttempt: (attempt: AssessmentAttempt) => void;
  onAskTutorAboutWeakness: (topic: string, prompt: string) => void;
}

const QUESTION_TYPE_OPTIONS: Array<{ id: QuestionType; label: string }> = [
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'true_false', label: 'True / False' },
  { id: 'fill_blank', label: 'Fill in the Blanks' },
  { id: 'short_answer', label: 'Short Answer' },
];

const DIFFICULTIES: AssessmentDifficulty[] = ['Easy', 'Medium', 'Hard'];
const QUESTION_COUNTS = [3, 5, 7, 10];

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  lessons,
  assessments,
  initialTopic,
  initialLessonId,
  initialLevel = 'Beginner',
  providerPreference,
  onSaveAttempt,
  onAskTutorAboutWeakness,
}) => {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    initialLessonId ?? ''
  );
  const [customTopic, setCustomTopic] = useState<string>(initialTopic ?? '');
  const [level, setLevel] = useState<KnowledgeLevel>(initialLevel);
  const [difficulty, setDifficulty] = useState<AssessmentDifficulty>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'multiple_choice',
    'true_false',
    'fill_blank',
    'short_answer',
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active quiz session state
  const [activeQuestions, setActiveQuestions] = useState<GeneratedQuestion[] | null>(
    null
  );
  const [activeMeta, setActiveMeta] = useState<ProviderMeta | null>(null);
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [draftAnswer, setDraftAnswer] = useState<string>('');
  const [records, setRecords] = useState<AnsweredQuestionRecord[]>([]);
  const [currentSubmittedRecord, setCurrentSubmittedRecord] =
    useState<AnsweredQuestionRecord | null>(null);
  const [completedAttempt, setCompletedAttempt] = useState<AssessmentAttempt | null>(
    null
  );
  const [reviewIncorrectOnly, setReviewIncorrectOnly] = useState(false);

  useEffect(() => {
    if (initialLessonId) {
      setSelectedLessonId(initialLessonId);
      const found = lessons.find((l) => l.id === initialLessonId);
      if (found) {
        setCustomTopic(found.payload.topic);
        setLevel(found.payload.level);
      }
    } else if (initialTopic) {
      setCustomTopic(initialTopic);
    }
  }, [initialLessonId, initialTopic, lessons]);

  const handleLessonPick = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    const found = lessons.find((l) => l.id === lessonId);
    if (found) {
      setCustomTopic(found.payload.topic);
      setLevel(found.payload.level);
    }
  };

  const toggleQuestionType = (type: QuestionType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // require at least 1 type
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const startAssessment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetLesson = lessons.find((l) => l.id === selectedLessonId);
    const topicToUse = (customTopic.trim() || targetLesson?.payload.topic || '').trim();
    if (topicToUse.length < 2) {
      setErrorMsg('Please select a lesson or enter a topic to assess.');
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);
    setCompletedAttempt(null);
    setActiveQuestions(null);
    setRecords([]);
    setCurrentIndex(0);
    setDraftAnswer('');
    setCurrentSubmittedRecord(null);
    setReviewIncorrectOnly(false);

    try {
      const lessonSummary = targetLesson
        ? [
            `Overview: ${targetLesson.payload.introduction.overview}`,
            `Objectives: ${targetLesson.payload.learningObjectives.join('; ')}`,
            `Key Concepts: ${targetLesson.payload.fundamentalConcepts
              .map((c) => `${c.title} (${c.keyTakeaway})`)
              .join('; ')}`,
            `Terminology: ${targetLesson.payload.importantTerminology
              .map((t) => t.term)
              .join(', ')}`,
          ].join('\n')
        : undefined;

      const res = await generateAssessmentApi({
        topic: topicToUse,
        level,
        difficulty,
        questionCount,
        questionTypes: selectedTypes,
        language: targetLesson?.payload.language || 'English',
        lessonContextSummary: lessonSummary,
        providerPreference,
      });

      if (!res.questions || res.questions.length === 0) {
        throw new Error('No questions were returned. Please try again.');
      }

      setActiveQuestions(res.questions);
      setActiveMeta(res.meta);
      setActiveTopic(res.topic);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to generate assessment.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitCurrentAnswer = async () => {
    if (!activeQuestions || currentSubmittedRecord || isEvaluating) return;
    const question = activeQuestions[currentIndex];
    const trimmed = draftAnswer.trim();
    if (!trimmed) return;

    setErrorMsg(null);
    let isCorrect = false;
    let scoreRatio = 0;
    let feedback = '';

    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      isCorrect =
        trimmed.toLowerCase() === question.correctAnswer.trim().toLowerCase();
      scoreRatio = isCorrect ? 1 : 0;
      feedback = isCorrect
        ? 'Your selected answer matches the correct concept.'
        : `Correct answer: ${question.correctAnswer}`;
    } else {
      const exactMatch =
        trimmed.toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (exactMatch) {
        isCorrect = true;
        scoreRatio = 1;
        feedback = 'Exact match with the target answer.';
      } else {
        setIsEvaluating(true);
        try {
          const evalRes = await evaluateAnswerApi({
            questionPrompt: question.prompt,
            questionType: question.type,
            expectedAnswer: question.correctAnswer,
            acceptedKeywords: question.acceptedKeywords,
            userAnswer: trimmed,
            topic: activeTopic,
            providerPreference,
          });
          isCorrect = evalRes.isCorrect;
          scoreRatio = evalRes.scoreRatio;
          feedback = evalRes.feedback;
        } catch {
          // Graceful deterministic keyword fallback if evaluation call transiently fails
          const keywords = question.acceptedKeywords?.length
            ? question.acceptedKeywords
            : [question.correctAnswer];
          const hit = keywords.some((kw) =>
            trimmed.toLowerCase().includes(kw.toLowerCase())
          );
          isCorrect = hit;
          scoreRatio = hit ? 1 : 0;
          feedback = hit
            ? 'Accepted key concept.'
            : `Expected concept: ${question.correctAnswer}`;
        } finally {
          setIsEvaluating(false);
        }
      }
    }

    const record: AnsweredQuestionRecord = {
      questionId: question.id,
      type: question.type,
      prompt: question.prompt,
      userAnswer: trimmed,
      correctAnswer: question.correctAnswer,
      isCorrect,
      scoreRatio,
      feedback,
      explanation: question.explanation,
    };

    setCurrentSubmittedRecord(record);
    setRecords((prev) => [...prev, record]);
  };

  const handleNextOrFinish = () => {
    if (!activeQuestions) return;
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setDraftAnswer('');
      setCurrentSubmittedRecord(null);
    } else {
      const correctCount = records.filter((r) => r.isCorrect).length;
      const totalQuestions = activeQuestions.length;
      const totalRatio = records.reduce((acc, r) => acc + r.scoreRatio, 0);
      const scorePercent =
        totalQuestions > 0 ? Math.round((totalRatio / totalQuestions) * 100) : 0;

      const attempt: AssessmentAttempt = {
        id: `assess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topic: activeTopic,
        lessonId: selectedLessonId || undefined,
        level,
        difficulty,
        createdAt: new Date().toISOString(),
        scorePercent,
        correctCount,
        totalQuestions,
        records,
        meta: activeMeta ?? {
          providerId: 'unknown',
          providerLabel: 'SmartEd',
          modelName: 'unknown',
          isDemo: false,
        },
      };
      onSaveAttempt(attempt);
      setCompletedAttempt(attempt);
    }
  };

  const handleRetakeSameQuestions = () => {
    if (!activeQuestions) return;
    setCompletedAttempt(null);
    setRecords([]);
    setCurrentIndex(0);
    setDraftAnswer('');
    setCurrentSubmittedRecord(null);
    setReviewIncorrectOnly(false);
  };

  const handleResetToSetup = () => {
    setActiveQuestions(null);
    setCompletedAttempt(null);
    setRecords([]);
    setCurrentIndex(0);
    setDraftAnswer('');
    setCurrentSubmittedRecord(null);
    setErrorMsg(null);
  };

  // 1. Final Result Screen
  if (completedAttempt) {
    const incorrectRecords = completedAttempt.records.filter((r) => !r.isCorrect);
    const displayRecords = reviewIncorrectOnly
      ? incorrectRecords
      : completedAttempt.records;

    return (
      <div className="mx-auto max-w-[920px] space-y-6 pb-12">
        <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/70 pb-6">
            <div>
              <div className="text-xs font-medium text-cyan-400">
                Assessment Completed · {completedAttempt.difficulty}
                {completedAttempt.meta.isDemo ? ' · Sample Demo' : ''}
              </div>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                {completedAttempt.topic}
              </h1>
            </div>

            <div className="text-left sm:text-right">
              <div className="font-mono text-4xl font-bold tabular-nums text-white">
                {completedAttempt.scorePercent}%
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums">
                {completedAttempt.correctCount} of {completedAttempt.totalQuestions}{' '}
                correct
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRetakeSameQuestions}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retake Assessment</span>
            </button>

            <button
              type="button"
              onClick={handleResetToSetup}
              className="rounded-lg border border-slate-700 hover:border-slate-500 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-slate-200 transition-colors"
            >
              Configure New Assessment
            </button>

            {incorrectRecords.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onAskTutorAboutWeakness(
                    completedAttempt.topic,
                    `I scored ${completedAttempt.scorePercent}% on ${completedAttempt.topic} and missed questions like: "${incorrectRecords[0].prompt}". Can you clarify this concept step by step?`
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-950/50 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-cyan-300 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Review Weak Areas with AI Tutor</span>
              </button>
            )}
          </div>
        </section>

        {/* Detailed Question Review */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Question Review
            </h2>

            <div className="inline-flex rounded-lg border border-slate-800 bg-[#0B1120] p-1">
              <button
                type="button"
                onClick={() => setReviewIncorrectOnly(false)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  !reviewIncorrectOnly
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({completedAttempt.records.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewIncorrectOnly(true)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  reviewIncorrectOnly
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Incorrect Only ({incorrectRecords.length})
              </button>
            </div>
          </div>

          {displayRecords.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-sm text-emerald-300">
              No incorrect answers in this assessment.
            </div>
          ) : (
            <div className="space-y-4">
              {displayRecords.map((rec, idx) => (
                <div
                  key={`${rec.questionId}-${idx}`}
                  className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-base font-semibold text-white">
                      {rec.prompt}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                        rec.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {rec.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-800 bg-[#060913] p-3">
                      <div className="text-slate-400 mb-1">Your Answer</div>
                      <div className="text-slate-100">{rec.userAnswer}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#060913] p-3">
                      <div className="text-slate-400 mb-1">Expected Answer</div>
                      <div className="text-cyan-200">{rec.correctAnswer}</div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed pt-1">
                    <strong className="text-slate-100">Explanation: </strong>
                    {rec.explanation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // 2. Active Question-by-Question Assessment Stage
  if (activeQuestions) {
    const q = activeQuestions[currentIndex];
    const progressPct = Math.round(
      ((currentIndex + (currentSubmittedRecord ? 1 : 0)) /
        activeQuestions.length) *
        100
    );
    const typeLabel =
      QUESTION_TYPE_OPTIONS.find((t) => t.id === q.type)?.label || q.type;

    return (
      <div className="mx-auto max-w-[820px] space-y-6 pb-12">
        {activeMeta?.isDemo && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-2.5 text-xs text-amber-200">
            <Info className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Sample Demonstration Assessment: Questions are offline demonstration items.
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8 space-y-6">
          {/* Header & Progress */}
          <div className="space-y-3 border-b border-slate-800/70 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <span>{activeTopic}</span>
                <span aria-hidden="true"> · </span>
                <span>{difficulty}</span>
                <span aria-hidden="true"> · </span>
                <span>{typeLabel}</span>
              </div>
              <div className="font-mono text-xs tabular-nums text-cyan-300">
                Question {currentIndex + 1} of {activeQuestions.length}
              </div>
            </div>

            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${Math.max(6, progressPct)}%` }}
              />
            </div>
          </div>

          {/* Question Prompt */}
          <h2 className="font-display text-xl font-semibold text-white leading-snug">
            {q.prompt}
          </h2>

          {/* Answer Input Area (Never reveal answers before submission) */}
          {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options ? (
            <div className="space-y-2.5">
              {q.options.map((opt) => {
                const isSelected = draftAnswer === opt;
                const submitted = Boolean(currentSubmittedRecord);
                const isCorrectOption =
                  submitted &&
                  opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

                let style =
                  'border-slate-800 bg-[#060913] text-slate-200 hover:border-slate-600';
                if (submitted) {
                  if (isCorrectOption) {
                    style =
                      'border-emerald-500/60 bg-emerald-950/30 text-emerald-200';
                  } else if (isSelected && !isCorrectOption) {
                    style = 'border-rose-500/60 bg-rose-950/30 text-rose-200';
                  } else {
                    style = 'border-slate-800/60 bg-[#060913]/60 text-slate-400';
                  }
                } else if (isSelected) {
                  style = 'border-sky-500 bg-sky-600/15 text-white';
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={submitted}
                    onClick={() => setDraftAnswer(opt)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 min-h-[48px] text-left text-sm transition-colors ${style}`}
                  >
                    <span>{opt}</span>
                    {submitted && isCorrectOption && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                    {submitted && isSelected && !isCorrectOption && (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : q.type === 'fill_blank' ? (
            <div>
              <label
                htmlFor="fill-blank-answer"
                className="block text-xs font-medium text-slate-400 mb-2"
              >
                Type the missing word or phrase
              </label>
              <input
                id="fill-blank-answer"
                type="text"
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                disabled={Boolean(currentSubmittedRecord)}
                placeholder="Enter your answer..."
                className="w-full h-12 rounded-xl border border-slate-700 bg-[#060913] px-4 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-75"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="short-answer-input"
                className="block text-xs font-medium text-slate-400 mb-2"
              >
                Write a concise 1–3 sentence answer
              </label>
              <textarea
                id="short-answer-input"
                rows={4}
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                disabled={Boolean(currentSubmittedRecord)}
                placeholder="Explain your answer clearly..."
                className="w-full rounded-xl border border-slate-700 bg-[#060913] p-4 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-75"
              />
            </div>
          )}

          {/* Immediate Feedback After Submission */}
          {currentSubmittedRecord && (
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                currentSubmittedRecord.isCorrect
                  ? 'border-emerald-500/45 bg-emerald-950/25'
                  : 'border-rose-500/45 bg-rose-950/25'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {currentSubmittedRecord.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">Correct</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-400" />
                    <span className="text-rose-300">Not Quite</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {currentSubmittedRecord.feedback}
              </p>
              <p className="text-sm text-slate-100 leading-relaxed pt-1">
                <strong className="font-semibold">Explanation: </strong>
                {currentSubmittedRecord.explanation}
              </p>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/70">
            <button
              type="button"
              onClick={handleResetToSetup}
              className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Exit Assessment
            </button>

            {!currentSubmittedRecord ? (
              <button
                type="button"
                disabled={!draftAnswer.trim() || isEvaluating}
                onClick={handleSubmitCurrentAnswer}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 min-h-[42px] text-xs font-semibold text-white transition-colors"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking Answer...</span>
                  </>
                ) : (
                  <span>Submit Answer</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextOrFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 min-h-[42px] text-xs font-semibold text-white transition-colors"
              >
                <span>
                  {currentIndex < activeQuestions.length - 1
                    ? 'Next Question'
                    : 'View Final Results'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Assessment Setup & Past History
  return (
    <div className="mx-auto max-w-[1040px] space-y-8 pb-12">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Interactive Assessment Engine
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Test your understanding one question at a time across multiple question formats
            with instant explanations.
          </p>
        </div>

        <form onSubmit={startAssessment} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="assess-lesson-select"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Select from Saved Lessons (optional)
              </label>
              <select
                id="assess-lesson-select"
                value={selectedLessonId}
                onChange={(e) => handleLessonPick(e.target.value)}
                className="w-full h-11 rounded-lg border border-slate-700 bg-[#060913] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="">Custom topic below</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.payload.topic} ({l.payload.level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="assess-topic-input"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Assessment Topic
              </label>
              <input
                id="assess-topic-input"
                type="text"
                value={customTopic}
                onChange={(e) => {
                  setCustomTopic(e.target.value);
                  if (selectedLessonId) setSelectedLessonId('');
                }}
                placeholder="e.g., Quantum Computing, Calculus Derivatives..."
                required
                className="w-full h-11 rounded-lg border border-slate-700 bg-[#060913] px-3.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Difficulty
              </span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#060913] p-1">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`rounded-md px-4 py-1.5 min-h-[36px] text-xs font-medium transition-colors ${
                      difficulty === diff
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Number of Questions
              </span>
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#060913] p-1">
                {QUESTION_COUNTS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`rounded-md px-3.5 py-1.5 min-h-[36px] font-mono text-xs tabular-nums font-medium transition-colors ${
                      questionCount === cnt
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-2">
              Question Formats (select at least one)
            </span>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPE_OPTIONS.map((opt) => {
                const active = selectedTypes.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleQuestionType(opt.id)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3.5 py-2 min-h-[38px] text-xs font-medium transition-colors ${
                      active
                        ? 'border-sky-500/60 bg-sky-600/15 text-sky-300'
                        : 'border-slate-800 bg-[#060913] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 px-6 py-3 min-h-[44px] text-sm font-semibold text-white transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Assessment...</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="h-4 w-4" />
                <span>Generate &amp; Start Assessment</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Assessment History */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          Assessment History
        </h2>
        {assessments.length === 0 ? (
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-6 text-sm text-slate-400">
            You haven&apos;t completed any assessments yet. Configure one above to test
            your knowledge and track your scores.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#0B1120]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Topic</th>
                  <th className="px-5 py-3 font-medium">Difficulty</th>
                  <th className="px-5 py-3 font-medium text-right">Questions</th>
                  <th className="px-5 py-3 font-medium text-right">Score</th>
                  <th className="px-5 py-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {[...assessments]
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/25">
                      <td className="px-5 py-3.5 font-medium text-white">
                        {item.topic}
                        {item.meta.isDemo && (
                          <span className="ml-2 text-xs text-amber-300">(Demo)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{item.difficulty}</td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-300">
                        {item.correctCount}/{item.totalQuestions}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums font-semibold text-cyan-300">
                        {item.scorePercent}%
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
