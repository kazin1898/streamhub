# StreamHub Cloudflare Worker Proxy

This Cloudflare Worker proxies IPTV streams to bypass CORS restrictions with lower latency than Vercel's edge runtime.

## Setup

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy the worker:
```bash
cd cloudflare-worker
npm install
npm run deploy
```

4. After deployment, you'll get a URL like: `https://streamhub-proxy-xyz.workers.dev`

5. Add this URL as environment variable in Vercel:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_STREAM_PROXY_URL` = `https://your-worker-url.workers.dev`

6. Redeploy your Vercel app

## Benefits over Vercel Edge

- **Lower latency**: Cloudflare has edge locations in Brazil (São Paulo)
- **Free tier**: 100,000 requests/day
- **Global CDN**: 300+ locations worldwide
