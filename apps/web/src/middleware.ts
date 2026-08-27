import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PARTNER_SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || 'byemidias-partner-secret-change-in-production'
);

const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/api/auth/login', '/api/auth/signup', '/api/auth/logout', '/api/auth/forgot-password', '/api/auth/reset-password', '/manifest.json', '/sw.js', '/offline.html'];

const PUBLIC_API_PREFIXES = ['/api/device/', '/api/keepalive', '/api/auth/'];

function isAdminRoute(pathname: string) {
  if (pathname.startsWith('/api/')) {
    return !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
  }
  // Exclude all partner routes (old and slug-based)
  if (pathname === '/partner' || pathname.startsWith('/partner/')) return false;
  if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) return false;
  return pathname.startsWith('/') && !pathname.startsWith('/_next') && !pathname.startsWith('/icons');
}

function hasValidSession(request: NextRequest): boolean {
  const session = request.cookies.get('session')?.value;
  if (!session) return false;
  try {
    const parsed = JSON.parse(session);
    return !!parsed.email;
  } catch {
    return false;
  }
}

/**
 * Check if path matches /partner/[slug]/... pattern
 */
function parsePartnerSlug(pathname: string): string | null {
  // Match /partner/[slug] or /partner/[slug]/*
  const match = pathname.match(/^\/partner\/([a-z0-9-]+)(?:\/.*)?$/);
  if (match) return match[1];
  return null;
}

async function handlePartnerRoutes(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('partner_session')?.value;
  const slug = parsePartnerSlug(pathname);

  // Slug-based partner routes: /partner/[slug]/*
  if (slug) {
    const isLogin = pathname === `/partner/${slug}/login`;
    const isSignup = pathname === `/partner/${slug}/signup`;
    const isApiAuth = pathname.startsWith(`/api/partner/${slug}/auth/`);

    // Login/signup pages — redirect to dashboard if already logged in
    if (isLogin || isSignup) {
      if (token) {
        try {
          const { payload } = await jwtVerify(token, PARTNER_SECRET);
          // Check if slug matches the token
          if (payload.slug === slug) {
            return NextResponse.redirect(new URL(`/partner/${slug}`, request.url));
          }
        } catch {
          // Invalid token, stay on login
        }
      }
      return NextResponse.next();
    }

    // API auth routes — always allow (login/signup/logout)
    if (isApiAuth) {
      return NextResponse.next();
    }

    // All other partner routes — require valid session with matching slug
    if (!token) {
      return NextResponse.redirect(new URL(`/partner/${slug}/login`, request.url));
    }

    try {
      const { payload } = await jwtVerify(token, PARTNER_SECRET);
      if (payload.slug !== slug) {
        // Wrong slug — redirect to correct login
        return NextResponse.redirect(new URL(`/partner/${slug}/login`, request.url));
      }
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL(`/partner/${slug}/login`, request.url));
      response.cookies.delete('partner_session');
      return response;
    }
  }

  // Legacy partner routes: /partner, /partner/login, /partner/signup
  if (pathname === '/partner/login' || pathname === '/partner/signup') {
    if (token) {
      try {
        await jwtVerify(token, PARTNER_SECRET);
        return NextResponse.redirect(new URL('/partner', request.url));
      } catch {
        // Invalid token, stay on login
      }
    }
    return NextResponse.next();
  }

  if (pathname === '/partner' || pathname.startsWith('/partner/')) {
    if (!token) {
      return NextResponse.redirect(new URL('/partner/login', request.url));
    }

    try {
      await jwtVerify(token, PARTNER_SECRET);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL('/partner/login', request.url));
      response.cookies.delete('partner_session');
      return response;
    }
  }

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CORS for API device routes
  if (pathname.startsWith('/api/device/') || pathname.startsWith('/api/keepalive')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
  }

  // Handle partner routes (both legacy and slug-based)
  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');
  if (isPartnerRoute) {
    return handlePartnerRoutes(request);
  }

  // Public routes — skip auth
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Admin routes — require session cookie
  if (isAdminRoute(pathname)) {
    if (!hasValidSession(request)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
