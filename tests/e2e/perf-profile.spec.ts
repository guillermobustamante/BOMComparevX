import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const profileEnabled = process.env.PERF_PROFILE_V1 === 'true';
const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const fixturePath = (name: string) => resolve(process.cwd(), 'tests', 'fixtures', 'stage4', name);
const profileDir = resolve(process.cwd(), 'test-results', 'live-frontend-profile');
const traceDir = resolve(profileDir, 'runtime-traces');
const lighthouseTempDir = resolve(process.env.TEMP || process.cwd(), 'bomcomparevx-lighthouse');

type RuntimePageResult = {
  id: string;
  title: string;
  url: string;
  finalUrl: string;
  status: number | null;
  wallClockMs: number;
  navigation: {
    domContentLoadedMs: number;
    loadEventMs: number;
    responseStartMs: number;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
    durationMs: number;
  } | null;
  paints: Record<string, number>;
  cdpMetrics: Record<string, number | null>;
};

function metricMap(metrics: Array<{ name: string; value: number }>) {
  return Object.fromEntries(metrics.map((entry) => [entry.name, entry.value]));
}

async function createFixtureComparison(request: any) {
  const fixtureA = readFileSync(fixturePath('bill-of-materials.xlsx'));
  const fixtureB = readFileSync(fixturePath('bill-of-materialsv2.xlsx'));

  const intakeResponse = await request.post(`${e2eApiBaseUrl}/api/uploads/intake`, {
    multipart: {
      fileA: {
        name: 'perf-a.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: fixtureA
      },
      fileB: {
        name: 'perf-b.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: fixtureB
      }
    }
  });
  expect(intakeResponse.ok()).toBeTruthy();
  const intake = (await intakeResponse.json()) as {
    sessionId: string;
    leftRevisionId: string;
    rightRevisionId: string;
  };

  const diffResponse = await request.post(`${e2eApiBaseUrl}/api/diff-jobs`, {
    data: {
      sessionId: intake.sessionId,
      leftRevisionId: intake.leftRevisionId,
      rightRevisionId: intake.rightRevisionId
    }
  });
  expect(diffResponse.ok()).toBeTruthy();
  const diff = (await diffResponse.json()) as { jobId: string };

  for (let i = 0; i < 60; i += 1) {
    const statusResponse = await request.get(`${e2eApiBaseUrl}/api/diff-jobs/${encodeURIComponent(diff.jobId)}`);
    expect(statusResponse.ok()).toBeTruthy();
    const status = (await statusResponse.json()) as { status: string };
    if (status.status === 'completed') {
      return {
        comparisonId: diff.jobId,
        sessionId: intake.sessionId,
        leftRevisionId: intake.leftRevisionId,
        rightRevisionId: intake.rightRevisionId
      };
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }

  throw new Error(`Timed out waiting for diff completion for ${diff.jobId}.`);
}

async function profilePage(
  context: any,
  definition: { id: string; title: string; url: string }
): Promise<RuntimePageResult> {
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  const traceEvents: unknown[] = [];
  const tracingDone = new Promise<void>((resolveTracing) => {
    client.on('Tracing.dataCollected', (event: { value?: unknown[] }) => {
      if (Array.isArray(event.value)) {
        traceEvents.push(...event.value);
      }
    });
    client.on('Tracing.tracingComplete', () => resolveTracing());
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
    // Keep the profile even if the page keeps polling.
  }
  await page.waitForTimeout(1000);
  const wallClockMs = Date.now() - startedAt;

  const performanceSummary = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
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

  const cdpMetricValues = metricMap((await client.send('Performance.getMetrics')).metrics || []);
  await client.send('Tracing.end');
  await tracingDone;

  writeFileSync(
    resolve(traceDir, `${definition.id}-trace.json`),
    JSON.stringify({ traceEvents }, null, 2),
    'utf8'
  );

  const result: RuntimePageResult = {
    id: definition.id,
    title: definition.title,
    url: definition.url,
    finalUrl: page.url(),
    status: response?.status() || null,
    wallClockMs,
    navigation: performanceSummary.navigation,
    paints: performanceSummary.paints,
    cdpMetrics: {
      Documents: cdpMetricValues.Documents || null,
      Frames: cdpMetricValues.Frames || null,
      Nodes: cdpMetricValues.Nodes || null,
      LayoutCount: cdpMetricValues.LayoutCount || null,
      RecalcStyleCount: cdpMetricValues.RecalcStyleCount || null,
      ScriptDuration: cdpMetricValues.ScriptDuration || null,
      LayoutDuration: cdpMetricValues.LayoutDuration || null,
      TaskDuration: cdpMetricValues.TaskDuration || null,
      JSHeapUsedSize: cdpMetricValues.JSHeapUsedSize || null,
      JSHeapTotalSize: cdpMetricValues.JSHeapTotalSize || null
    }
  };

  await page.close();
  return result;
}

if (!profileEnabled) {
  test.skip(true, 'PERF_PROFILE_V1 must be true to run live profiling.');
}

test('capture runtime traces and Lighthouse audits for authenticated pages', async ({ browser, request, baseURL }) => {
  mkdirSync(traceDir, { recursive: true });
  mkdirSync(lighthouseTempDir, { recursive: true });

  const email = `perf.profile.${Date.now()}@example.com`;
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Perf Profile User',
      tenantId: 'tenant-profile',
      provider: 'google'
    }
  });
  await request.post(`${e2eApiBaseUrl}/api/admin/test/grant-role`, {
    data: { userEmail: email }
  });

  const storageState = await request.storageState();
  const cookieHeader = storageState.cookies
    .filter((cookie) => cookie.domain.includes('localhost'))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  expect(cookieHeader).not.toBe('');

  const comparison = await createFixtureComparison(request);
  const resultsUrl =
    `${baseURL}/results?comparisonId=${encodeURIComponent(comparison.comparisonId)}` +
    `&sessionId=${encodeURIComponent(comparison.sessionId)}` +
    `&leftRevisionId=${encodeURIComponent(comparison.leftRevisionId)}` +
    `&rightRevisionId=${encodeURIComponent(comparison.rightRevisionId)}`;

  const pages = [
    { id: 'upload', title: 'Compare BOM Revisions', url: `${baseURL}/upload` },
    { id: 'mappings', title: 'Mapping / Field Review', url: `${baseURL}/mappings` },
    {
      id: 'results',
      title: 'Change Review / Results',
      url: resultsUrl,
      lighthouseUrl: `${baseURL}/results?comparisonId=${encodeURIComponent(comparison.comparisonId)}`
    },
    { id: 'history', title: 'Revision History', url: `${baseURL}/history` },
    { id: 'notifications', title: 'Comparison Alerts / Notifications', url: `${baseURL}/notifications` },
    { id: 'admin', title: 'Governance / Admin', url: `${baseURL}/admin` }
  ];

  const context = await browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 1440, height: 1200 }
  });

  const runtimeResults: RuntimePageResult[] = [];
  for (const pageDefinition of pages) {
    runtimeResults.push(await profilePage(context, pageDefinition));
  }
  await context.close();

  const extraHeadersPath = resolve(lighthouseTempDir, 'lighthouse-extra-headers.json');
  writeFileSync(extraHeadersPath, JSON.stringify({ Cookie: cookieHeader }, null, 2), 'utf8');

  const lighthouseResults = [];
  for (const pageDefinition of pages) {
    const outputPath = resolve(lighthouseTempDir, `lighthouse-${pageDefinition.id}.json`);
    const lighthouseArgs = [
      'npx',
      'lighthouse',
        pageDefinition.lighthouseUrl || pageDefinition.url,
      '--only-categories=performance',
      '--preset=desktop',
      '--output',
      'json',
      '--output-path',
      outputPath,
      '--extra-headers',
      extraHeadersPath,
      '--chrome-flags',
      '--headless=new --no-sandbox',
      '--quiet'
    ];
    const execution =
      process.platform === 'win32'
        ? spawnSync(
            process.env.ComSpec || 'cmd.exe',
            [
              '/d',
              '/s',
              '/c',
              lighthouseArgs
                .map((arg) => (/[\s&]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg))
                .join(' ')
            ],
            {
              cwd: process.cwd(),
              encoding: 'utf8'
            }
          )
        : spawnSync('npx', lighthouseArgs.slice(1), {
            cwd: process.cwd(),
            encoding: 'utf8'
          });

    expect(
      execution.status,
      execution.error?.message || execution.stderr || execution.stdout
    ).toBe(0);

    const lighthousePayload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      categories?: { performance?: { score?: number } };
      audits?: Record<string, { numericValue?: number }>;
    };
    writeFileSync(
      resolve(profileDir, `lighthouse-${pageDefinition.id}.json`),
      JSON.stringify(lighthousePayload, null, 2),
      'utf8'
    );

      lighthouseResults.push({
        id: pageDefinition.id,
        title: pageDefinition.title,
        url: pageDefinition.lighthouseUrl || pageDefinition.url,
        performanceScore:
        typeof lighthousePayload.categories?.performance?.score === 'number'
          ? Number((lighthousePayload.categories.performance.score * 100).toFixed(0))
          : null,
      firstContentfulPaintMs: lighthousePayload.audits?.['first-contentful-paint']?.numericValue || null,
      largestContentfulPaintMs: lighthousePayload.audits?.['largest-contentful-paint']?.numericValue || null,
      speedIndexMs: lighthousePayload.audits?.['speed-index']?.numericValue || null,
      totalBlockingTimeMs: lighthousePayload.audits?.['total-blocking-time']?.numericValue || null,
      cumulativeLayoutShift: lighthousePayload.audits?.['cumulative-layout-shift']?.numericValue || null
    });
  }

  const summary = {
    generatedAtUtc: new Date().toISOString(),
    baseURL,
    e2eApiBaseUrl,
    runtimeResults,
    lighthouseResults,
    resultsWorkspace: comparison
  };

  writeFileSync(resolve(profileDir, 'runtime-profile-report.json'), JSON.stringify(summary, null, 2), 'utf8');
  writeFileSync(resolve(profileDir, 'profile-targets.json'), JSON.stringify({ pages, comparison }, null, 2), 'utf8');
});
