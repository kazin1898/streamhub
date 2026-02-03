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
    // Fetch the stream from the server
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(streamUrl).origin,
      },
    } as RequestInit);

    if (!response.ok) {
      return new Response(`Stream error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Check if this might be an HLS manifest by content type or URL
    const isHlsManifest =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      streamUrl.includes('.m3u8');

    if (isHlsManifest && response.body) {
      // For HLS manifests, we need to read and rewrite URLs
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let manifest = '';
      let chunk;

      while (!(chunk = await reader.read()).done) {
        manifest += decoder.decode(chunk.value, { stream: true });
      }

      // Rewrite URLs in the manifest
      const originalUrl = new URL(streamUrl);
      const baseUrl = `${originalUrl.protocol}//${originalUrl.host}${originalUrl.pathname.substring(0, originalUrl.pathname.lastIndexOf('/'))}`;

      const rewritten = manifest.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return `/api/proxy/stream?url=${encodeURIComponent(trimmed)}`;
        }
        if (trimmed.includes('.m3u8') || trimmed.includes('.ts')) {
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
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For non-HLS content, stream directly through
    if (!response.body) {
      return new Response('No response body', { status: 500 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
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
