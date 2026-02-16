const DEFAULT_RETURN_TO_PATH = '/upload';

export function sanitizeReturnToPath(returnTo: string | undefined): string {
  if (!returnTo) return DEFAULT_RETURN_TO_PATH;
  if (!returnTo.startsWith('/')) return DEFAULT_RETURN_TO_PATH;
  if (returnTo.startsWith('//')) return DEFAULT_RETURN_TO_PATH;
  if (returnTo.includes('\\')) return DEFAULT_RETURN_TO_PATH;
  if (returnTo.includes('\r') || returnTo.includes('\n')) return DEFAULT_RETURN_TO_PATH;
  return returnTo;
}

export function buildReturnToUrl(webBaseUrl: string, returnToPath: string | undefined): string {
  const safePath = sanitizeReturnToPath(returnToPath);
  return `${webBaseUrl}${safePath}`;
}
