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

    // Get the response body as text/bytes
    const body = await response.arrayBuffer();

    // Check if this is an M3U8 playlist (HLS manifest)
    const textContent = new TextDecoder().decode(body);
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      textContent.includes('#EXTM3U')
    ) {
      // This is an HLS manifest - we need to rewrite URLs
      const originalUrl = new URL(streamUrl);
      const baseUrl = `${originalUrl.protocol}//${originalUrl.host}${originalUrl.pathname.substring(0, originalUrl.pathname.lastIndexOf('/'))}`;

      // Rewrite relative URLs to absolute proxied URLs
      const rewritten = textContent.split('\n').map(line => {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          return line;
        }

        // Check if this line looks like a URL
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          // Already absolute URL - proxy it
          return `/api/proxy/stream?url=${encodeURIComponent(trimmed)}`;
        } else if (trimmed.includes('.m3u8') || trimmed.includes('.ts')) {
          // Relative URL - make it absolute and proxy it
          const absoluteUrl = trimmed.startsWith('/')
            ? `${originalUrl.protocol}//${originalUrl.host}${trimmed}`
            : `${baseUrl}/${trimmed}`;
          return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
        }

        return line;
      }).join('\n');

      return new Response(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // For non-HLS content, stream directly
    const readableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(body));
        controller.close();
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
