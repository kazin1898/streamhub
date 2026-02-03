import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Proxy for M3U playlist fetching to avoid CORS issues
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 }
      );
    }

    console.log('[API Proxy] Fetching M3U:', url);

    // Make the request from the server (no CORS issues)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // @ts-ignore
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      );
    }

    const content = await response.text();

    // Return the M3U content
    return NextResponse.json(
      { content },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlist' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
