import React, { useEffect, useRef, useState } from 'react';
import {
  Info,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  SavedLesson,
  TutorConversation,
  TutorMode,
} from '../types/learning';
import { ProseContent } from './ProseContent';

interface TutorViewProps {
  conversations: TutorConversation[];
  activeConversation: TutorConversation | null;
  lessons: SavedLesson[];
  isReplying: boolean;
  errorMessage: string | null;
  pendingSectionContext?: {
    lessonId: string;
    sectionTitle: string;
    sectionContent: string;
  } | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: (lessonId?: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onAttachLesson: (conversationId: string, lessonId?: string) => void;
  onSendMessage: (params: {
    conversationId: string;
    message: string;
    mode: TutorMode;
    sectionTitle?: string;
    sectionContent?: string;
  }) => void;
  onClearPendingSection: () => void;
}

const TUTOR_MODES: Array<{ id: TutorMode; label: string }> = [
  { id: 'standard', label: 'Clear Explanation' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'analogy', label: 'Analogy' },
  { id: 'step-by-step', label: 'Step-by-Step' },
  { id: 'challenge', label: 'Test My Intuition' },
];

export const TutorView: React.FC<TutorViewProps> = ({
  conversations,
  activeConversation,
  lessons,
  isReplying,
  errorMessage,
  pendingSectionContext,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onAttachLesson,
  onSendMessage,
  onClearPendingSection,
}) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<TutorMode>('standard');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isReplying]);

  const attachedLesson = activeConversation?.lessonId
    ? lessons.find((l) => l.id === activeConversation.lessonId)
    : undefined;

  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleSend = (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isReplying) return;

    let targetConvId = activeConversation?.id;
    if (!targetConvId) {
      return;
    }

    onSendMessage({
      conversationId: targetConvId,
      message: content,
      mode,
      sectionTitle: pendingSectionContext?.sectionTitle,
      sectionContent: pendingSectionContext?.sectionContent,
    });
    if (!textToSend) {
      setInput('');
    }
    if (pendingSectionContext) {
      onClearPendingSection();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const lastTutorMessage = [...(activeConversation?.messages ?? [])]
    .reverse()
    .find((m) => m.role === 'tutor');

  return (
    <div className="mx-auto max-w-[1200px] h-[calc(100vh-8.5rem)] min-h-[540px] grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left History Rail (4 cols) */}
      <aside className="lg:col-span-4 flex flex-col rounded-2xl border border-slate-800/80 bg-[#0B1120] overflow-hidden max-h-[240px] lg:max-h-full">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-3.5">
          <h2 className="font-display text-sm font-semibold text-white">
            Conversations
          </h2>
          <button
            type="button"
            onClick={() => onNewConversation(attachedLesson?.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {sortedConversations.length === 0 ? (
            <div className="p-5 text-xs text-slate-400 leading-relaxed">
              No conversations yet. Start asking questions to build your study history.
            </div>
          ) : (
            sortedConversations.map((conv) => {
              const isSelected = conv.id === activeConversation?.id;
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between gap-2 px-4 py-3 transition-colors ${
                    isSelected
                      ? 'bg-sky-600/12 border-r-2 border-sky-500'
                      : 'hover:bg-slate-800/35'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="truncate text-sm font-medium text-white">
                      {conv.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 truncate">
                      {conv.topicContext ? conv.topicContext : 'General study'} ·{' '}
                      <span className="font-mono tabular-nums">
                        {conv.messages.length} msgs
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteConversation(conv.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-rose-300 hover:bg-slate-800/70 transition-colors shrink-0"
                    aria-label={`Delete conversation ${conv.title}`}
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Workspace (8 cols) */}
      <section className="lg:col-span-8 flex flex-col rounded-2xl border border-slate-800/80 bg-[#0B1120] overflow-hidden min-h-0">
        {/* Context & Mode Toolbar */}
        <div className="border-b border-slate-800/80 px-5 py-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <label
                htmlFor="tutor-lesson-context"
                className="text-xs font-medium text-slate-400 whitespace-nowrap"
              >
                Lesson Context
              </label>
              <select
                id="tutor-lesson-context"
                value={activeConversation?.lessonId ?? ''}
                onChange={(e) => {
                  if (activeConversation) {
                    onAttachLesson(
                      activeConversation.id,
                      e.target.value || undefined
                    );
                  }
                }}
                className="h-9 max-w-[260px] rounded-lg border border-slate-700 bg-[#060913] px-3 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="">General AI Tutor (No lesson)</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.payload.topic} ({l.payload.level})
                  </option>
                ))}
              </select>
            </div>

            {attachedLesson && (
              <span className="text-xs text-cyan-300">
                Grounded in {attachedLesson.payload.level} lesson
              </span>
            )}
          </div>

          {pendingSectionContext && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/35 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-200">
              <span>
                Focused on section: <strong>{pendingSectionContext.sectionTitle}</strong>
              </span>
              <button
                type="button"
                onClick={onClearPendingSection}
                className="text-cyan-300 hover:text-white underline shrink-0"
              >
                Clear
              </button>
            </div>
          )}

          {/* Pedagogical Style Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {TUTOR_MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-md px-2.5 py-1.5 min-h-[32px] text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="mx-auto max-w-lg py-10 text-center space-y-4">
              <h3 className="font-display text-lg font-semibold text-white">
                {attachedLesson
                  ? `Ask anything about ${attachedLesson.payload.topic}`
                  : 'Ask your SmartEd AI Tutor'}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ask for step-by-step problem breakdowns, simpler explanations, analogies,
                or test your own reasoning—your tutor will verify assumptions honestly.
              </p>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {(attachedLesson
                  ? [
                      `Explain the hardest idea in ${attachedLesson.payload.topic} simply`,
                      `Give me a real-world analogy for ${attachedLesson.payload.topic}`,
                      `Test my understanding with a conceptual question`,
                    ]
                  : [
                      'Walk me through Bayes’ theorem step by step',
                      'Why does inflation affect interest rates?',
                      'Explain recursion using a clear analogy',
                    ]
                ).map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleSend(starter)}
                    className="rounded-lg border border-slate-700 bg-[#060913] hover:border-sky-500/50 hover:text-sky-300 px-3.5 py-2 text-xs text-slate-200 transition-colors text-left"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{msg.role === 'user' ? 'You' : 'SmartEd AI Tutor'}</span>
                  {msg.meta?.isDemo && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300">Sample Demo</span>
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3.5 ${
                    msg.role === 'user'
                      ? 'bg-sky-600/20 border border-sky-500/35 text-slate-100 text-[15px] leading-relaxed'
                      : 'bg-[#060913] border border-slate-800/90 text-slate-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ProseContent content={msg.content} />
                  )}
                </div>
              </div>
            ))
          )}

          {isReplying && (
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              <span>Thinking through your question...</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200"
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Contextual Follow-up Prompts */}
          {!isReplying &&
            lastTutorMessage?.followUpSuggestions &&
            lastTutorMessage.followUpSuggestions.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="text-xs font-medium text-slate-400">
                  Suggested Follow-Up Questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastTutorMessage.followUpSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSend(sug)}
                      className="rounded-lg border border-slate-700/80 bg-[#060913] hover:border-cyan-500/50 hover:text-cyan-300 px-3 py-1.5 text-xs text-slate-300 transition-colors text-left"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

          <div ref={scrollEndRef} />
        </div>

        {/* Message Composer */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-slate-800/80 bg-[#080D1A] p-3.5"
        >
          <div className="flex items-end gap-2.5">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                attachedLesson
                  ? `Ask a doubt about ${attachedLesson.payload.topic}...`
                  : 'Ask your AI tutor any question...'
              }
              aria-label="Message AI Tutor"
              disabled={isReplying}
              className="flex-1 resize-none rounded-xl border border-slate-700/80 bg-[#060913] px-4 py-2.5 min-h-[44px] max-h-32 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isReplying || !input.trim()}
              className="inline-flex h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 text-xs font-semibold text-white transition-colors shrink-0"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
