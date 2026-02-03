import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Proxy for video streams to avoid CORS issues
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamUrl = searchParams.get('url');

  if (!streamUrl) {
    return new Response('Missing stream URL', { status: 400 });
  }

  try {
    console.log('[Stream Proxy] Fetching:', streamUrl.substring(0, 100) + '...');

    // Fetch the stream from the Xtream server
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(streamUrl).origin,
      },
    });

    if (!response.ok) {
      console.error('[Stream Proxy] Error:', response.status, response.statusText);
      return new Response(`Stream error: ${response.status}`, { status: response.status });
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response('Unable to read stream', { status: 500 });
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          console.error('[Stream Proxy] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Stream Proxy] Error:', error);
    return new Response('Failed to fetch stream', { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
