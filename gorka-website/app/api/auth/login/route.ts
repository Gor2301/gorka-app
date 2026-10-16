import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🟣 LOGIN PROXY 1 — REQUEST RECEIVED');

  try {
    const body = await request.json();

    console.log('🟣 LOGIN PROXY 2 — BODY:', body);

    const cookieHeader = request.headers.get('cookie') || '';

    console.log('🟣 LOGIN PROXY 3 — CALLING BACKEND');
    console.log(
      '🟣 LOGIN PROXY 4 — API URL:',
      `${process.env.API_BASE_URL}/api/auth/login`
    );

    const response = await fetch(
      `${process.env.API_BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify(body),
      }
    );

    console.log('🟣 LOGIN PROXY 5 — BACKEND RESPONSE RECEIVED');
    console.log('🟣 LOGIN PROXY 6 — STATUS:', response.status);
    console.log(
      '🟣 LOGIN PROXY 7 — CONTENT-TYPE:',
      response.headers.get('content-type')
    );

    const rawResponse = await response.text();

    console.log('🟣 LOGIN PROXY 8 — RESPONSE BODY:', rawResponse);

    let data;

    try {
      data = JSON.parse(rawResponse);
      console.log('🟣 LOGIN PROXY 9 — JSON PARSED');
    } catch (parseError) {
      console.error('🔴 LOGIN PROXY — JSON PARSE ERROR:', parseError);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BACKEND_RESPONSE',
            message: 'Backend returned invalid JSON',
          },
        },
        { status: 502 }
      );
    }

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    console.log('🟣 LOGIN PROXY 10 — CREATED NEXT RESPONSE');

    const setCookies = response.headers.getSetCookie?.() || [];

    console.log(
      '🟣 LOGIN PROXY 11 — SET-COOKIES:',
      setCookies
    );

    setCookies.forEach((cookie) => {
      nextResponse.headers.append('Set-Cookie', cookie);
    });

    console.log('🟣 LOGIN PROXY 12 — RETURNING RESPONSE TO BROWSER');

    return nextResponse;
  } catch (error) {
    console.error('🔴 LOGIN PROXY ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Proxy error',
        },
      },
      { status: 500 }
    );
  }
}