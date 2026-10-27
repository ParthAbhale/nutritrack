/** Only same-app relative paths are allowed as post-login redirects (no open redirects). */
export function safeRedirect(target: string | null | undefined, fallback = '/dashboard'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  if (/^\/(login|register|forgot-password|reset-password)/.test(target)) return fallback;
  return target;
}
