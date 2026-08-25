import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PARTNER_SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || 'byemidias-partner-secret-change-in-production'
);

const PUBLIC_ROUTES = ['/login', '/signup', '/api/auth/login', '/api/auth/signup', '/api/auth/logout', '/manifest.json', '/sw.js', '/offline.html'];

const PUBLIC_API_PREFIXES = ['/api/device/', '/api/keepalive', '/api/auth/'];

function isAdminRoute(pathname: string) {
  if (pathname.startsWith('/api/')) {
    return !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
  }
  if (pathname.startsWith('/partner/') || pathname === '/partner') return false;
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) return false;
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

async function handlePartnerRoutes(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('partner_session')?.value;

  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');

  if (pathname === '/partner/login') {
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

  if (isPartnerRoute && pathname !== '/partner/login') {
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

  // Handle partner routes
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
