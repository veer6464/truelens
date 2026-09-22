import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe } = await request.json();

    const expectedEmail = process.env.AUTH_EMAIL || 'veeresh@gmail.com';
    const expectedPassword = process.env.AUTH_PASSWORD || '12345678';

    if (
      !email ||
      !password ||
      email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase() ||
      password !== expectedPassword
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days vs 1 day

    const response = NextResponse.json({ success: true });
    response.cookies.set('truelens_auth', 'true', {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
