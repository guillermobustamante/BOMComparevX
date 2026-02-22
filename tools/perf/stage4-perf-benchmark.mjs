import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const apiBase = process.env.PERF_API_BASE_URL || 'http://localhost:4100';
const tenantId = process.env.PERF_TENANT_ID || 'tenant-perf';
const emailPrefix = process.env.PERF_EMAIL_PREFIX || 'perf.runner';
const iterations = Number(process.env.PERF_ITERATIONS || 3);
const pollIntervalMs = Number(process.env.PERF_POLL_INTERVAL_MS || 300);
const maxWaitMs = Number(process.env.PERF_MAX_WAIT_MS || 120000);
const fixtureAPath =
  process.env.PERF_FIXTURE_A || resolve(process.cwd(), 'tests', 'fixtures', 'stage4', 'bill-of-materials.xlsx');
const fixtureBPath =
  process.env.PERF_FIXTURE_B ||
  resolve(process.cwd(), 'tests', 'fixtures', 'stage4', 'bill-of-materialsv2.xlsx');

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function mean(values) {
  if (!values.length) return null;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2));
}

function extractCookie(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (values.length) return values.map((value) => value.split(';')[0]).join('; ');
  }
  const header = headers.get('set-cookie');
  if (!header) return '';
  return header.split(',').map((segment) => segment.split(';')[0]).join('; ');
}

async function loginAndGetCookie(email) {
  const response = await fetch(`${apiBase}/api/auth/test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      tenantId,
      displayName: 'Perf Runner',
      provider: 'google'
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Test login failed (${response.status}): ${text}`);
  }
  const cookie = extractCookie(response.headers);
  if (!cookie) {
    throw new Error('Test login did not return a session cookie.');
  }
  return cookie;
}

async function uploadPair(cookie, fixtureABuffer, fixtureBBuffer) {
  const form = new FormData();
  form.append(
    'fileA',
    new Blob([fixtureABuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    'bill-of-materials.xlsx'
  );
  form.append(
    'fileB',
    new Blob([fixtureBBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    'bill-of-materialsv2.xlsx'
  );
  const intake = await fetch(`${apiBase}/api/uploads/intake`, {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': randomUUID() },
    body: form
  });
  const intakePayload = await intake.json();
  if (!intake.ok) {
    throw new Error(`Upload intake failed (${intake.status}): ${JSON.stringify(intakePayload)}`);
  }
  return intakePayload;
}

async function startDiffJob(cookie, intakePayload) {
  const response = await fetch(`${apiBase}/api/diff-jobs`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: intakePayload.sessionId,
      leftRevisionId: intakePayload.leftRevisionId,
      rightRevisionId: intakePayload.rightRevisionId
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Diff start failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function runIteration(index, cookie, fixtureABuffer, fixtureBBuffer) {
  const start = Date.now();
  const intakePayload = await uploadPair(cookie, fixtureABuffer, fixtureBBuffer);
  const started = await startDiffJob(cookie, intakePayload);

  const firstProgressMs = Date.now() - start;
  let firstChunkMs = null;
  let statusPayload = started;
  let loadedRows = started.loadedRows || 0;
  let statusCalls = 0;
  const rowFetchDurations = [];

  while (Date.now() - start < maxWaitMs) {
    statusCalls += 1;
    const statusResponse = await fetch(`${apiBase}/api/diff-jobs/${encodeURIComponent(started.jobId)}`, {
      method: 'GET',
      headers: { cookie },
      cache: 'no-store'
    });
    statusPayload = await statusResponse.json();
    if (!statusResponse.ok) {
      throw new Error(`Status failed (${statusResponse.status}): ${JSON.stringify(statusPayload)}`);
    }

    const beforeRows = Date.now();
    const rowsResponse = await fetch(
      `${apiBase}/api/diff-jobs/${encodeURIComponent(started.jobId)}/rows?cursor=0&limit=200`,
      {
        method: 'GET',
        headers: { cookie },
        cache: 'no-store'
      }
    );
    const rowsPayload = await rowsResponse.json();
    rowFetchDurations.push(Date.now() - beforeRows);
    if (!rowsResponse.ok) {
      throw new Error(`Rows failed (${rowsResponse.status}): ${JSON.stringify(rowsPayload)}`);
    }
    loadedRows = rowsPayload.loadedRows || loadedRows;
    if (firstChunkMs === null && Array.isArray(rowsPayload.rows) && rowsPayload.rows.length > 0) {
      firstChunkMs = Date.now() - start;
    }

    if (statusPayload.status === 'completed') {
      break;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, pollIntervalMs));
  }

  if (statusPayload.status !== 'completed') {
    throw new Error(`Iteration ${index} timed out after ${maxWaitMs}ms.`);
  }

  return {
    iteration: index,
    jobId: started.jobId,
    totalRows: statusPayload.totalRows,
    loadedRows,
    diffDurationMs: Date.now() - start,
    firstProgressMs,
    firstChunkMs,
    statusCalls,
    rowFetchMeanMs: mean(rowFetchDurations)
  };
}

async function main() {
  const fixtureABuffer = readFileSync(fixtureAPath);
  const fixtureBBuffer = readFileSync(fixtureBPath);
  const email = `${emailPrefix}.${Date.now()}@example.com`;
  const cookie = await loginAndGetCookie(email);

  const runs = [];
  for (let i = 1; i <= iterations; i += 1) {
    runs.push(await runIteration(i, cookie, fixtureABuffer, fixtureBBuffer));
  }

  const diffDurations = runs.map((run) => run.diffDurationMs);
  const firstProgressDurations = runs.map((run) => run.firstProgressMs);
  const firstChunkDurations = runs
    .map((run) => run.firstChunkMs)
    .filter((value) => value !== null);

  const report = {
    generatedAtUtc: new Date().toISOString(),
    apiBase,
    fixtureAPath,
    fixtureBPath,
    iterations,
    summary: {
      diffDurationMs: {
        p50: percentile(diffDurations, 50),
        p95: percentile(diffDurations, 95),
        mean: mean(diffDurations)
      },
      firstProgressMs: {
        p50: percentile(firstProgressDurations, 50),
        p95: percentile(firstProgressDurations, 95),
        mean: mean(firstProgressDurations)
      },
      firstChunkMs: {
        p50: percentile(firstChunkDurations, 50),
        p95: percentile(firstChunkDurations, 95),
        mean: mean(firstChunkDurations)
      }
    },
    runs
  };

  mkdirSync(resolve(process.cwd(), 'test-results'), { recursive: true });
  const outputPath = resolve(process.cwd(), 'test-results', 'stage4-perf-report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Stage 4 perf report written to: ${outputPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(`stage4 perf benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
