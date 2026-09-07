import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });

    const setCookies = response.headers.getSetCookie?.() || [];
    setCookies.forEach((cookie) => {
      nextResponse.headers.append('Set-Cookie', cookie);
    });

    return nextResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Proxy error' } },
      { status: 500 }
    );
  }
}