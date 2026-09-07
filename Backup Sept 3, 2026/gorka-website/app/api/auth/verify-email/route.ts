import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🟡 PROXY HIT');
  
  try {
    const body = await request.json();
    console.log('🟡 API_BASE_URL:', process.env.API_BASE_URL);
    console.log('🟡 Body:', body);

    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify(body),
    });

    console.log('🟡 Backend status:', response.status);

const data = await response.json();

const nextResponse = NextResponse.json(data, { status: response.status });

const setCookie = response.headers.get('set-cookie');
if (setCookie) {
  nextResponse.headers.set('Set-Cookie', setCookie);
  console.log('🟢 Cookie forwarded to browser');
}
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