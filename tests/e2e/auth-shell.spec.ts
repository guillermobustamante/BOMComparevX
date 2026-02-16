import { expect, test } from '@playwright/test';

test('upload route redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/upload');
  await expect(page).toHaveURL(/\/login\?returnTo=(%2Fupload|\/upload)$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login page has provider actions', async ({ page }) => {
  await page.goto('/login?returnTo=/history');

  const googleLink = page.getByRole('link', { name: 'Continue with Google' });
  const microsoftLink = page.getByRole('link', { name: 'Continue with Microsoft' });

  await expect(googleLink).toBeVisible();
  await expect(microsoftLink).toBeVisible();

  await expect(googleLink).toHaveAttribute('href', /\/api\/auth\/google\/start\?returnTo=%2Fhistory$/);
  await expect(microsoftLink).toHaveAttribute('href', /\/api\/auth\/microsoft\/start\?returnTo=%2Fhistory$/);
});

test('unsafe returnTo is sanitized to /upload', async ({ page }) => {
  await page.goto('/login?returnTo=https://malicious.example');

  const googleLink = page.getByRole('link', { name: 'Continue with Google' });
  await expect(googleLink).toHaveAttribute('href', /returnTo=%2Fupload$/);
});
