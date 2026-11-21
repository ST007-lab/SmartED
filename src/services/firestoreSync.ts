import type { User } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  AssessmentAttempt,
  DailyActivityRecord,
  FeedbackCategory,
  FeedbackRatings,
  FeedbackSubmission,
  KnowledgeLevel,
  LearningStore,
  LessonSectionKey,
  PlatformGrowthSnapshot,
  SavedLesson,
  TutorConversation,
  UserPreferences,
  UserProfileRecord,
} from '../types/learning';
import { db, handleFirestoreError, OperationType } from './firebase';

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

/**
 * Recursively strip `undefined` properties so Firestore never rejects optional fields.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Timestamp)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

export async function ensureUserProfile(
  user: User,
  localSeed?: LearningStore
): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    const data = snap.data({ serverTimestamps: 'estimate' });
    const updatePayload: Record<string, unknown> = {
      displayName: (user.displayName || data.displayName || 'SmartEd Learner').slice(0, 120),
      lastActiveAt: serverTimestamp(),
    };
    if (user.photoURL) {
      updatePayload.photoURL = user.photoURL.slice(0, 500);
    }
    try {
      await updateDoc(ref, updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }

    return {
      uid: user.uid,
      displayName: String(data.displayName || user.displayName || 'SmartEd Learner'),
      email: String(data.email || user.email || ''),
      photoURL: typeof data.photoURL === 'string' ? data.photoURL : user.photoURL || undefined,
      role: data.role === 'admin' ? 'admin' : 'learner',
      defaultLevel: (data.defaultLevel as KnowledgeLevel) || 'Beginner',
      defaultLanguage: String(data.defaultLanguage || 'English'),
      providerPreference: data.providerPreference || 'auto',
      lessonsCount: Number(data.lessonsCount || 0),
      completedLessonsCount: Number(data.completedLessonsCount || 0),
      assessmentsCount: Number(data.assessmentsCount || 0),
      averageScore: Number(data.averageScore || 0),
      createdAt: toIsoString(data.createdAt),
      lastActiveAt: new Date().toISOString(),
    };
  }

  // First time this user signs in: create profile in Firestore
  const defaultPrefs = localSeed?.preferences;
  const newProfileData: Record<string, unknown> = {
    uid: user.uid,
    displayName: (user.displayName || user.email?.split('@')[0] || 'SmartEd Learner').slice(0, 120),
    email: (user.email || 'unknown@smarted.local').slice(0, 200),
    role: 'learner',
    defaultLevel: defaultPrefs?.defaultLevel || 'Beginner',
    defaultLanguage: (defaultPrefs?.defaultLanguage || 'English').slice(0, 60),
    providerPreference: defaultPrefs?.providerPreference || 'auto',
    lessonsCount: 0,
    completedLessonsCount: 0,
    assessmentsCount: 0,
    averageScore: 0,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  };

  if (user.photoURL) {
    newProfileData.photoURL = user.photoURL.slice(0, 500);
  }

  try {
    await setDoc(ref, newProfileData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  // If the user had offline lessons/assessments in browser storage before signing in, migrate them once
  if (
    localSeed &&
    (localSeed.lessons.length > 0 ||
      localSeed.assessments.length > 0 ||
      localSeed.conversations.length > 0)
  ) {
    await migrateLocalDataToCloud(user.uid, localSeed);
  }

  return {
    uid: user.uid,
    displayName: String(newProfileData.displayName),
    email: String(newProfileData.email),
    photoURL: typeof newProfileData.photoURL === 'string' ? newProfileData.photoURL : undefined,
    role: 'learner',
    defaultLevel: newProfileData.defaultLevel as KnowledgeLevel,
    defaultLanguage: String(newProfileData.defaultLanguage),
    providerPreference: newProfileData.providerPreference as UserPreferences['providerPreference'],
    lessonsCount: localSeed?.lessons.length ?? 0,
    completedLessonsCount:
      localSeed?.lessons.filter((l) => l.isCompleted).length ?? 0,
    assessmentsCount: localSeed?.assessments.length ?? 0,
    averageScore:
      localSeed && localSeed.assessments.length > 0
        ? Math.round(
            localSeed.assessments.reduce((s, a) => s + a.scorePercent, 0) /
              localSeed.assessments.length
          )
        : 0,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

async function migrateLocalDataToCloud(uid: string, localSeed: LearningStore): Promise<void> {
  try {
    for (const lesson of localSeed.lessons.slice(0, 25)) {
      await saveLessonToFirestore(uid, lesson);
    }
    for (const conv of localSeed.conversations.slice(0, 20)) {
      await saveConversationToFirestore(uid, conv);
    }
    for (const attempt of localSeed.assessments.slice(0, 25)) {
      await createAssessmentDocOnly(uid, attempt);
    }
    await syncUserAggregateCounters(
      uid,
      localSeed.lessons,
      localSeed.assessments
    );
  } catch {
    // Non-blocking migration best-effort
  }
}

export function subscribeUserLearningData(
  uid: string,
  callbacks: {
    onProfile: (profile: UserProfileRecord) => void;
    onLessons: (lessons: SavedLesson[]) => void;
    onConversations: (conversations: TutorConversation[]) => void;
    onAssessments: (assessments: AssessmentAttempt[]) => void;
    onActivity: (activityByDate: Record<string, DailyActivityRecord>) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubscribers: Array<() => void> = [];

  // 1. User profile
  const userPath = `users/${uid}`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data({ serverTimestamps: 'estimate' });
        callbacks.onProfile({
          uid,
          displayName: String(d.displayName || 'SmartEd Learner'),
          email: String(d.email || ''),
          photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
          role: d.role === 'admin' ? 'admin' : 'learner',
          defaultLevel: (d.defaultLevel as KnowledgeLevel) || 'Beginner',
          defaultLanguage: String(d.defaultLanguage || 'English'),
          providerPreference: d.providerPreference || 'auto',
          lessonsCount: Number(d.lessonsCount || 0),
          completedLessonsCount: Number(d.completedLessonsCount || 0),
          assessmentsCount: Number(d.assessmentsCount || 0),
          averageScore: Number(d.averageScore || 0),
          createdAt: toIsoString(d.createdAt),
          lastActiveAt: toIsoString(d.lastActiveAt),
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  // 2. Lessons
  const lessonsPath = `users/${uid}/lessons`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'lessons'), where('userId', '==', uid)),
      (snap) => {
        const items: SavedLesson[] = snap.docs.map((docSnap) => {
          const d = docSnap.data({ serverTimestamps: 'estimate' });
          return {
            id: docSnap.id,
            payload: d.payload,
            meta: d.meta,
            createdAt: toIsoString(d.createdAt),
            lastStudiedAt: toIsoString(d.lastStudiedAt),
            currentSectionIndex: Number(d.currentSectionIndex || 0),
            completedSectionKeys: Array.isArray(d.completedSectionKeys)
              ? (d.completedSectionKeys as LessonSectionKey[])
              : [],
            isCompleted: Boolean(d.isCompleted),
            completedAt: typeof d.completedAt === 'string' ? d.completedAt : undefined,
            isBookmarked: Boolean(d.isBookmarked),
            knowledgeCheckAnswers:
              d.knowledgeCheckAnswers && typeof d.knowledgeCheckAnswers === 'object'
                ? (d.knowledgeCheckAnswers as Record<string, number>)
                : {},
          };
        });
        items.sort(
          (a, b) =>
            new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
        );
        callbacks.onLessons(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, lessonsPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  // 3. Conversations
  const convPath = `users/${uid}/conversations`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'conversations'), where('userId', '==', uid)),
      (snap) => {
        const items: TutorConversation[] = snap.docs.map((docSnap) => {
          const d = docSnap.data({ serverTimestamps: 'estimate' });
          return {
            id: docSnap.id,
            title: String(d.title || 'Study Session'),
            lessonId: typeof d.lessonId === 'string' ? d.lessonId : undefined,
            topicContext: typeof d.topicContext === 'string' ? d.topicContext : undefined,
            levelContext: d.levelContext as KnowledgeLevel | undefined,
            createdAt: toIsoString(d.createdAt),
            updatedAt: toIsoString(d.updatedAt),
            messages: Array.isArray(d.messages) ? d.messages : [],
          };
        });
        items.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        callbacks.onConversations(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, convPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  // 4. Assessments
  const assessPath = `users/${uid}/assessments`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'assessments'), where('userId', '==', uid)),
      (snap) => {
        const items: AssessmentAttempt[] = snap.docs.map((docSnap) => {
          const d = docSnap.data({ serverTimestamps: 'estimate' });
          return {
            id: docSnap.id,
            topic: String(d.topic || ''),
            lessonId: typeof d.lessonId === 'string' ? d.lessonId : undefined,
            level: (d.level as KnowledgeLevel) || 'Beginner',
            difficulty: d.difficulty || 'Medium',
            createdAt: toIsoString(d.createdAt),
            scorePercent: Number(d.scorePercent || 0),
            correctCount: Number(d.correctCount || 0),
            totalQuestions: Number(d.totalQuestions || 1),
            records: Array.isArray(d.records) ? d.records : [],
            meta: d.meta,
          };
        });
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        callbacks.onAssessments(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, assessPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  // 5. Daily Activity
  const activityPath = `users/${uid}/activity`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'activity'), where('userId', '==', uid)),
      (snap) => {
        const recordMap: Record<string, DailyActivityRecord> = {};
        for (const docSnap of snap.docs) {
          const d = docSnap.data({ serverTimestamps: 'estimate' });
          recordMap[docSnap.id] = {
            date: String(d.date || docSnap.id),
            sectionsCompleted: Number(d.sectionsCompleted || 0),
            lessonsCompleted: Number(d.lessonsCompleted || 0),
            assessmentsCompleted: Number(d.assessmentsCompleted || 0),
            tutorTurns: Number(d.tutorTurns || 0),
          };
        }
        callbacks.onActivity(recordMap);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, activityPath);
        } catch (wrapped) {
          callbacks.onError(wrapped as Error);
        }
      }
    )
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}

export async function saveLessonToFirestore(
  uid: string,
  lesson: SavedLesson
): Promise<void> {
  const path = `users/${uid}/lessons/${lesson.id}`;
  const docData: Record<string, unknown> = {
    id: lesson.id,
    userId: uid,
    topic: lesson.payload.topic.slice(0, 200),
    normalizedTitle: lesson.payload.normalizedTitle.slice(0, 240),
    level: lesson.payload.level,
    language: lesson.payload.language.slice(0, 60),
    payload: stripUndefined(lesson.payload),
    meta: stripUndefined(lesson.meta),
    currentSectionIndex: Math.max(0, Math.min(8, lesson.currentSectionIndex)),
    completedSectionKeys: lesson.completedSectionKeys.slice(0, 9),
    isCompleted: lesson.isCompleted,
    isBookmarked: lesson.isBookmarked,
    knowledgeCheckAnswers: lesson.knowledgeCheckAnswers,
    createdAt: serverTimestamp(),
    lastStudiedAt: serverTimestamp(),
  };
  if (lesson.completedAt) {
    docData.completedAt = lesson.completedAt;
  }

  try {
    await setDoc(doc(db, 'users', uid, 'lessons', lesson.id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateLessonInFirestore(
  uid: string,
  lessonId: string,
  patch: {
    currentSectionIndex?: number;
    completedSectionKeys?: LessonSectionKey[];
    isCompleted?: boolean;
    completedAt?: string | null;
    isBookmarked?: boolean;
    knowledgeCheckAnswers?: Record<string, number>;
  }
): Promise<void> {
  const path = `users/${uid}/lessons/${lessonId}`;
  const updateData: Record<string, unknown> = {
    lastStudiedAt: serverTimestamp(),
  };
  if (typeof patch.currentSectionIndex === 'number') {
    updateData.currentSectionIndex = Math.max(0, Math.min(8, patch.currentSectionIndex));
  }
  if (patch.completedSectionKeys !== undefined) {
    updateData.completedSectionKeys = patch.completedSectionKeys.slice(0, 9);
  }
  if (typeof patch.isCompleted === 'boolean') {
    updateData.isCompleted = patch.isCompleted;
  }
  if (patch.completedAt === null) {
    updateData.completedAt = deleteField();
  } else if (typeof patch.completedAt === 'string') {
    updateData.completedAt = patch.completedAt;
  }
  if (typeof patch.isBookmarked === 'boolean') {
    updateData.isBookmarked = patch.isBookmarked;
  }
  if (patch.knowledgeCheckAnswers !== undefined) {
    updateData.knowledgeCheckAnswers = patch.knowledgeCheckAnswers;
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'lessons', lessonId), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteLessonFromFirestore(
  uid: string,
  lessonId: string
): Promise<void> {
  const path = `users/${uid}/lessons/${lessonId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'lessons', lessonId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveConversationToFirestore(
  uid: string,
  conv: TutorConversation
): Promise<void> {
  const path = `users/${uid}/conversations/${conv.id}`;
  const docData: Record<string, unknown> = {
    id: conv.id,
    userId: uid,
    title: conv.title.slice(0, 160) || 'Study Session',
    messages: stripUndefined(conv.messages.slice(-150)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (conv.lessonId) docData.lessonId = conv.lessonId.slice(0, 128);
  if (conv.topicContext) docData.topicContext = conv.topicContext.slice(0, 200);
  if (conv.levelContext) docData.levelContext = conv.levelContext;

  try {
    await setDoc(doc(db, 'users', uid, 'conversations', conv.id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateConversationInFirestore(
  uid: string,
  convId: string,
  patch: {
    title?: string;
    lessonId?: string | null;
    topicContext?: string | null;
    levelContext?: KnowledgeLevel | null;
    messages?: TutorConversation['messages'];
  }
): Promise<void> {
  const path = `users/${uid}/conversations/${convId}`;
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.title !== undefined) {
    updateData.title = (patch.title || 'Study Session').slice(0, 160);
  }
  if (patch.lessonId === null) {
    updateData.lessonId = deleteField();
  } else if (patch.lessonId !== undefined) {
    updateData.lessonId = patch.lessonId.slice(0, 128);
  }
  if (patch.topicContext === null) {
    updateData.topicContext = deleteField();
  } else if (patch.topicContext !== undefined) {
    updateData.topicContext = patch.topicContext.slice(0, 200);
  }
  if (patch.levelContext === null) {
    updateData.levelContext = deleteField();
  } else if (patch.levelContext !== undefined) {
    updateData.levelContext = patch.levelContext;
  }
  if (patch.messages !== undefined) {
    updateData.messages = stripUndefined(patch.messages.slice(-150));
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'conversations', convId), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteConversationFromFirestore(
  uid: string,
  convId: string
): Promise<void> {
  const path = `users/${uid}/conversations/${convId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'conversations', convId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

async function createAssessmentDocOnly(
  uid: string,
  attempt: AssessmentAttempt
): Promise<void> {
  const path = `users/${uid}/assessments/${attempt.id}`;
  const docData: Record<string, unknown> = {
    id: attempt.id,
    userId: uid,
    topic: attempt.topic.slice(0, 200),
    level: attempt.level,
    difficulty: attempt.difficulty,
    scorePercent: Math.max(0, Math.min(100, Math.round(attempt.scorePercent))),
    correctCount: Math.max(0, Math.min(20, attempt.correctCount)),
    totalQuestions: Math.max(1, Math.min(20, attempt.totalQuestions)),
    records: stripUndefined(attempt.records.slice(0, 20)),
    meta: stripUndefined(attempt.meta),
    createdAt: serverTimestamp(),
  };
  if (attempt.lessonId) {
    docData.lessonId = attempt.lessonId.slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'assessments', attempt.id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function saveAssessmentToFirestore(
  uid: string,
  attempt: AssessmentAttempt
): Promise<void> {
  await createAssessmentDocOnly(uid, attempt);
}

export async function upsertDailyActivityInFirestore(
  uid: string,
  dateKey: string,
  record: DailyActivityRecord,
  isNewDoc: boolean
): Promise<void> {
  const path = `users/${uid}/activity/${dateKey}`;
  const ref = doc(db, 'users', uid, 'activity', dateKey);

  if (isNewDoc) {
    try {
      await setDoc(ref, {
        userId: uid,
        date: dateKey,
        sectionsCompleted: record.sectionsCompleted,
        lessonsCompleted: record.lessonsCompleted,
        assessmentsCompleted: record.assessmentsCompleted,
        tutorTurns: record.tutorTurns,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        sectionsCompleted: record.sectionsCompleted,
        lessonsCompleted: record.lessonsCompleted,
        assessmentsCompleted: record.assessmentsCompleted,
        tutorTurns: record.tutorTurns,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export async function syncUserAggregateCounters(
  uid: string,
  lessons: SavedLesson[],
  assessments: AssessmentAttempt[]
): Promise<void> {
  const path = `users/${uid}`;
  const avgScore =
    assessments.length > 0
      ? Math.round(
          assessments.reduce((sum, a) => sum + a.scorePercent, 0) /
            assessments.length
        )
      : 0;

  try {
    await updateDoc(doc(db, 'users', uid), {
      lessonsCount: lessons.length,
      completedLessonsCount: lessons.filter((l) => l.isCompleted).length,
      assessmentsCount: assessments.length,
      averageScore: avgScore,
      lastActiveAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePreferencesInFirestore(
  uid: string,
  patch: Partial<Pick<UserPreferences, 'defaultLevel' | 'defaultLanguage' | 'providerPreference'>>
): Promise<void> {
  const path = `users/${uid}`;
  const updateData: Record<string, unknown> = {
    lastActiveAt: serverTimestamp(),
  };
  if (patch.defaultLevel) updateData.defaultLevel = patch.defaultLevel;
  if (patch.defaultLanguage) {
    updateData.defaultLanguage = patch.defaultLanguage.slice(0, 60);
  }
  if (patch.providerPreference) {
    updateData.providerPreference = patch.providerPreference;
  }

  try {
    await updateDoc(doc(db, 'users', uid), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function clearAllUserCloudData(uid: string): Promise<void> {
  const subcollections = ['lessons', 'conversations', 'assessments', 'activity'] as const;

  for (const sub of subcollections) {
    const colPath = `users/${uid}/${sub}`;
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, 'users', uid, sub), where('userId', '==', uid))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colPath);
    }

    const batch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      count++;
      if (count >= 400) break;
    }
    if (count > 0) {
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, colPath);
      }
    }
  }

  await syncUserAggregateCounters(uid, [], []);
}

/**
 * Admin-only query fetching real platform-wide user signups, lessons, and assessments.
 */
export async function fetchPlatformGrowthData(): Promise<PlatformGrowthSnapshot> {
  let usersSnap;
  try {
    usersSnap = await getDocs(collection(db, 'users'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const users: UserProfileRecord[] = usersSnap.docs.map((docSnap) => {
    const d = docSnap.data({ serverTimestamps: 'estimate' });
    return {
      uid: docSnap.id,
      displayName: String(d.displayName || 'Learner'),
      email: String(d.email || ''),
      photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
      role: d.role === 'admin' ? 'admin' : 'learner',
      defaultLevel: (d.defaultLevel as KnowledgeLevel) || 'Beginner',
      defaultLanguage: String(d.defaultLanguage || 'English'),
      providerPreference: d.providerPreference || 'auto',
      lessonsCount: Number(d.lessonsCount || 0),
      completedLessonsCount: Number(d.completedLessonsCount || 0),
      assessmentsCount: Number(d.assessmentsCount || 0),
      averageScore: Number(d.averageScore || 0),
      createdAt: toIsoString(d.createdAt),
      lastActiveAt: toIsoString(d.lastActiveAt),
    };
  });

  users.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Fetch all lessons and assessments via collectionGroup (admin-only rule)
  let lessonsSnap;
  try {
    lessonsSnap = await getDocs(collectionGroup(db, 'lessons'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'collectionGroup/lessons');
  }

  let assessmentsSnap;
  try {
    assessmentsSnap = await getDocs(collectionGroup(db, 'assessments'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'collectionGroup/assessments');
  }

  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const activeLast7Days = users.filter(
    (u) => nowMs - new Date(u.lastActiveAt).getTime() <= sevenDaysMs
  ).length;

  // Signups by date (chronological)
  const signupCountByDate = new Map<string, number>();
  for (const u of users) {
    const day = u.createdAt.slice(0, 10);
    signupCountByDate.set(day, (signupCountByDate.get(day) ?? 0) + 1);
  }
  const sortedDates = Array.from(signupCountByDate.keys()).sort();
  let runningTotal = 0;
  const signupsByDate = sortedDates.map((date) => {
    const newUsers = signupCountByDate.get(date) ?? 0;
    runningTotal += newUsers;
    return { date, newUsers, cumulativeUsers: runningTotal };
  });

  // Lessons analytics
  const topicCounts = new Map<string, number>();
  const levelDistribution: Record<KnowledgeLevel, number> = {
    Beginner: 0,
    Intermediate: 0,
    Advanced: 0,
  };
  let completedLessons = 0;

  for (const docSnap of lessonsSnap.docs) {
    const d = docSnap.data();
    const topic = typeof d.topic === 'string' ? d.topic.trim() : '';
    if (topic) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
    const lvl = d.level as KnowledgeLevel;
    if (lvl in levelDistribution) {
      levelDistribution[lvl] += 1;
    }
    if (d.isCompleted === true) {
      completedLessons += 1;
    }
  }

  const topTopics = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Assessments analytics
  let scoreSum = 0;
  for (const docSnap of assessmentsSnap.docs) {
    const d = docSnap.data();
    scoreSum += Number(d.scorePercent || 0);
  }
  const globalAverageScore =
    assessmentsSnap.docs.length > 0
      ? Math.round(scoreSum / assessmentsSnap.docs.length)
      : null;

  return {
    totalUsers: users.length,
    activeLast7Days,
    totalLessons: lessonsSnap.docs.length,
    completedLessons,
    totalAssessments: assessmentsSnap.docs.length,
    globalAverageScore,
    signupsByDate,
    topTopics,
    levelDistribution,
    users,
  };
}

function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function submitFeedbackToFirestore(params: {
  uid: string;
  userDisplayName: string;
  userEmail: string;
  category: FeedbackCategory;
  topicContext?: string;
  ratings: FeedbackRatings;
  comment: string;
}): Promise<FeedbackSubmission> {
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `feedback/${id}`;
  const cleanTopic = params.topicContext?.trim().slice(0, 200);
  const cleanComment = params.comment.trim().slice(0, 2000);
  const ratings: FeedbackRatings = {
    lessonUsefulness: clampRating(params.ratings.lessonUsefulness),
    explanationClarity: clampRating(params.ratings.explanationClarity),
    assessmentQuality: clampRating(params.ratings.assessmentQuality),
    overallExperience: clampRating(params.ratings.overallExperience),
  };

  const docData: Record<string, unknown> = {
    id,
    userId: params.uid,
    userDisplayName: (params.userDisplayName || 'SmartEd Learner').slice(0, 120),
    userEmail: (params.userEmail || 'learner@smarted.local').slice(0, 200),
    category: params.category,
    ratings,
    comment: cleanComment,
    createdAt: serverTimestamp(),
  };
  if (cleanTopic) {
    docData.topicContext = cleanTopic;
  }

  try {
    await setDoc(doc(db, 'feedback', id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return {
    id,
    userId: params.uid,
    userDisplayName: String(docData.userDisplayName),
    userEmail: String(docData.userEmail),
    category: params.category,
    topicContext: cleanTopic || undefined,
    ratings,
    comment: cleanComment,
    createdAt: new Date().toISOString(),
  };
}

function mapFeedbackDocs(docs: Array<{ id: string; data: (opt?: { serverTimestamps: 'estimate' }) => Record<string, unknown> }>): FeedbackSubmission[] {
  const list: FeedbackSubmission[] = docs.map((docSnap) => {
    const d = docSnap.data({ serverTimestamps: 'estimate' });
    const rawRatings = (d.ratings && typeof d.ratings === 'object' ? d.ratings : {}) as Record<
      string,
      unknown
    >;
    return {
      id: docSnap.id,
      userId: String(d.userId || ''),
      userDisplayName: String(d.userDisplayName || 'Learner'),
      userEmail: String(d.userEmail || ''),
      category:
        d.category === 'feature' || d.category === 'issue' ? d.category : 'general',
      topicContext: typeof d.topicContext === 'string' ? d.topicContext : undefined,
      ratings: {
        lessonUsefulness: clampRating(Number(rawRatings.lessonUsefulness || 5)),
        explanationClarity: clampRating(Number(rawRatings.explanationClarity || 5)),
        assessmentQuality: clampRating(Number(rawRatings.assessmentQuality || 5)),
        overallExperience: clampRating(Number(rawRatings.overallExperience || 5)),
      },
      comment: String(d.comment || ''),
      createdAt: toIsoString(d.createdAt),
    };
  });
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export async function fetchUserFeedback(uid: string): Promise<FeedbackSubmission[]> {
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'feedback'), where('userId', '==', uid)));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'feedback');
  }
  return mapFeedbackDocs(snap.docs);
}

export async function fetchAllFeedbackForAdmin(): Promise<FeedbackSubmission[]> {
  let snap;
  try {
    snap = await getDocs(collection(db, 'feedback'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'feedback');
  }
  return mapFeedbackDocs(snap.docs);
}
