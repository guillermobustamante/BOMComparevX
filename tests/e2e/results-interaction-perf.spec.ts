import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const e2eApiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4100';
const fixturePath = (name: string) => resolve(process.cwd(), 'tests', 'fixtures', 'stage4', name);
const outputPath = resolve(process.cwd(), 'test-results', 'live-frontend-profile', 'results-interaction-profile.json');

type ChangeType =
  | 'added'
  | 'removed'
  | 'replaced'
  | 'modified'
  | 'moved'
  | 'quantity_change'
  | 'no_change';

const changeTypeLabels: Record<ChangeType, string> = {
  added: 'Added',
  removed: 'Removed',
  replaced: 'Replaced',
  modified: 'Modified',
  moved: 'Moved',
  quantity_change: 'Quantity changed',
  no_change: 'No change'
};

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

function mean(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

async function createFixtureComparison(request: any) {
  const fixtureA = readFileSync(fixturePath('bill-of-materials.xlsx'));
  const fixtureB = readFileSync(fixturePath('bill-of-materialsv2.xlsx'));

  const intakeResponse = await request.post(`${e2eApiBaseUrl}/api/uploads/intake`, {
    multipart: {
      fileA: {
        name: 'results-perf-a.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: fixtureA
      },
      fileB: {
        name: 'results-perf-b.xlsx',
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

  let finalStatus: any = null;
  for (let i = 0; i < 60; i += 1) {
    const statusResponse = await request.get(`${e2eApiBaseUrl}/api/diff-jobs/${encodeURIComponent(diff.jobId)}`);
    expect(statusResponse.ok()).toBeTruthy();
    finalStatus = await statusResponse.json();
    if (finalStatus.status === 'completed') {
      return {
        comparisonId: diff.jobId,
        sessionId: intake.sessionId,
        leftRevisionId: intake.leftRevisionId,
        rightRevisionId: intake.rightRevisionId,
        status: finalStatus
      };
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }

  throw new Error(`Timed out waiting for diff completion for ${diff.jobId}.`);
}

async function waitForRowsResponse(page: any) {
  return page.waitForResponse(
    (response: any) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/diff-jobs/') &&
      response.url().includes('/rows?'),
    { timeout: 15000 }
  );
}

test('measure Results search, sort, and filter interaction timings', async ({ browser, request, baseURL }) => {
  mkdirSync(resolve(process.cwd(), 'test-results', 'live-frontend-profile'), { recursive: true });

  const email = `results.interaction.${Date.now()}@example.com`;
  await request.post(`${e2eApiBaseUrl}/api/auth/test/login`, {
    data: {
      email,
      displayName: 'Results Perf User',
      tenantId: 'tenant-profile',
      provider: 'google'
    }
  });

  const storageState = await request.storageState();
  const comparison = await createFixtureComparison(request);
  const resultsUrl =
    `${baseURL}/results?comparisonId=${encodeURIComponent(comparison.comparisonId)}` +
    `&sessionId=${encodeURIComponent(comparison.sessionId)}` +
    `&leftRevisionId=${encodeURIComponent(comparison.leftRevisionId)}` +
    `&rightRevisionId=${encodeURIComponent(comparison.rightRevisionId)}`;

  const context = await browser.newContext({
    baseURL,
    storageState,
    viewport: { width: 1440, height: 1200 }
  });
  const page = await context.newPage();
  await page.goto(resultsUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await expect(page.getByTestId('results-grid-table')).toBeVisible({ timeout: 20000 });

  const searchInput = page.getByTestId('results-search-input');
  const sortSelect = page.getByTestId('results-sort-select');
  const changeFilterSelect = page.getByTestId('results-change-filter');
  const summary = page.getByTestId('results-pagination-summary');

  const descriptions = (await page
    .locator('[data-testid^="results-row-"] td:nth-child(4)')
    .evaluateAll((cells) =>
      cells
        .map((cell) => (cell.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 5)
    )) as string[];
  const searchTerms = [...new Set(descriptions)].slice(0, 3);
  expect(searchTerms.length).toBeGreaterThan(0);

  const searchRuns: Array<{ term: string; durationMs: number; resultingSummary: string }> = [];
  for (const term of searchTerms) {
    const rowsResponsePromise = waitForRowsResponse(page);
    const startedAt = performance.now();
    await searchInput.fill(term);
    await rowsResponsePromise;
    await expect(page.locator('[data-testid^="results-row-"] td:nth-child(4)').first()).toContainText(term, {
      timeout: 15000
    });
    searchRuns.push({
      term,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      resultingSummary: await summary.textContent()
    });
  }

  {
    const rowsResponsePromise = waitForRowsResponse(page);
    await searchInput.fill('');
    await rowsResponsePromise;
    await expect(summary).toContainText('Showing', { timeout: 15000 });
  }

  const sortModes: Array<{ value: 'part' | 'change' | 'source'; label: string }> = [
    { value: 'part', label: 'Part Number' },
    { value: 'change', label: 'Change Type' },
    { value: 'source', label: 'Source Order' }
  ];

  const sortRuns: Array<{ value: string; durationMs: number; firstPartNumber: string }> = [];
  for (const mode of sortModes) {
    const rowsResponsePromise = waitForRowsResponse(page);
    const startedAt = performance.now();
    await sortSelect.selectOption(mode.value);
    await rowsResponsePromise;
    await expect(sortSelect).toHaveValue(mode.value, { timeout: 15000 });
    await expect(page.locator('[data-testid^="results-row-"] td:nth-child(2)').first()).toBeVisible({
      timeout: 15000
    });
    sortRuns.push({
      value: mode.value,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      firstPartNumber: ((await page.locator('[data-testid^="results-row-"] td:nth-child(2)').first().textContent()) || '')
        .trim()
    });
  }

  const availableTypes = Object.entries((comparison.status?.counters || {}) as Record<string, number>)
    .filter(([key, count]) => key !== 'total' && count > 0)
    .map(([key]) => key as ChangeType)
    .filter((value) => value !== 'no_change')
    .slice(0, 2);
  if (availableTypes.length === 0) {
    availableTypes.push('no_change');
  }

  const filterSequence: Array<'all' | ChangeType> = [...availableTypes, 'all'];
  const filterRuns: Array<{ value: string; durationMs: number; firstChange: string }> = [];
  for (const value of filterSequence) {
    const rowsResponsePromise = waitForRowsResponse(page);
    const startedAt = performance.now();
    await changeFilterSelect.selectOption(value);
    await rowsResponsePromise;
    await expect(changeFilterSelect).toHaveValue(value, { timeout: 15000 });
    await expect(page.locator('[data-testid^="results-row-"] td:nth-child(1)').first()).toBeVisible({
      timeout: 15000
    });
    const firstChange = ((await page.locator('[data-testid^="results-row-"] td:nth-child(1)').first().textContent()) || '').trim();
    if (value !== 'all') {
      await expect(page.locator('[data-testid^="results-row-"] td:nth-child(1)').first()).toContainText(changeTypeLabels[value], {
        timeout: 15000
      });
    }
    filterRuns.push({
      value,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      firstChange
    });
  }

  await context.close();

  const result = {
    generatedAtUtc: new Date().toISOString(),
    comparisonId: comparison.comparisonId,
    sessionId: comparison.sessionId,
    goalMs: 500,
    searchRuns,
    sortRuns,
    filterRuns,
    summary: {
      search: {
        meanMs: mean(searchRuns.map((run) => run.durationMs)),
        p95Ms: percentile(searchRuns.map((run) => run.durationMs), 95)
      },
      sort: {
        meanMs: mean(sortRuns.map((run) => run.durationMs)),
        p95Ms: percentile(sortRuns.map((run) => run.durationMs), 95)
      },
      filter: {
        meanMs: mean(filterRuns.map((run) => run.durationMs)),
        p95Ms: percentile(filterRuns.map((run) => run.durationMs), 95)
      }
    }
  };

  writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  expect(result.summary.search.p95Ms).not.toBeNull();
  expect(result.summary.sort.p95Ms).not.toBeNull();
  expect(result.summary.filter.p95Ms).not.toBeNull();
});
