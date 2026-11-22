import { onAuthStateChanged, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AssessmentView } from './components/AssessmentView';
import { FeedbackModal } from './components/FeedbackModal';
import { GrowthView } from './components/GrowthView';
import { HomeView } from './components/HomeView';
import { LandingPage } from './components/LandingPage';
import { LearnView } from './components/LearnView';
import { LegalSupportModal, type LegalTab } from './components/LegalSupportModal';
import { MyLearningView } from './components/MyLearningView';
import { OnboardingModal } from './components/OnboardingModal';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { SrvLogo } from './components/SrvLogo';
import { TopBar } from './components/TopBar';
import { TutorView } from './components/TutorView';
import {
  ApiError,
  fetchProviderStatus,
  fetchUsageQuota,
  generateLessonApi,
  sendTutorMessageApi,
} from './services/api';
import {
  auth,
  isPlatformAdminUser,
  signInWithGoogle,
  signOutUser,
} from './services/firebase';
import {
  clearAllUserCloudData,
  deleteConversationFromFirestore,
  deleteLessonFromFirestore,
  ensureUserProfile,
  saveAssessmentToFirestore,
  saveConversationToFirestore,
  saveLessonToFirestore,
  subscribeUserLearningData,
  syncUserAggregateCounters,
  updateConversationInFirestore,
  updateLessonInFirestore,
  updatePreferencesInFirestore,
  upsertDailyActivityInFirestore,
} from './services/firestoreSync';
import {
  buildExportData,
  bumpActivity,
  clearStore,
  createEmptyStore,
  createSavedLesson,
  createTutorConversation,
  getTodayKey,
  loadStore,
  markSectionVisited,
} from './services/storage';
import type {
  AssessmentAttempt,
  DailyActivityRecord,
  KnowledgeLevel,
  LearningStore,
  LessonSectionKey,
  NavRoute,
  ProviderStatusInfo,
  SavedLesson,
  TutorConversation,
  TutorMessage,
  TutorMode,
  UsageQuotaInfo,
  UserPreferences,
} from './types/learning';

const SIDEBAR_PREF_KEY = 'smarted_sidebar_collapsed';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const [store, setStore] = useState<LearningStore>(() => {
    const base = createEmptyStore();
    try {
      base.preferences.sidebarCollapsed =
        window.localStorage.getItem(SIDEBAR_PREF_KEY) === 'true';
    } catch {
      // Ignore
    }
    return base;
  });

  const storeRef = useRef(store);
  storeRef.current = store;

  const [activeRoute, setActiveRoute] = useState<NavRoute>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusInfo | null>(
    null
  );
  const [usageQuota, setUsageQuota] = useState<UsageQuotaInfo | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTopicDefault, setFeedbackTopicDefault] = useState<string | undefined>(
    undefined
  );
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  // Async workflow states
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [isTutorReplying, setIsTutorReplying] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Cross-module handoff context
  const [pendingTutorSection, setPendingTutorSection] = useState<{
    lessonId: string;
    sectionTitle: string;
    sectionContent: string;
  } | null>(null);
  const [assessmentPrefill, setAssessmentPrefill] = useState<{
    topic?: string;
    lessonId?: string;
    level?: KnowledgeLevel;
  }>({});

  const isAdmin = isPlatformAdminUser(firebaseUser);

  // Dynamically resolve canonical & social URLs for SPA routes
  useEffect(() => {
    const currentUrl = window.location.origin + window.location.pathname;
    const ogImageUrl = `${window.location.origin}/og-smarted.jpg`;

    const canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.href = currentUrl;
    }

    const metaUpdates: Array<[string, string]> = [
      ['meta[property="og:url"]', currentUrl],
      ['meta[property="og:image"]', ogImageUrl],
      ['meta[name="twitter:image"]', ogImageUrl],
    ];

    for (const [selector, value] of metaUpdates) {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) {
        el.content = value;
      }
    }
  }, []);

  // Check server AI provider availability
  useEffect(() => {
    fetchProviderStatus()
      .then(setProviderStatus)
      .catch(() => {
        setProviderStatus({
          liveAvailable: false,
          defaultProviderId: 'demo',
          providers: [
            {
              id: 'demo',
              label: 'Demonstration Mode (Sample Content)',
              available: true,
              isDemo: true,
              description: 'Offline sample curriculum.',
            },
          ],
        });
      });
  }, []);

  // Auth listener + Cloud Firestore subscription
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setCloudLoading(false);
        setUsageQuota(null);
        setStore((prev) => ({
          ...createEmptyStore(),
          preferences: {
            ...createEmptyStore().preferences,
            sidebarCollapsed: prev.preferences.sidebarCollapsed,
          },
        }));
        setActiveRoute('home');
        return;
      }

      void fetchUsageQuota()
        .then(setUsageQuota)
        .catch(() => {
          // Non-blocking usage preview refresh
        });

      try {
        const seenKey = `smarted_onboarding_seen_${user.uid}`;
        if (!window.localStorage.getItem(seenKey)) {
          setOnboardingOpen(true);
          window.localStorage.setItem(seenKey, '1');
        }
      } catch {
        // Ignore storage restrictions
      }

      setCloudLoading(true);
      setCloudError(null);

      try {
        const localSeed = loadStore();
        const hasLocalSeed =
          localSeed.lessons.length > 0 ||
          localSeed.assessments.length > 0 ||
          localSeed.conversations.length > 0;

        const profile = await ensureUserProfile(
          user,
          hasLocalSeed ? localSeed : undefined
        );
        if (hasLocalSeed) {
          clearStore();
        }

        setStore((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            defaultLevel: profile.defaultLevel,
            defaultLanguage: profile.defaultLanguage,
            providerPreference: profile.providerPreference,
          },
        }));

        unsubFirestore = subscribeUserLearningData(user.uid, {
          onProfile: (updatedProfile) => {
            setStore((prev) => ({
              ...prev,
              preferences: {
                ...prev.preferences,
                defaultLevel: updatedProfile.defaultLevel,
                defaultLanguage: updatedProfile.defaultLanguage,
                providerPreference: updatedProfile.providerPreference,
              },
            }));
          },
          onLessons: (lessons) => {
            setStore((prev) => ({
              ...prev,
              lessons,
              activeLessonId:
                prev.activeLessonId &&
                lessons.some((l) => l.id === prev.activeLessonId)
                  ? prev.activeLessonId
                  : lessons[0]?.id ?? null,
            }));
            setCloudLoading(false);
          },
          onConversations: (conversations) => {
            setStore((prev) => ({
              ...prev,
              conversations,
              activeConversationId:
                prev.activeConversationId &&
                conversations.some((c) => c.id === prev.activeConversationId)
                  ? prev.activeConversationId
                  : conversations[0]?.id ?? null,
            }));
          },
          onAssessments: (assessments) => {
            setStore((prev) => ({
              ...prev,
              assessments,
            }));
          },
          onActivity: (activityByDate) => {
            setStore((prev) => ({
              ...prev,
              activityByDate,
            }));
          },
          onError: (err) => {
            setCloudError(err.message);
            setCloudLoading(false);
          },
        });
      } catch (err) {
        setCloudError(
          err instanceof Error
            ? err.message
            : 'Unable to sync with Firestore database.'
        );
        setCloudLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in popup was closed before completing.');
      } else {
        setAuthError(msg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const persistDailyActivityDelta = (
    delta: Partial<Omit<DailyActivityRecord, 'date'>>
  ) => {
    if (!firebaseUser) return;
    const todayKey = getTodayKey();
    const hadDoc = Boolean(storeRef.current.activityByDate[todayKey]);
    const nextMap = bumpActivity(storeRef.current.activityByDate, delta);
    const updatedRecord = nextMap[todayKey];
    setStore((prev) => ({
      ...prev,
      activityByDate: bumpActivity(prev.activityByDate, delta),
    }));
    void upsertDailyActivityInFirestore(
      firebaseUser.uid,
      todayKey,
      updatedRecord,
      !hadDoc
    ).catch((err) => console.error(err));
  };

  const activeLesson = useMemo(
    () => store.lessons.find((l) => l.id === store.activeLessonId) ?? null,
    [store.lessons, store.activeLessonId]
  );

  const activeConversation = useMemo(() => {
    if (store.activeConversationId) {
      const found = store.conversations.find(
        (c) => c.id === store.activeConversationId
      );
      if (found) return found;
    }
    return store.conversations[0] ?? null;
  }, [store.conversations, store.activeConversationId]);

  const ensureConversationForTutor = (lesson?: SavedLesson): string => {
    const newConv = createTutorConversation({
      title: lesson ? `Study: ${lesson.payload.topic}` : 'New Study Session',
      lessonId: lesson?.id,
      topicContext: lesson?.payload.topic,
      levelContext: lesson?.payload.level,
    });
    setStore((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
      activeConversationId: newConv.id,
    }));
    if (firebaseUser) {
      void saveConversationToFirestore(firebaseUser.uid, newConv).catch((err) =>
        console.error(err)
      );
    }
    return newConv.id;
  };

  const handleNavigate = (route: NavRoute) => {
    if (route === 'growth' && !isAdmin) return;
    setActiveRoute(route);
    if (route === 'tutor' && store.conversations.length === 0) {
      ensureConversationForTutor(activeLesson ?? undefined);
    }
  };

  const handleStartLesson = async (params: {
    topic: string;
    level: KnowledgeLevel;
    language: string;
    objective?: string;
  }) => {
    if (!firebaseUser) return;
    setLessonError(null);
    setIsGeneratingLesson(true);
    setActiveRoute('learn');

    try {
      const result = await generateLessonApi({
        ...params,
        providerPreference: store.preferences.providerPreference,
      });

      if (result.usage) {
        setUsageQuota(result.usage);
      } else {
        void fetchUsageQuota().then(setUsageQuota).catch(() => {});
      }

      const created = createSavedLesson(result.lesson, result.meta);
      const { lesson: withFirstSection } = markSectionVisited(
        created,
        0,
        'introduction'
      );

      const nextLessons = [withFirstSection, ...storeRef.current.lessons];
      setStore((prev) => ({
        ...prev,
        lessons: [withFirstSection, ...prev.lessons],
        activeLessonId: withFirstSection.id,
      }));

      await saveLessonToFirestore(firebaseUser.uid, withFirstSection);
      persistDailyActivityDelta({ sectionsCompleted: 1 });
      void syncUserAggregateCounters(
        firebaseUser.uid,
        nextLessons,
        storeRef.current.assessments
      );
    } catch (err) {
      if (err instanceof ApiError && err.usage) {
        setUsageQuota(err.usage);
      }
      setLessonError(
        err instanceof Error ? err.message : 'Unable to generate lesson.'
      );
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const handleOpenLesson = (lessonId: string) => {
    setLessonError(null);
    setStore((prev) => ({
      ...prev,
      activeLessonId: lessonId,
      lessons: prev.lessons.map((l) =>
        l.id === lessonId
          ? { ...l, lastStudiedAt: new Date().toISOString() }
          : l
      ),
    }));
    if (firebaseUser) {
      void updateLessonInFirestore(firebaseUser.uid, lessonId, {}).catch((err) =>
        console.error(err)
      );
    }
    setActiveRoute('learn');
  };

  const handleSelectSection = (
    lessonId: string,
    index: number,
    key: LessonSectionKey
  ) => {
    const target = storeRef.current.lessons.find((l) => l.id === lessonId);
    if (!target) return;
    const { lesson: updated, newlyCompletedSection } = markSectionVisited(
      target,
      index,
      key
    );

    setStore((prev) => ({
      ...prev,
      lessons: prev.lessons.map((l) => (l.id === lessonId ? updated : l)),
    }));

    if (firebaseUser) {
      void updateLessonInFirestore(firebaseUser.uid, lessonId, {
        currentSectionIndex: updated.currentSectionIndex,
        completedSectionKeys: updated.completedSectionKeys,
      }).catch((err) => console.error(err));
    }
    if (newlyCompletedSection) {
      persistDailyActivityDelta({ sectionsCompleted: 1 });
    }
  };

  const handleToggleCompleteLesson = (lessonId: string) => {
    const target = storeRef.current.lessons.find((l) => l.id === lessonId);
    if (!target) return;

    const nextCompleted = !target.isCompleted;
    const completedAtIso = nextCompleted ? new Date().toISOString() : undefined;
    const nextLessons = storeRef.current.lessons.map((l) =>
      l.id === lessonId
        ? {
            ...l,
            isCompleted: nextCompleted,
            completedAt: completedAtIso,
            lastStudiedAt: new Date().toISOString(),
          }
        : l
    );

    setStore((prev) => ({
      ...prev,
      lessons: nextLessons,
    }));

    if (firebaseUser) {
      void updateLessonInFirestore(firebaseUser.uid, lessonId, {
        isCompleted: nextCompleted,
        completedAt: nextCompleted ? completedAtIso : null,
      }).catch((err) => console.error(err));

      void syncUserAggregateCounters(
        firebaseUser.uid,
        nextLessons,
        storeRef.current.assessments
      );
    }

    if (nextCompleted) {
      persistDailyActivityDelta({ lessonsCompleted: 1 });
    }
  };

  const handleToggleBookmark = (lessonId: string) => {
    const target = storeRef.current.lessons.find((l) => l.id === lessonId);
    if (!target) return;
    const nextBookmarked = !target.isBookmarked;

    setStore((prev) => ({
      ...prev,
      lessons: prev.lessons.map((l) =>
        l.id === lessonId ? { ...l, isBookmarked: nextBookmarked } : l
      ),
    }));

    if (firebaseUser) {
      void updateLessonInFirestore(firebaseUser.uid, lessonId, {
        isBookmarked: nextBookmarked,
      }).catch((err) => console.error(err));
    }
  };

  const handleDeleteLesson = (lessonId: string) => {
    const remaining = storeRef.current.lessons.filter((l) => l.id !== lessonId);
    setStore((prev) => ({
      ...prev,
      lessons: remaining,
      activeLessonId:
        prev.activeLessonId === lessonId
          ? remaining[0]?.id ?? null
          : prev.activeLessonId,
    }));

    if (firebaseUser) {
      void deleteLessonFromFirestore(firebaseUser.uid, lessonId).catch((err) =>
        console.error(err)
      );
      void syncUserAggregateCounters(
        firebaseUser.uid,
        remaining,
        storeRef.current.assessments
      );
    }
  };

  const handleAnswerKnowledgeCheck = (
    lessonId: string,
    questionId: string,
    optionIndex: number
  ) => {
    const target = storeRef.current.lessons.find((l) => l.id === lessonId);
    if (!target) return;
    const nextAnswers = {
      ...target.knowledgeCheckAnswers,
      [questionId]: optionIndex,
    };

    setStore((prev) => ({
      ...prev,
      lessons: prev.lessons.map((l) =>
        l.id === lessonId
          ? {
              ...l,
              knowledgeCheckAnswers: nextAnswers,
              lastStudiedAt: new Date().toISOString(),
            }
          : l
      ),
    }));

    if (firebaseUser) {
      void updateLessonInFirestore(firebaseUser.uid, lessonId, {
        knowledgeCheckAnswers: nextAnswers,
      }).catch((err) => console.error(err));
    }
  };

  const handleNewConversation = (lessonId?: string) => {
    setTutorError(null);
    const lesson = lessonId
      ? store.lessons.find((l) => l.id === lessonId)
      : undefined;
    ensureConversationForTutor(lesson);
  };

  const handleSelectConversation = (conversationId: string) => {
    setTutorError(null);
    setStore((prev) => ({
      ...prev,
      activeConversationId: conversationId,
    }));
  };

  const handleDeleteConversation = (conversationId: string) => {
    setStore((prev) => {
      const remaining = prev.conversations.filter((c) => c.id !== conversationId);
      return {
        ...prev,
        conversations: remaining,
        activeConversationId:
          prev.activeConversationId === conversationId
            ? remaining[0]?.id ?? null
            : prev.activeConversationId,
      };
    });

    if (firebaseUser) {
      void deleteConversationFromFirestore(firebaseUser.uid, conversationId).catch(
        (err) => console.error(err)
      );
    }
  };

  const handleAttachLessonToConversation = (
    conversationId: string,
    lessonId?: string
  ) => {
    const lesson = lessonId
      ? store.lessons.find((l) => l.id === lessonId)
      : undefined;
    setStore((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lessonId: lesson?.id,
              topicContext: lesson?.payload.topic,
              levelContext: lesson?.payload.level,
            }
          : c
      ),
    }));

    if (firebaseUser) {
      void updateConversationInFirestore(firebaseUser.uid, conversationId, {
        lessonId: lesson ? lesson.id : null,
        topicContext: lesson ? lesson.payload.topic : null,
        levelContext: lesson ? lesson.payload.level : null,
      }).catch((err) => console.error(err));
    }
  };

  const handleSendTutorMessage = async (params: {
    conversationId: string;
    message: string;
    mode: TutorMode;
    sectionTitle?: string;
    sectionContent?: string;
  }) => {
    const conv = storeRef.current.conversations.find(
      (c) => c.id === params.conversationId
    );
    if (!conv) return;

    setTutorError(null);
    const userMsg: TutorMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: params.message,
      createdAt: new Date().toISOString(),
      mode: params.mode,
    };

    const historyForApi = conv.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const attachedLesson = conv.lessonId
      ? storeRef.current.lessons.find((l) => l.id === conv.lessonId)
      : undefined;

    const updatedTitle =
      conv.messages.length === 0 ? params.message.slice(0, 46) : conv.title;
    const messagesWithUser = [...conv.messages, userMsg];

    setStore((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === params.conversationId
          ? {
              ...c,
              title: updatedTitle,
              updatedAt: new Date().toISOString(),
              messages: messagesWithUser,
            }
          : c
      ),
    }));

    setIsTutorReplying(true);
    try {
      const response = await sendTutorMessageApi({
        message: params.message,
        history: historyForApi,
        mode: params.mode,
        lessonContext: attachedLesson
          ? {
              topic: attachedLesson.payload.topic,
              level: attachedLesson.payload.level,
              language: attachedLesson.payload.language,
              activeSectionTitle: params.sectionTitle,
              activeSectionContent: params.sectionContent,
              learningObjectives: attachedLesson.payload.learningObjectives,
            }
          : conv.topicContext
          ? {
              topic: conv.topicContext,
              level: conv.levelContext ?? store.preferences.defaultLevel,
              activeSectionTitle: params.sectionTitle,
              activeSectionContent: params.sectionContent,
            }
          : undefined,
        providerPreference: store.preferences.providerPreference,
      });

      const tutorMsg: TutorMessage = {
        id: `msg-${Date.now()}-t`,
        role: 'tutor',
        content: response.reply,
        createdAt: new Date().toISOString(),
        mode: params.mode,
        followUpSuggestions: response.followUpSuggestions,
        meta: response.meta,
      };

      const finalMessages = [...messagesWithUser, tutorMsg];

      setStore((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === params.conversationId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: finalMessages,
              }
            : c
        ),
      }));

      if (firebaseUser) {
        void updateConversationInFirestore(
          firebaseUser.uid,
          params.conversationId,
          {
            title: updatedTitle,
            messages: finalMessages,
          }
        ).catch((err) => console.error(err));
      }
      persistDailyActivityDelta({ tutorTurns: 1 });
    } catch (err) {
      setTutorError(
        err instanceof Error ? err.message : 'Unable to reach AI Tutor.'
      );
    } finally {
      setIsTutorReplying(false);
    }
  };

  const handleAskTutorAboutSection = (
    lesson: SavedLesson,
    sectionTitle: string,
    sectionContent: string
  ) => {
    const newConv: TutorConversation = createTutorConversation({
      title: `${lesson.payload.topic} · ${sectionTitle}`,
      lessonId: lesson.id,
      topicContext: lesson.payload.topic,
      levelContext: lesson.payload.level,
    });
    setStore((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
      activeConversationId: newConv.id,
    }));
    if (firebaseUser) {
      void saveConversationToFirestore(firebaseUser.uid, newConv).catch((err) =>
        console.error(err)
      );
    }
    setPendingTutorSection({
      lessonId: lesson.id,
      sectionTitle,
      sectionContent,
    });
    setTutorError(null);
    setActiveRoute('tutor');
  };

  const handleAskTutorForLesson = (lesson: SavedLesson) => {
    ensureConversationForTutor(lesson);
    setPendingTutorSection(null);
    setTutorError(null);
    setActiveRoute('tutor');
  };

  const handleOpenTutorWithPrompt = (topic: string, prompt: string) => {
    const matchedLesson = store.lessons.find(
      (l) => l.payload.topic.toLowerCase() === topic.toLowerCase()
    );
    const conv = createTutorConversation({
      title: `Review: ${topic}`,
      lessonId: matchedLesson?.id,
      topicContext: topic,
      levelContext: matchedLesson?.payload.level ?? store.preferences.defaultLevel,
    });

    setStore((prev) => ({
      ...prev,
      conversations: [conv, ...prev.conversations],
      activeConversationId: conv.id,
    }));
    if (firebaseUser) {
      void saveConversationToFirestore(firebaseUser.uid, conv).catch((err) =>
        console.error(err)
      );
    }
    setActiveRoute('tutor');

    window.setTimeout(() => {
      void sendTutorMessageDirect(conv, prompt, matchedLesson);
    }, 50);
  };

  const sendTutorMessageDirect = async (
    conv: TutorConversation,
    message: string,
    matchedLesson?: SavedLesson
  ) => {
    const userMsg: TutorMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      mode: 'step-by-step',
    };

    const withUser = [userMsg];
    setStore((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conv.id ? { ...c, messages: withUser } : c
      ),
    }));

    setIsTutorReplying(true);
    try {
      const response = await sendTutorMessageApi({
        message,
        history: [],
        mode: 'step-by-step',
        lessonContext: matchedLesson
          ? {
              topic: matchedLesson.payload.topic,
              level: matchedLesson.payload.level,
              language: matchedLesson.payload.language,
              learningObjectives: matchedLesson.payload.learningObjectives,
            }
          : {
              topic: conv.topicContext || 'General',
              level: conv.levelContext || store.preferences.defaultLevel,
            },
        providerPreference: store.preferences.providerPreference,
      });

      const tutorMsg: TutorMessage = {
        id: `msg-${Date.now()}-t`,
        role: 'tutor',
        content: response.reply,
        createdAt: new Date().toISOString(),
        mode: 'step-by-step',
        followUpSuggestions: response.followUpSuggestions,
        meta: response.meta,
      };

      const finalMsgs = [userMsg, tutorMsg];
      setStore((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conv.id
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: finalMsgs,
              }
            : c
        ),
      }));

      if (firebaseUser) {
        void updateConversationInFirestore(firebaseUser.uid, conv.id, {
          messages: finalMsgs,
        }).catch((err) => console.error(err));
      }
      persistDailyActivityDelta({ tutorTurns: 1 });
    } catch (err) {
      setTutorError(
        err instanceof Error ? err.message : 'Unable to reach AI Tutor.'
      );
    } finally {
      setIsTutorReplying(false);
    }
  };

  const handleLaunchAssessmentForLesson = (lesson: SavedLesson) => {
    setAssessmentPrefill({
      topic: lesson.payload.topic,
      lessonId: lesson.id,
      level: lesson.payload.level,
    });
    setActiveRoute('assessments');
  };

  const handleSaveAssessmentAttempt = (attempt: AssessmentAttempt) => {
    const nextAssessments = [attempt, ...storeRef.current.assessments];
    setStore((prev) => ({
      ...prev,
      assessments: nextAssessments,
    }));

    if (firebaseUser) {
      void saveAssessmentToFirestore(firebaseUser.uid, attempt).catch((err) =>
        console.error(err)
      );
      void syncUserAggregateCounters(
        firebaseUser.uid,
        storeRef.current.lessons,
        nextAssessments
      );
    }
    persistDailyActivityDelta({ assessmentsCompleted: 1 });
  };

  const handleUpdatePreferences = (patch: Partial<UserPreferences>) => {
    setStore((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...patch,
      },
    }));

    if (typeof patch.sidebarCollapsed === 'boolean') {
      try {
        window.localStorage.setItem(
          SIDEBAR_PREF_KEY,
          String(patch.sidebarCollapsed)
        );
      } catch {
        // Ignore
      }
    }

    if (
      firebaseUser &&
      (patch.defaultLevel !== undefined ||
        patch.defaultLanguage !== undefined ||
        patch.providerPreference !== undefined)
    ) {
      void updatePreferencesInFirestore(firebaseUser.uid, {
        defaultLevel: patch.defaultLevel,
        defaultLanguage: patch.defaultLanguage,
        providerPreference: patch.providerPreference,
      }).catch((err) => console.error(err));
    }
  };

  const handleExportData = () => {
    const json = buildExportData(store);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `smarted-learning-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    if (firebaseUser) {
      await clearAllUserCloudData(firebaseUser.uid);
    }
    setStore((prev) => ({
      ...createEmptyStore(),
      preferences: prev.preferences,
    }));
    setPendingTutorSection(null);
    setAssessmentPrefill({});
    setLessonError(null);
    setTutorError(null);
  };

  // 1. Initial auth hydration loading gate
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060913] text-slate-300">
        <div className="flex flex-col items-center gap-4 text-sm">
          <SrvLogo size={48} />
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>Loading SmartEd...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Landing Page first
  if (!firebaseUser) {
    return (
      <LandingPage
        onSignIn={handleGoogleSignIn}
        isSigningIn={isSigningIn}
        authError={authError}
      />
    );
  }

  // 3. Authenticated -> Show SmartEd Dashboard Workspace
  return (
    <div className="min-h-screen flex bg-[#060913] text-slate-100">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        collapsed={store.preferences.sidebarCollapsed}
        onToggleCollapse={() =>
          handleUpdatePreferences({
            sidebarCollapsed: !store.preferences.sidebarCollapsed,
          })
        }
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        savedLessonsCount={store.lessons.length}
        isAdmin={isAdmin}
        userDisplayName={firebaseUser.displayName || 'SmartEd Learner'}
        userEmail={firebaseUser.email || ''}
        userPhotoUrl={firebaseUser.photoURL}
        onSignOut={handleSignOut}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onOpenFeedback={() => {
          setFeedbackTopicDefault(activeLesson?.payload.topic);
          setFeedbackOpen(true);
        }}
        onOpenLegal={() => setLegalTab('privacy')}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeRoute={activeRoute}
          activeTopicTitle={activeLesson?.payload.topic}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onStartNewTopic={() => {
            setStore((prev) => ({ ...prev, activeLessonId: null }));
            setLessonError(null);
            setActiveRoute('learn');
          }}
          providerStatus={providerStatus}
          providerPreference={store.preferences.providerPreference}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          {cloudError && (
            <div
              role="alert"
              className="mx-auto max-w-[1200px] mb-6 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs sm:text-sm text-rose-200"
            >
              Database sync error: {cloudError}
            </div>
          )}

          {cloudLoading && store.lessons.length === 0 ? (
            <div className="mx-auto max-w-[1200px] py-16 flex items-center justify-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
              <span>Syncing your learning workspace from Cloud Firestore...</span>
            </div>
          ) : (
            <>
              {activeRoute === 'home' && (
                <HomeView
                  lessons={store.lessons}
                  assessments={store.assessments}
                  preferences={store.preferences}
                  providerStatus={providerStatus}
                  usageQuota={usageQuota}
                  isGenerating={isGeneratingLesson}
                  generationError={lessonError}
                  onStartLesson={handleStartLesson}
                  onOpenLesson={handleOpenLesson}
                  onNavigate={handleNavigate}
                  onOpenOnboarding={() => setOnboardingOpen(true)}
                />
              )}

              {activeRoute === 'learn' && (
                <LearnView
                  activeLesson={activeLesson}
                  allLessons={store.lessons}
                  preferences={store.preferences}
                  usageQuota={usageQuota}
                  isGenerating={isGeneratingLesson}
                  generationError={lessonError}
                  onStartLesson={handleStartLesson}
                  onSelectLesson={handleOpenLesson}
                  onSelectSection={handleSelectSection}
                  onToggleCompleteLesson={handleToggleCompleteLesson}
                  onToggleBookmark={handleToggleBookmark}
                  onAnswerKnowledgeCheck={handleAnswerKnowledgeCheck}
                  onAskTutorAboutSection={handleAskTutorAboutSection}
                  onLaunchAssessmentForLesson={handleLaunchAssessmentForLesson}
                  onOpenFeedback={(topic) => {
                    setFeedbackTopicDefault(topic);
                    setFeedbackOpen(true);
                  }}
                />
              )}

              {activeRoute === 'my-learning' && (
                <MyLearningView
                  lessons={store.lessons}
                  assessments={store.assessments}
                  onOpenLesson={handleOpenLesson}
                  onToggleBookmark={handleToggleBookmark}
                  onDeleteLesson={handleDeleteLesson}
                  onAskTutorForLesson={handleAskTutorForLesson}
                  onAssessLesson={handleLaunchAssessmentForLesson}
                  onNavigate={handleNavigate}
                />
              )}

              {activeRoute === 'tutor' && (
                <TutorView
                  conversations={store.conversations}
                  activeConversation={activeConversation}
                  lessons={store.lessons}
                  isReplying={isTutorReplying}
                  errorMessage={tutorError}
                  pendingSectionContext={pendingTutorSection}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onAttachLesson={handleAttachLessonToConversation}
                  onSendMessage={handleSendTutorMessage}
                  onClearPendingSection={() => setPendingTutorSection(null)}
                />
              )}

              {activeRoute === 'assessments' && (
                <AssessmentView
                  lessons={store.lessons}
                  assessments={store.assessments}
                  initialTopic={assessmentPrefill.topic}
                  initialLessonId={assessmentPrefill.lessonId}
                  initialLevel={
                    assessmentPrefill.level ?? store.preferences.defaultLevel
                  }
                  providerPreference={store.preferences.providerPreference}
                  onSaveAttempt={handleSaveAssessmentAttempt}
                  onAskTutorAboutWeakness={handleOpenTutorWithPrompt}
                />
              )}

              {activeRoute === 'progress' && (
                <ProgressView
                  lessons={store.lessons}
                  assessments={store.assessments}
                  activityByDate={store.activityByDate}
                  onOpenLesson={handleOpenLesson}
                  onPracticeWeakArea={handleOpenTutorWithPrompt}
                  onNavigate={handleNavigate}
                />
              )}

              {activeRoute === 'growth' && isAdmin && <GrowthView />}

              {activeRoute === 'settings' && (
                <SettingsView
                  preferences={store.preferences}
                  providerStatus={providerStatus}
                  usageQuota={usageQuota}
                  onUpdatePreferences={handleUpdatePreferences}
                  onExportData={handleExportData}
                  onClearAllData={() => void handleClearAllData()}
                  onOpenOnboarding={() => setOnboardingOpen(true)}
                  onOpenFeedback={() => {
                    setFeedbackTopicDefault(activeLesson?.payload.topic);
                    setFeedbackOpen(true);
                  }}
                  onOpenLegal={(tab) => setLegalTab(tab)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <OnboardingModal
        open={onboardingOpen}
        dailyLimit={usageQuota?.dailyLimit ?? 5}
        onClose={() => setOnboardingOpen(false)}
        onStartTopic={() => {
          setStore((prev) => ({ ...prev, activeLessonId: null }));
          setActiveRoute('learn');
        }}
      />

      <FeedbackModal
        open={feedbackOpen}
        uid={firebaseUser.uid}
        userDisplayName={firebaseUser.displayName || 'SmartEd Learner'}
        userEmail={firebaseUser.email || ''}
        defaultTopic={feedbackTopicDefault}
        onClose={() => setFeedbackOpen(false)}
      />

      <LegalSupportModal
        open={legalTab !== null}
        initialTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
