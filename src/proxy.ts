import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.get('truelens_auth')?.value === 'true';

  // Allow static files, api routes, Next.js internal assets, and the background image
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/loginpage.png'
  ) {
    return NextResponse.next();
  }

  // If user is already authenticated and visits /login, redirect to main scanner
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // If not authenticated, redirect to /login
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|loginpage.png).*)'],
};
