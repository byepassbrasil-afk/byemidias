import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { jwtVerify } from 'jose';

const PARTNER_SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || 'byemidias-partner-secret-change-in-production'
);

async function handlePartnerRoutes(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('partner_session')?.value;

  // Only handle /partner/* routes (not /partners/* which is admin)
  // /partner/login, /partner/media, /partner etc.
  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');

  // Partner login page
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

  // Partner protected routes
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
  // Handle partner routes separately (/partner/* but NOT /partners/*)
  const isPartnerRoute = request.nextUrl.pathname === '/partner' || request.nextUrl.pathname.startsWith('/partner/');
  if (isPartnerRoute) {
    return handlePartnerRoutes(request);
  }

  // Handle admin routes with Supabase auth
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
