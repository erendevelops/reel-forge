import { t, type Language } from '@/lib/i18n';

/**
 * The API has no login, because it only ever serves the person at this
 * machine. Two browser tricks are blocked (same logic as marketiyo):
 *
 * - Cross-site requests: any page in the same browser can POST to localhost
 *   and spend the user's Claude plan. Browsers send Origin on those, so it
 *   must match the Host.
 * - DNS rebinding: a domain resolving to 127.0.0.1 passes the origin check,
 *   so only loopback names and IP literals are accepted as the host, plus
 *   anything in REELFORGE_ALLOWED_HOSTS.
 */
export type GuardInput = {
  method: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  allowedHosts?: string[];
  /** Request path, for the one cross-site exception: the sandboxed preview frame (opaque origin) loading its own files. */
  path?: string;
};

const PREVIEW_FILE = /^\/api\/projects\/[a-z0-9-]+\/preview\/[^/]+\/.+/;

function hostnameOf(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.replace(/:\d+$/, '');
}

function isLocalHostname(hostname: string, allowed: string[]): boolean {
  const name = hostname.toLowerCase();
  if (name === 'localhost' || name.endsWith('.localhost')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return true;
  if (name.includes(':')) return true; // IPv6 literal
  return allowed.includes(name);
}

/** Returns a reason when the request must be refused, otherwise null. */
export function rejectReason(
  { method, host, origin, secFetchSite, allowedHosts = [], path }: GuardInput,
  lang: Language,
): string | null {
  const d = t(lang).guard;
  if (!host || !isLocalHostname(hostnameOf(host), allowedHosts)) return d.host;
  const safe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  // a sandboxed preview has no origin, so its page and asset GETs look cross-site; they are static, read-only files
  const previewFile = (method === 'GET' || method === 'HEAD') && !!path && PREVIEW_FILE.test(path);
  if ((secFetchSite === 'cross-site' || secFetchSite === 'same-site') && !previewFile) return d.crossSite;

  if (!safe && origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return d.crossSite;
    }
    if (originHost.toLowerCase() !== host.toLowerCase()) return d.crossSite;
  }
  return null;
}

export function allowedHostsFromEnv(): string[] {
  return (process.env.REELFORGE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}
