import { NextResponse, type NextRequest } from 'next/server';
import { allowedHostsFromEnv, rejectReason } from '@/lib/app/request-guard';

export function middleware(req: NextRequest) {
  // Middleware can't read settings from disk; the browser's language cookie-free default is Turkish.
  const lang = req.headers.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'tr';
  const reason = rejectReason(
    {
      method: req.method,
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      secFetchSite: req.headers.get('sec-fetch-site'),
      allowedHosts: allowedHostsFromEnv(),
      path: req.nextUrl.pathname,
    },
    lang,
  );
  if (reason) return NextResponse.json({ error: reason }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
