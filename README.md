# IPTV Player

A modern web-based IPTV player supporting M3U playlists and Xtream API. Stream Live TV, Movies & Series with HLS playback, EPG, favorites, search, and latency modes. Built with Next.js, React & Tailwind CSS.

## Features

- **Multi-format Support**
  - M3U playlists via URL
  - Xtream API endpoints
  - Local file import

- **Content Types**
  - Live TV channels
  - Movies (VOD)
  - TV Series with season/episode support

- **Player Features**
  - HLS streaming with hls.js
  - Low Latency, Balanced, and Smooth modes
  - Picture-in-Picture support
  - Quality selection
  - Fullscreen mode

- **User Experience**
  - Modern glassmorphism UI
  - Animated interface with Framer Motion
  - Channel search and filtering
  - Favorites system
  - Grid/List view toggle
  - Mini player mode
  - EPG (Electronic Program Guide) support

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Animation:** Framer Motion
- **State Management:** Zustand with persistence
- **Video:** hls.js
- **Storage:** IndexedDB

## Getting Started

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build

```bash
npm run build
npm start
```

## Deploy

Deploy on Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## License

MIT
