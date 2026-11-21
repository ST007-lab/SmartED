import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { DemoAIProvider } from '../server/ai/demoProvider.ts';
import { ProviderRequestError } from '../server/ai/errors.ts';
import { normalizeGeminiError } from '../server/ai/geminiProvider.ts';
import { isSafeProviderBaseUrl } from '../server/ai/openAiCompatibleProvider.ts';
import {
  isProviderCoolingDown,
  markProviderFailure,
  resetProviderHealthForTests,
  selectProviderCandidates,
} from '../server/ai/provider.ts';
import {
  validateAssessmentResult,
  validateEvaluationResult,
  validateLessonPayload,
  validateTutorResponse,
} from '../server/ai/validators.ts';
import {
  AuthVerificationError,
  verifyFirebaseIdToken,
} from '../server/middleware/auth.ts';
import { createAIRouter } from '../server/routes/ai.ts';
import { UsageAndRateLimiter } from '../server/services/usageLimiter.ts';

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function mintTestJwt(params: {
  privateKey: crypto.KeyObject;
  kid: string;
  alg?: string;
  payload: Record<string, unknown>;
}): string {
  const headerSegment = toBase64Url(
    JSON.stringify({ alg: params.alg ?? 'RS256', kid: params.kid, typ: 'JWT' })
  );
  const payloadSegment = toBase64Url(JSON.stringify(params.payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(params.privateKey);
  return `${signingInput}.${toBase64Url(signature)}`;
}

test('verifyFirebaseIdToken validates legitimate RS256 token and admin status', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const now = 1_760_000_000;
  const projectId = 'smarted-test-proj';

  const token = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    payload: {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'user-abc-123',
      email: 'learner@example.com',
      email_verified: true,
      name: 'Test Learner',
      iat: now - 30,
      auth_time: now - 30,
      exp: now + 3600,
    },
  });

  const verified = await verifyFirebaseIdToken(token, {
    projectId,
    nowSeconds: now,
    certsOverride: { 'test-key-1': pubPem },
  });

  assert.equal(verified.uid, 'user-abc-123');
  assert.equal(verified.email, 'learner@example.com');
  assert.equal(verified.emailVerified, true);
  assert.equal(verified.isAdmin, false);

  const adminToken = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    payload: {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'admin-uid-1',
      email: 'sharmifrancis123@gmail.com',
      email_verified: true,
      iat: now - 10,
      auth_time: now - 10,
      exp: now + 3600,
    },
  });

  const adminVerified = await verifyFirebaseIdToken(adminToken, {
    projectId,
    nowSeconds: now,
    certsOverride: { 'test-key-1': pubPem },
  });
  assert.equal(adminVerified.isAdmin, true);
});

test('verifyFirebaseIdToken rejects expired, wrong-audience, tampered, alg-confused, and unverified tokens', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const now = 1_760_000_000;
  const projectId = 'smarted-test-proj';
  const certs = { 'test-key-1': pubPem };

  const basePayload = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: 'user-1',
    email: 'learner@example.com',
    email_verified: true,
    iat: now - 60,
    auth_time: now - 60,
    exp: now + 1000,
  };

  // Expired
  const expired = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    payload: { ...basePayload, exp: now - 5 },
  });
  await assert.rejects(
    verifyFirebaseIdToken(expired, { projectId, nowSeconds: now, certsOverride: certs }),
    (err: unknown) => err instanceof AuthVerificationError && err.code === 'TOKEN_EXPIRED'
  );

  // Wrong audience
  const wrongAud = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    payload: { ...basePayload, aud: 'other-project' },
  });
  await assert.rejects(
    verifyFirebaseIdToken(wrongAud, { projectId, nowSeconds: now, certsOverride: certs }),
    (err: unknown) => err instanceof AuthVerificationError && err.statusCode === 401
  );

  // Algorithm confusion
  const wrongAlg = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    alg: 'HS256',
    payload: basePayload,
  });
  await assert.rejects(
    verifyFirebaseIdToken(wrongAlg, { projectId, nowSeconds: now, certsOverride: certs }),
    (err: unknown) => err instanceof AuthVerificationError && err.statusCode === 401
  );

  // Tampered payload
  const valid = mintTestJwt({ privateKey, kid: 'test-key-1', payload: basePayload });
  const [h, , s] = valid.split('.');
  const forgedPayload = toBase64Url(JSON.stringify({ ...basePayload, sub: 'victim-uid' }));
  await assert.rejects(
    verifyFirebaseIdToken(`${h}.${forgedPayload}.${s}`, {
      projectId,
      nowSeconds: now,
      certsOverride: certs,
    }),
    (err: unknown) => err instanceof AuthVerificationError && err.statusCode === 401
  );

  // Unverified email
  const unverified = mintTestJwt({
    privateKey,
    kid: 'test-key-1',
    payload: { ...basePayload, email_verified: false },
  });
  await assert.rejects(
    verifyFirebaseIdToken(unverified, { projectId, nowSeconds: now, certsOverride: certs }),
    (err: unknown) => err instanceof AuthVerificationError && err.statusCode === 403
  );
});

test('UsageAndRateLimiter enforces 5 lessons/day, deduplicates repeat topics, rolls back failed slots, and enforces rate limits', () => {
  const limiter = new UsageAndRateLimiter({ persistToDisk: false });
  const uid = 'learner-quota-1';

  for (let i = 1; i <= 5; i++) {
    const res = limiter.reserveDailyLessonSlot(uid, `topic-${i}`, 5);
    assert.equal(res.allowed, true);
    assert.equal(res.alreadyCountedToday, false);
    assert.equal(res.snapshot.usedToday, i);
    assert.equal(res.snapshot.remainingToday, 5 - i);
  }

  // Same topic requested again does not double-charge
  const repeat = limiter.reserveDailyLessonSlot(uid, 'topic-3', 5);
  assert.equal(repeat.allowed, true);
  assert.equal(repeat.alreadyCountedToday, true);
  assert.equal(repeat.snapshot.usedToday, 5);

  // 6th distinct topic rejected
  const blocked = limiter.reserveDailyLessonSlot(uid, 'topic-6', 5);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.snapshot.remainingToday, 0);

  // Rolling back a failed slot restores allowance
  limiter.releaseDailyLessonSlot(uid, 'topic-5');
  assert.equal(limiter.getDailyUsage(uid, 5).remainingToday, 1);

  // Sliding-window rate limit
  assert.equal(limiter.checkRateLimit('tutor', uid, 2, 60_000).allowed, true);
  assert.equal(limiter.checkRateLimit('tutor', uid, 2, 60_000).allowed, true);
  const rateBlocked = limiter.checkRateLimit('tutor', uid, 2, 60_000);
  assert.equal(rateBlocked.allowed, false);
  assert.ok(rateBlocked.retryAfterSeconds >= 1);
});

test('isSafeProviderBaseUrl allows safe endpoints and blocks SSRF targets', () => {
  assert.equal(isSafeProviderBaseUrl('https://openrouter.ai/api/v1'), true);
  assert.equal(isSafeProviderBaseUrl('http://localhost:11434/v1'), true);
  assert.equal(isSafeProviderBaseUrl('http://127.0.0.1:8000/v1'), true);

  assert.equal(isSafeProviderBaseUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafeProviderBaseUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafeProviderBaseUrl('http://10.0.0.12:8080/v1'), false);
  assert.equal(isSafeProviderBaseUrl('file:///etc/passwd'), false);
});

test('AI runtime validators accept valid structures and reject malformed payloads', async () => {
  const demo = new DemoAIProvider();
  const sample = await demo.generateLesson({
    topic: 'Quantum Computing',
    level: 'Beginner',
    language: 'English',
  });

  const validated = validateLessonPayload(sample.lesson, {
    topic: 'Quantum Computing',
    level: 'Beginner',
    language: 'English',
  });
  assert.equal(validated.normalizedTitle, 'Foundations of Quantum Computing');
  assert.ok(validated.knowledgeCheck.length >= 1);

  assert.throws(
    () =>
      validateLessonPayload(
        { normalizedTitle: 'Broken' },
        { topic: 'Broken', level: 'Beginner', language: 'English' }
      ),
    (err: unknown) => err instanceof ProviderRequestError && err.code === 'INVALID_AI_STRUCTURE'
  );

  const validTutor = validateTutorResponse(
    { reply: 'Clear answer', followUpSuggestions: ['Q1', 'Q2', 'Q3', 'Q4'] },
    sample.meta
  );
  assert.equal(validTutor.followUpSuggestions.length, 3);

  assert.throws(
    () => validateTutorResponse({ reply: '   ' }, sample.meta),
    (err: unknown) => err instanceof ProviderRequestError
  );

  const validAssessment = validateAssessmentResult(
    {
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Pick one?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: 'Because B.',
        },
        {
          id: 'q2',
          type: 'true_false',
          prompt: 'True or false?',
          correctAnswer: 'false',
          explanation: 'Normalized to False.',
        },
      ],
    },
    {
      topic: 'Physics',
      difficulty: 'Medium',
      allowedTypes: ['multiple_choice', 'true_false'],
      questionCount: 5,
    },
    sample.meta
  );
  assert.equal(validAssessment.questions[1].correctAnswer, 'False');
  assert.deepEqual(validAssessment.questions[1].options, ['True', 'False']);

  const evalRes = validateEvaluationResult(
    { isCorrect: true, scoreRatio: 1.5, feedback: 'Good job!' },
    sample.meta
  );
  assert.equal(evalRes.scoreRatio, 1);
});

test('selectProviderCandidates optimizes per task type, respects health cooldowns, and avoids fake live responses', () => {
  resetProviderHealthForTests();

  const evalOrder = selectProviderCandidates('auto', 'evaluate', {
    gemini: true,
    openCompatible: true,
  });
  assert.equal(evalOrder[0].modelOverride, 'gemini-3.1-flash-lite');

  const lessonOrder = selectProviderCandidates('auto', 'lesson', {
    gemini: true,
    openCompatible: true,
  });
  assert.equal(lessonOrder[0].modelOverride, 'gemini-4-hydrogen');

  markProviderFailure('gemini:gemini-4-hydrogen', 503);
  assert.equal(isProviderCoolingDown('gemini:gemini-4-hydrogen'), true);
  const degradedOrder = selectProviderCandidates('auto', 'lesson', {
    gemini: true,
    openCompatible: true,
  });
  assert.equal(degradedOrder[0].modelOverride, 'gemini-3.1-flash-lite');

  resetProviderHealthForTests();

  assert.throws(
    () =>
      selectProviderCandidates('gemini-hydrogen', 'lesson', {
        gemini: false,
        openCompatible: false,
      }),
    (err: unknown) =>
      err instanceof ProviderRequestError && err.code === 'PROVIDER_UNCONFIGURED'
  );
});

test('normalizeGeminiError sanitizes upstream messages without leaking raw error text or secrets', () => {
  const secretErr = new Error('Upstream failure with key=AIzaSySecretKey12345 internal trace');
  const sanitized = normalizeGeminiError(secretErr);
  assert.equal(sanitized.statusCode, 502);
  assert.equal(sanitized.message.includes('AIzaSySecretKey12345'), false);
});

test('HTTP routes enforce authentication on AI endpoints and allow public status check', async () => {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '512kb' }));
  app.use('/api/ai', createAIRouter());

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const statusRes = await fetch(`${baseUrl}/api/ai/status`);
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.headers.get('x-content-options') ?? statusRes.headers.get('x-content-type-options'), 'nosniff');
    const statusBody = (await statusRes.json()) as {
      dailyFreeLessonLimit: number;
      providers: unknown[];
    };
    assert.ok(statusBody.dailyFreeLessonLimit >= 1);
    assert.ok(Array.isArray(statusBody.providers));

    for (const endpoint of ['/api/ai/lesson', '/api/ai/tutor', '/api/ai/assessment', '/api/ai/evaluate']) {
      const unauthRes = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Quantum Computing' }),
      });
      assert.equal(unauthRes.status, 401, `${endpoint} should require auth`);
    }

    const usageUnauth = await fetch(`${baseUrl}/api/ai/usage`);
    assert.equal(usageUnauth.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
