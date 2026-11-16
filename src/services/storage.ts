import type {
  AssessmentAttempt,
  DailyActivityRecord,
  GeneratedLessonPayload,
  LearningStore,
  LessonSectionKey,
  ProviderMeta,
  SavedLesson,
  TutorConversation,
  TutorMessage,
  UserPreferences,
} from '../types/learning';

const STORAGE_KEY = 'smarted_st_group_store_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultLevel: 'Beginner',
  defaultLanguage: 'English',
  providerPreference: 'auto',
  sidebarCollapsed: false,
};

export function createEmptyStore(): LearningStore {
  return {
    version: 1,
    lessons: [],
    activeLessonId: null,
    conversations: [],
    activeConversationId: null,
    assessments: [],
    activityByDate: {},
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

export function loadStore(): LearningStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as Partial<LearningStore>;
    return {
      version: 1,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      activeLessonId:
        typeof parsed.activeLessonId === 'string' ? parsed.activeLessonId : null,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      activeConversationId:
        typeof parsed.activeConversationId === 'string'
          ? parsed.activeConversationId
          : null,
      assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
      activityByDate:
        parsed.activityByDate && typeof parsed.activityByDate === 'object'
          ? parsed.activityByDate
          : {},
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return createEmptyStore();
  }
}

export function saveStore(store: LearningStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearStore(): LearningStore {
  const empty = createEmptyStore();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return empty;
}

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function bumpActivity(
  activityByDate: Record<string, DailyActivityRecord>,
  delta: Partial<Omit<DailyActivityRecord, 'date'>>
): Record<string, DailyActivityRecord> {
  const date = getTodayKey();
  const existing: DailyActivityRecord = activityByDate[date] ?? {
    date,
    sectionsCompleted: 0,
    lessonsCompleted: 0,
    assessmentsCompleted: 0,
    tutorTurns: 0,
  };
  return {
    ...activityByDate,
    [date]: {
      date,
      sectionsCompleted: existing.sectionsCompleted + (delta.sectionsCompleted ?? 0),
      lessonsCompleted: existing.lessonsCompleted + (delta.lessonsCompleted ?? 0),
      assessmentsCompleted:
        existing.assessmentsCompleted + (delta.assessmentsCompleted ?? 0),
      tutorTurns: existing.tutorTurns + (delta.tutorTurns ?? 0),
    },
  };
}

export function createSavedLesson(
  payload: GeneratedLessonPayload,
  meta: ProviderMeta
): SavedLesson {
  const now = new Date().toISOString();
  return {
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    meta,
    createdAt: now,
    lastStudiedAt: now,
    currentSectionIndex: 0,
    completedSectionKeys: [],
    isCompleted: false,
    isBookmarked: false,
    knowledgeCheckAnswers: {},
  };
}

export function markSectionVisited(
  lesson: SavedLesson,
  sectionIndex: number,
  sectionKey?: LessonSectionKey
): { lesson: SavedLesson; newlyCompletedSection: boolean } {
  const now = new Date().toISOString();
  let newlyCompletedSection = false;
  const completedKeys = [...lesson.completedSectionKeys];
  if (sectionKey && !completedKeys.includes(sectionKey)) {
    completedKeys.push(sectionKey);
    newlyCompletedSection = true;
  }

  return {
    lesson: {
      ...lesson,
      currentSectionIndex: sectionIndex,
      completedSectionKeys: completedKeys,
      lastStudiedAt: now,
    },
    newlyCompletedSection,
  };
}

export function createTutorConversation(params: {
  title: string;
  lessonId?: string;
  topicContext?: string;
  levelContext?: SavedLesson['payload']['level'];
  initialMessage?: TutorMessage;
}): TutorConversation {
  const now = new Date().toISOString();
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: params.title,
    lessonId: params.lessonId,
    topicContext: params.topicContext,
    levelContext: params.levelContext,
    createdAt: now,
    updatedAt: now,
    messages: params.initialMessage ? [params.initialMessage] : [],
  };
}

export function buildExportData(store: LearningStore): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      product: 'SmartEd by ST Group',
      storageType: 'local-browser-export',
      data: store,
    },
    null,
    2
  );
}

export function getAssessmentWeakTopics(
  assessments: AssessmentAttempt[]
): Array<{ topic: string; accuracy: number; missedCount: number }> {
  const map = new Map<string, { correct: number; total: number }>();
  for (const attempt of assessments) {
    const prev = map.get(attempt.topic) ?? { correct: 0, total: 0 };
    map.set(attempt.topic, {
      correct: prev.correct + attempt.correctCount,
      total: prev.total + attempt.totalQuestions,
    });
  }
  const results: Array<{ topic: string; accuracy: number; missedCount: number }> = [];
  for (const [topic, stats] of map.entries()) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const missedCount = stats.total - stats.correct;
    if (accuracy < 80 || missedCount > 0) {
      results.push({ topic, accuracy, missedCount });
    }
  }
  return results.sort((a, b) => a.accuracy - b.accuracy);
}
