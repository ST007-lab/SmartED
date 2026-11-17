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

export interface ProviderMeta {
  providerId: string;
  providerLabel: string;
  modelName: string;
  isDemo: boolean;
  notice?: string;
  cached?: boolean;
}

export interface LessonGenerationResult {
  lesson: GeneratedLessonPayload;
  meta: ProviderMeta;
}

export interface TutorHistoryTurn {
  role: 'user' | 'tutor';
  content: string;
}

export interface TutorLessonContext {
  topic: string;
  level: KnowledgeLevel;
  language?: string;
  activeSectionTitle?: string;
  activeSectionContent?: string;
  learningObjectives?: string[];
}

export interface TutorRequestPayload {
  message: string;
  history: TutorHistoryTurn[];
  mode: TutorMode;
  lessonContext?: TutorLessonContext;
  providerPreference?: ProviderPreference;
}

export interface TutorResponseResult {
  reply: string;
  followUpSuggestions: string[];
  meta: ProviderMeta;
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

export interface AssessmentGenerationRequest {
  topic: string;
  level: KnowledgeLevel;
  difficulty: AssessmentDifficulty;
  questionCount: number;
  questionTypes: QuestionType[];
  language?: string;
  lessonContextSummary?: string;
  providerPreference?: ProviderPreference;
}

export interface AssessmentGenerationResult {
  topic: string;
  difficulty: AssessmentDifficulty;
  questions: GeneratedQuestion[];
  meta: ProviderMeta;
}

export interface AnswerEvaluationRequest {
  questionPrompt: string;
  questionType: QuestionType;
  expectedAnswer: string;
  acceptedKeywords?: string[];
  userAnswer: string;
  topic: string;
  providerPreference?: ProviderPreference;
}

export interface AnswerEvaluationResult {
  isCorrect: boolean;
  scoreRatio: number;
  feedback: string;
  meta: ProviderMeta;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly label: string;
  isAvailable(): boolean;
  generateLesson(params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
    modelOverride?: string;
  }): Promise<LessonGenerationResult>;
  respondAsTutor(params: TutorRequestPayload): Promise<TutorResponseResult>;
  generateAssessment(
    params: AssessmentGenerationRequest
  ): Promise<AssessmentGenerationResult>;
  evaluateShortAnswer(
    params: AnswerEvaluationRequest
  ): Promise<AnswerEvaluationResult>;
}
