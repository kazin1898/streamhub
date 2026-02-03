import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Proxy for Xtream Codes API requests to avoid CORS issues
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const username = searchParams.get('username');
  const password = searchParams.get('password');
  const action = searchParams.get('action');
  const seriesId = searchParams.get('series_id');

  if (!url || !username || !password) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    // Build the Xtream API URL
    let apiUrl = `${url}/player_api.php?username=${username}&password=${password}`;

    if (action) {
      apiUrl += `&action=${action}`;
    }

    if (seriesId) {
      apiUrl += `&series_id=${seriesId}`;
    }

    console.log('[API Proxy] Fetching:', apiUrl.replace(password, '****'));

    // Make the request from the server (no CORS issues)
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Disable SSL verification for edge runtime
      // @ts-ignore - next-server-fetch types may not support this option
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Server returned ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Add CORS headers
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to server' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
