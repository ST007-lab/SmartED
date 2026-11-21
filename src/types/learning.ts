export type NavRoute =
  | 'home'
  | 'learn'
  | 'my-learning'
  | 'tutor'
  | 'assessments'
  | 'progress'
  | 'growth'
  | 'settings';

export type KnowledgeLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type ProviderPreference =
  | 'auto'
  | 'gemini-hydrogen'
  | 'gemini-lite'
  | 'open-compatible'
  | 'demo';

export type TutorMode =
  | 'standard'
  | 'simplify'
  | 'analogy'
  | 'step-by-step'
  | 'challenge';

export type AssessmentDifficulty = 'Easy' | 'Medium' | 'Hard';

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'short_answer';

export interface ProviderMeta {
  providerId: string;
  providerLabel: string;
  modelName: string;
  isDemo: boolean;
  notice?: string;
  cached?: boolean;
}

export interface ProviderStatusInfo {
  liveAvailable: boolean;
  defaultProviderId: string;
  providers: Array<{
    id: ProviderPreference;
    label: string;
    available: boolean;
    isDemo: boolean;
    description: string;
  }>;
}

export interface LessonConcept {
  title: string;
  explanation: string;
  keyTakeaway: string;
}

export interface LessonStep {
  stepNumber: number;
  title: string;
  explanation: string;
  formulaOrCue?: string;
}

export interface LessonExample {
  title: string;
  scenario: string;
  walkthrough: string;
  outcome: string;
}

export interface LessonApplication {
  domain: string;
  useCase: string;
  impact: string;
}

export interface TerminologyEntry {
  term: string;
  definition: string;
  contextExample: string;
}

export interface KnowledgeCheckItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GeneratedLessonPayload {
  topic: string;
  normalizedTitle: string;
  level: KnowledgeLevel;
  language: string;
  objective?: string;
  estimatedMinutes: number;
  introduction: {
    hook: string;
    overview: string;
    whyItMatters: string;
  };
  learningObjectives: string[];
  fundamentalConcepts: LessonConcept[];
  stepByStepExplanations: LessonStep[];
  practicalExamples: LessonExample[];
  realWorldApplications: LessonApplication[];
  importantTerminology: TerminologyEntry[];
  summary: {
    recapPoints: string[];
    nextSteps: string[];
  };
  knowledgeCheck: KnowledgeCheckItem[];
  recommendedFollowUps: string[];
}

export type LessonSectionKey =
  | 'introduction'
  | 'objectives'
  | 'concepts'
  | 'steps'
  | 'examples'
  | 'applications'
  | 'terminology'
  | 'summary'
  | 'knowledge-check';

export interface SavedLesson {
  id: string;
  payload: GeneratedLessonPayload;
  meta: ProviderMeta;
  createdAt: string;
  lastStudiedAt: string;
  currentSectionIndex: number;
  completedSectionKeys: LessonSectionKey[];
  isCompleted: boolean;
  completedAt?: string;
  isBookmarked: boolean;
  knowledgeCheckAnswers: Record<string, number>;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  createdAt: string;
  mode?: TutorMode;
  followUpSuggestions?: string[];
  meta?: ProviderMeta;
}

export interface TutorConversation {
  id: string;
  title: string;
  lessonId?: string;
  topicContext?: string;
  levelContext?: KnowledgeLevel;
  createdAt: string;
  updatedAt: string;
  messages: TutorMessage[];
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptedKeywords?: string[];
  explanation: string;
}

export interface AnsweredQuestionRecord {
  questionId: string;
  type: QuestionType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  scoreRatio: number;
  feedback: string;
  explanation: string;
}

export interface AssessmentAttempt {
  id: string;
  topic: string;
  lessonId?: string;
  level: KnowledgeLevel;
  difficulty: AssessmentDifficulty;
  createdAt: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  records: AnsweredQuestionRecord[];
  meta: ProviderMeta;
}

export interface DailyActivityRecord {
  date: string; // YYYY-MM-DD
  sectionsCompleted: number;
  lessonsCompleted: number;
  assessmentsCompleted: number;
  tutorTurns: number;
}

export interface UserPreferences {
  defaultLevel: KnowledgeLevel;
  defaultLanguage: string;
  providerPreference: ProviderPreference;
  sidebarCollapsed: boolean;
}

export interface LearningStore {
  version: number;
  lessons: SavedLesson[];
  activeLessonId: string | null;
  conversations: TutorConversation[];
  activeConversationId: string | null;
  assessments: AssessmentAttempt[];
  activityByDate: Record<string, DailyActivityRecord>;
  preferences: UserPreferences;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'learner' | 'admin';
  defaultLevel: KnowledgeLevel;
  defaultLanguage: string;
  providerPreference: ProviderPreference;
  lessonsCount: number;
  completedLessonsCount: number;
  assessmentsCount: number;
  averageScore: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface PlatformGrowthSnapshot {
  totalUsers: number;
  activeLast7Days: number;
  totalLessons: number;
  completedLessons: number;
  totalAssessments: number;
  globalAverageScore: number | null;
  signupsByDate: Array<{ date: string; newUsers: number; cumulativeUsers: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  levelDistribution: Record<KnowledgeLevel, number>;
  users: UserProfileRecord[];
}

export interface UsageQuotaInfo {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  resetAtIso: string;
  dateUtc: string;
}

export type FeedbackCategory = 'general' | 'feature' | 'issue';

export interface FeedbackRatings {
  lessonUsefulness: number;
  explanationClarity: number;
  assessmentQuality: number;
  overallExperience: number;
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  category: FeedbackCategory;
  topicContext?: string;
  ratings: FeedbackRatings;
  comment: string;
  createdAt: string;
}

