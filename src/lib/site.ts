/**
 * URL pública da aplicação, usada nos links de e-mail (confirmação e recuperação de senha).
 * Ordem: NEXT_PUBLIC_SITE_URL (configurável por ambiente) → origem atual do navegador.
 * Nunca assume localhost: em produção na Vercel, a origem é o domínio real.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function authCallbackUrl(next?: string): string {
  const base = `${getSiteUrl()}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

export function isLocalhostUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);
}
