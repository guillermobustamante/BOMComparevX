import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';

const apiBase = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const appBase = process.env.FRONTEND_PROFILE_BASE_URL || 'http://localhost:3100';
const outDir = resolve(process.cwd(), 'test-results', 'live-frontend-profile');
const traceDir = resolve(outDir, 'runtime-traces');
const fixtureAPath =
  process.env.PERF_FIXTURE_A || resolve(process.cwd(), 'tests', 'fixtures', 'stage4', 'bill-of-materials.xlsx');
const fixtureBPath =
  process.env.PERF_FIXTURE_B ||
  resolve(process.cwd(), 'tests', 'fixtures', 'stage4', 'bill-of-materialsv2.xlsx');
const maxWaitMs = Number(process.env.PROFILE_MAX_WAIT_MS || 120000);
const pollIntervalMs = Number(process.env.PROFILE_POLL_INTERVAL_MS || 300);

mkdirSync(traceDir, { recursive: true });

function extractCookie(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (values.length) return values.map((value) => value.split(';')[0]).join('; ');
  }
  const header = headers.get('set-cookie');
  if (!header) return '';
  return header.split(',').map((segment) => segment.split(';')[0]).join('; ');
}

function toStorageState(cookieHeader) {
  const pair = cookieHeader.split(';')[0];
  const separator = pair.indexOf('=');
  if (separator < 0) {
    throw new Error('Session cookie is missing a name/value pair.');
  }
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  return {
    cookies: [
      {
        name,
        value,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }
    ],
    origins: []
  };
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map((entry) => [entry.name, entry.value]));
}

async function loginAndGetCookie(email) {
  const response = await fetch(`${apiBase}/api/auth/test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      tenantId: 'tenant-live-profile',
      displayName: 'Live Profile User',
      provider: 'google'
    })
  });
  if (!response.ok) {
    throw new Error(`Test login failed (${response.status}): ${await response.text()}`);
  }
  const cookie = extractCookie(response.headers);
  if (!cookie) {
    throw new Error('Test login did not return a session cookie.');
  }
  return cookie;
}

async function ensureAdmin(cookie, email) {
  const response = await fetch(`${apiBase}/api/admin/test/grant-role`, {
    method: 'POST',
    headers: {
      cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userEmail: email })
  });
  if (!response.ok) {
    throw new Error(`Admin role grant failed (${response.status}): ${await response.text()}`);
  }
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
    headers: {
      cookie,
      'Content-Type': 'application/json'
    },
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

async function waitForCompletedDiff(cookie, jobId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const response = await fetch(`${apiBase}/api/diff-jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { cookie },
      cache: 'no-store'
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Diff status failed (${response.status}): ${JSON.stringify(payload)}`);
    }
    if (payload.status === 'completed') {
      return payload;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, pollIntervalMs));
  }
  throw new Error(`Timed out waiting for diff completion (${jobId}).`);
}

async function createResultsWorkspace(cookie) {
  const fixtureABuffer = readFileSync(fixtureAPath);
  const fixtureBBuffer = readFileSync(fixtureBPath);
  const intakePayload = await uploadPair(cookie, fixtureABuffer, fixtureBBuffer);
  const started = await startDiffJob(cookie, intakePayload);
  await waitForCompletedDiff(cookie, started.jobId);
  const query = new URLSearchParams({
    comparisonId: started.jobId,
    sessionId: intakePayload.sessionId,
    leftRevisionId: intakePayload.leftRevisionId,
    rightRevisionId: intakePayload.rightRevisionId
  });
  return {
    comparisonId: started.jobId,
    sessionId: intakePayload.sessionId,
    leftRevisionId: intakePayload.leftRevisionId,
    rightRevisionId: intakePayload.rightRevisionId,
    path: `/results?${query.toString()}`
  };
}

async function profilePage(context, definition) {
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  const traceEvents = [];
  const tracingDone = new Promise((resolveTracing) => {
    client.on('Tracing.dataCollected', (event) => {
      if (Array.isArray(event.value)) {
        traceEvents.push(...event.value);
      }
    });
    client.on('Tracing.tracingComplete', resolveTracing);
  });

  await client.send('Tracing.start', {
    categories: 'devtools.timeline,loading,blink.user_timing,v8.execute',
    transferMode: 'ReportEvents'
  });

  const startedAt = Date.now();
  const response = await page.goto(definition.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 60000 });
  } catch {
    // Keep the profile even if network never fully settles.
  }
  await page.waitForTimeout(1000);
  const wallClockMs = Date.now() - startedAt;

  const performanceSummary = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = performance
      .getEntriesByType('paint')
      .map((entry) => [entry.name, entry.startTime]);
    return {
      navigation: navigation
        ? {
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadEventMs: navigation.loadEventEnd,
            responseStartMs: navigation.responseStart,
            transferSize: navigation.transferSize,
            encodedBodySize: navigation.encodedBodySize,
            decodedBodySize: navigation.decodedBodySize,
            durationMs: navigation.duration
          }
        : null,
      paints: Object.fromEntries(paints)
    };
  });

  const cdpMetrics = metricMap((await client.send('Performance.getMetrics')).metrics || []);
  await client.send('Tracing.end');
  await tracingDone;

  writeFileSync(
    resolve(traceDir, `${definition.id}-trace.json`),
    JSON.stringify({ traceEvents }, null, 2),
    'utf8'
  );

  const result = {
    id: definition.id,
    title: definition.title,
    url: definition.url,
    finalUrl: page.url(),
    status: response?.status() || null,
    wallClockMs,
    navigation: performanceSummary.navigation,
    paints: performanceSummary.paints,
    cdpMetrics: {
      Timestamp: cdpMetrics.Timestamp || null,
      Documents: cdpMetrics.Documents || null,
      Frames: cdpMetrics.Frames || null,
      Nodes: cdpMetrics.Nodes || null,
      LayoutCount: cdpMetrics.LayoutCount || null,
      RecalcStyleCount: cdpMetrics.RecalcStyleCount || null,
      ScriptDuration: cdpMetrics.ScriptDuration || null,
      LayoutDuration: cdpMetrics.LayoutDuration || null,
      TaskDuration: cdpMetrics.TaskDuration || null,
      JSHeapUsedSize: cdpMetrics.JSHeapUsedSize || null,
      JSHeapTotalSize: cdpMetrics.JSHeapTotalSize || null
    }
  };

  await page.close();
  return result;
}

async function main() {
  const email = `live.profile.${Date.now()}@example.com`;
  const cookie = await loginAndGetCookie(email);
  await ensureAdmin(cookie, email);
  const resultsWorkspace = await createResultsWorkspace(cookie);

  const report = {
    generatedAtUtc: new Date().toISOString(),
    apiBase,
    appBase,
    cookieHeader: cookie,
    pages: []
  };

  const pages = [
    { id: 'upload', title: 'Compare BOM Revisions', url: `${appBase}/upload` },
    { id: 'mappings', title: 'Mapping / Field Review', url: `${appBase}/mappings` },
    { id: 'results', title: 'Results / Change Review', url: `${appBase}${resultsWorkspace.path}` },
    { id: 'history', title: 'Revision History', url: `${appBase}/history` },
    { id: 'notifications', title: 'Notifications / Alerts', url: `${appBase}/notifications` },
    { id: 'admin', title: 'Admin / Governance', url: `${appBase}/admin` }
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: appBase,
    storageState: toStorageState(cookie),
    viewport: { width: 1440, height: 1200 }
  });

  for (const page of pages) {
    report.pages.push(await profilePage(context, page));
  }

  await context.close();
  await browser.close();

  writeFileSync(resolve(outDir, 'runtime-profile-report.json'), JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(
    resolve(outDir, 'lighthouse-extra-headers.json'),
    JSON.stringify({ Cookie: cookie }, null, 2),
    'utf8'
  );
  writeFileSync(
    resolve(outDir, 'profile-targets.json'),
    JSON.stringify(
      {
        pages,
        resultsWorkspace
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Live frontend profile written to: ${resolve(outDir, 'runtime-profile-report.json')}`);
  console.log(JSON.stringify(report.pages, null, 2));
}

main().catch((error) => {
  console.error(`live frontend profile failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
