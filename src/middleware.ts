import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the session cookie
  const session = request.cookies.get('session')?.value
  
  // If there's no session, redirect to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Protected routes
export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
} 