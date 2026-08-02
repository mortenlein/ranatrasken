// Origin gate for the Cloudflare Access setup (house standard — see
// ~/claude-sessions/cloudflare-access-onboarding.md §4b). Requests that arrive
// through the `homeassistant` tunnel carry Host: <CF_ACCESS_PUBLIC_HOST> and
// must present a valid Access JWT (Google SSO at the edge mints it). Direct
// tailnet/loopback requests (Expo Go's phone-browser flows, curl on ash, the
// container healthcheck) keep the plain-HTTP host and pass untouched — this
// app is deliberately reachable both ways.
//
// No-op when the CF_ACCESS_* env vars are unset (dev checkout).
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const TEAM = process.env.CF_ACCESS_TEAM_DOMAIN;
const AUD = process.env.CF_ACCESS_AUD;
const PUBLIC_HOST = process.env.CF_ACCESS_PUBLIC_HOST;
const cfHost = TEAM ? (TEAM.includes('.') ? TEAM : `${TEAM}.cloudflareaccess.com`) : '';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getJwks = () =>
  (jwks ??= createRemoteJWKSet(new URL(`https://${cfHost}/cdn-cgi/access/certs`)));

export async function proxy(req: NextRequest) {
  if (!TEAM || !AUD || !PUBLIC_HOST) return NextResponse.next();
  if (req.headers.get('host') !== PUBLIC_HOST) return NextResponse.next();

  const token =
    req.headers.get('cf-access-jwt-assertion') || req.cookies.get('CF_Authorization')?.value;
  if (token) {
    try {
      // The CF Allow policy is the single source of *who* (per house gotchas);
      // this check proves the request was approved by our Access app.
      await jwtVerify(token, getJwks(), { issuer: `https://${cfHost}`, audience: AUD });
      return NextResponse.next();
    } catch {
      // fall through to 403
    }
  }
  return new NextResponse('Access denied.', { status: 403 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
