// Cloudflare Worker for StreamHub Stream Proxy
// Handles HLS streams and bypasses CORS issues

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response('Missing stream URL', { status: 400 });
    }

    try {
      // Fetch from the original server
      const response = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': new URL(streamUrl).origin,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        return new Response(`Stream error: ${response.status}`, { status: response.status });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Check if this is an HLS manifest
      const isHlsManifest =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        streamUrl.includes('.m3u8');

      if (isHlsManifest) {
        // Read and rewrite HLS manifest
        const text = await response.text();
        const originalUrl = new URL(streamUrl);
        const baseUrl = `${originalUrl.protocol}//${originalUrl.host}${originalUrl.pathname.substring(0, originalUrl.pathname.lastIndexOf('/'))}`;

        const rewritten = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return `?url=${encodeURIComponent(trimmed)}`;
          }
          if (trimmed.includes('.m3u8') || trimmed.includes('.ts')) {
            const absoluteUrl = trimmed.startsWith('/')
              ? `${originalUrl.protocol}//${originalUrl.host}${trimmed}`
              : `${baseUrl}/${trimmed}`;
            return `?url=${encodeURIComponent(absoluteUrl)}`;
          }
          return line;
        }).join('\n');

        return new Response(rewritten, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'max-age=5',
          },
        });
      }

      // For non-HLS content, stream through
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=3600, public',
        },
      });

    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};
