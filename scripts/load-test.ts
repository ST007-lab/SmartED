import http from 'node:http';
import express from 'express';
import { DemoAIProvider } from '../server/ai/demoProvider.ts';
import { buildLessonCacheKey, sharedLessonCache } from '../server/ai/lessonCache.ts';
import { createAIRouter } from '../server/routes/ai.ts';

interface BenchmarkRow {
  scenario: string;
  concurrency: number;
  totalRequests: number;
  expectedStatusCount: number;
  unexpectedErrors: number;
  durationMs: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return Number(sorted[idx].toFixed(2));
}

async function runConcurrentBatch(params: {
  scenario: string;
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  expectedStatus: number;
  concurrency: number;
  requestsPerUser: number;
}): Promise<BenchmarkRow> {
  const latencies: number[] = [];
  let expectedStatusCount = 0;
  let unexpectedErrors = 0;

  const startAll = performance.now();

  const workers = Array.from({ length: params.concurrency }, async () => {
    for (let i = 0; i < params.requestsPerUser; i++) {
      const t0 = performance.now();
      try {
        const res = await fetch(params.url, {
          method: params.method,
          headers:
            params.method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : undefined,
          body: params.body,
        });
        await res.arrayBuffer();
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);
        if (res.status === params.expectedStatus) {
          expectedStatusCount += 1;
        } else {
          unexpectedErrors += 1;
        }
      } catch {
        latencies.push(performance.now() - t0);
        unexpectedErrors += 1;
      }
    }
  });

  await Promise.all(workers);
  const durationMs = performance.now() - startAll;
  latencies.sort((a, b) => a - b);

  const totalRequests = params.concurrency * params.requestsPerUser;
  return {
    scenario: params.scenario,
    concurrency: params.concurrency,
    totalRequests,
    expectedStatusCount,
    unexpectedErrors,
    durationMs: Number(durationMs.toFixed(1)),
    rps: Number(((totalRequests / durationMs) * 1000).toFixed(1)),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.length ? Number(latencies[latencies.length - 1].toFixed(2)) : 0,
  };
}

async function main() {
  // Seed shared lesson cache for cached-read benchmark
  const demo = new DemoAIProvider();
  const sampleLesson = await demo.generateLesson({
    topic: 'Quantum Computing',
    level: 'Beginner',
    language: 'English',
  });
  const cacheKey = buildLessonCacheKey({
    topic: 'Quantum Computing',
    level: 'Beginner',
    language: 'English',
    providerScope: 'demo:default',
  });
  sharedLessonCache.set(cacheKey, sampleLesson);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'smarted-backend' });
  });
  // Benchmark endpoint isolating sharedLessonCache LRU read + JSON response path (no AI token spend)
  app.get('/api/bench/cached-lesson', async (_req, res) => {
    const { result, cacheHit } = await sharedLessonCache.getOrGenerate(cacheKey, async () =>
      demo.generateLesson({ topic: 'Quantum Computing', level: 'Beginner', language: 'English' })
    );
    res.setHeader('X-SmartEd-Cache', cacheHit ? 'HIT' : 'MISS');
    res.json(result);
  });
  app.use('/api/ai', createAIRouter());

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Failed to bind benchmark server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const concurrencies = [10, 20, 50, 100];
  const results: BenchmarkRow[] = [];

  try {
    for (const c of concurrencies) {
      results.push(
        await runConcurrentBatch({
          scenario: 'GET /api/health',
          url: `${baseUrl}/api/health`,
          method: 'GET',
          expectedStatus: 200,
          concurrency: c,
          requestsPerUser: 5,
        })
      );
      results.push(
        await runConcurrentBatch({
          scenario: 'GET /api/bench/cached-lesson',
          url: `${baseUrl}/api/bench/cached-lesson`,
          method: 'GET',
          expectedStatus: 200,
          concurrency: c,
          requestsPerUser: 5,
        })
      );
      results.push(
        await runConcurrentBatch({
          scenario: 'POST /api/ai/lesson (unauth 401 guard)',
          url: `${baseUrl}/api/ai/lesson`,
          method: 'POST',
          body: JSON.stringify({ topic: 'Quantum Computing' }),
          expectedStatus: 401,
          concurrency: c,
          requestsPerUser: 5,
        })
      );
    }

    console.log('\nSmartEd Repeatable Load Test Results');
    console.log('| Scenario | Concurrent Users | Total Reqs | Expected Status | Unexpected Errors | Throughput (req/s) | p50 (ms) | p95 (ms) | Max (ms) |');
    console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const r of results) {
      console.log(
        `| ${r.scenario} | ${r.concurrency} | ${r.totalRequests} | ${r.expectedStatusCount}/${r.totalRequests} | ${r.unexpectedErrors} | ${r.rps} | ${r.p50Ms} | ${r.p95Ms} | ${r.maxMs} |`
      );
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

void main();
