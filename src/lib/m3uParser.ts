import type { Channel, ContentType } from '@/store/useStore';

interface M3UParseResult {
  channels: Channel[];
  errors: string[];
}

// Proxy URL for streams - can be overridden with environment variable
// Set NEXT_PUBLIC_STREAM_PROXY_URL in Vercel to use Cloudflare Worker
const STREAM_PROXY_URL = process.env.NEXT_PUBLIC_STREAM_PROXY_URL || '/api/proxy/stream';

// Keywords to detect content type
const MOVIE_KEYWORDS = ['filme', 'filmes', 'movie', 'movies', 'vod', 'cinema', '4k filme', 'lançamento', 'lancamento'];
const SERIES_KEYWORDS = ['série', 'series', 'séries', 'serie', 'temporada', 'episodio', 'episódio', 's0', 'e0', 'season', 'episode'];

function detectContentType(name: string, group: string, url: string): ContentType {
  const lowerName = name.toLowerCase();
  const lowerGroup = group.toLowerCase();
  const lowerUrl = url.toLowerCase();

  // Check for series patterns (S01E01, etc.)
  if (/s\d{1,2}[\s\-_]?e\d{1,2}/i.test(name) || /\d{1,2}x\d{1,2}/i.test(name)) {
    return 'series';
  }

  // Check keywords in group
  for (const keyword of SERIES_KEYWORDS) {
    if (lowerGroup.includes(keyword)) return 'series';
  }
  for (const keyword of MOVIE_KEYWORDS) {
    if (lowerGroup.includes(keyword)) return 'movie';
  }

  // Check URL patterns
  if (lowerUrl.includes('/movie/') || lowerUrl.includes('/vod/')) {
    return 'movie';
  }
  if (lowerUrl.includes('/series/')) {
    return 'series';
  }

  // Check name keywords
  for (const keyword of SERIES_KEYWORDS) {
    if (lowerName.includes(keyword)) return 'series';
  }
  for (const keyword of MOVIE_KEYWORDS) {
    if (lowerName.includes(keyword)) return 'movie';
  }

  // Default to live
  return 'live';
}

// Parse series info from name (e.g., "Show Name S01E05")
function parseSeriesInfo(name: string): { seriesId?: string; seriesName?: string; seasonNum?: number; episodeNum?: number } {
  const match = name.match(/s(\d{1,2})[\s\-_]?e(\d{1,2})/i) || name.match(/(\d{1,2})x(\d{1,2})/i);
  if (match) {
    // Extract the series name (everything before the season/episode pattern)
    const seriesNameMatch = name.match(/^(.+?)[\s\-_]*(?:s\d{1,2}[\s\-_]?e\d{1,2}|\d{1,2}x\d{1,2})/i);
    const seriesName = seriesNameMatch ? seriesNameMatch[1].trim() : name;

    // Generate a seriesId based on the series name (normalized)
    const seriesId = seriesName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return {
      seriesId,
      seriesName,
      seasonNum: parseInt(match[1], 10),
      episodeNum: parseInt(match[2], 10),
    };
  }
  return {};
}

// Optimized M3U parser - can handle large files efficiently
export function parseM3U(content: string): M3UParseResult {
  const channels: Channel[] = [];
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  let currentChannel: Partial<Channel> | null = null;
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();

    if (!trimmed || trimmed === '#EXTM3U') continue;

    if (trimmed.startsWith('#EXTINF:')) {
      try {
        currentChannel = parseExtInf(trimmed);
      } catch (e) {
        errors.push(`Line ${lineNumber}: Failed to parse EXTINF`);
        currentChannel = null;
      }
    } else if (trimmed.startsWith('#EXTVLCOPT:') || trimmed.startsWith('#EXTGRP:')) {
      // Extended attributes
      if (currentChannel && trimmed.startsWith('#EXTGRP:')) {
        currentChannel.group = trimmed.substring(8).trim();
      }
    } else if (!trimmed.startsWith('#')) {
      // This is a URL
      if (currentChannel && isValidUrl(trimmed)) {
        const name = currentChannel.name || 'Unknown Channel';
        const group = currentChannel.group || 'Uncategorized';
        const contentType = detectContentType(name, group, trimmed);
        const seriesInfo = contentType === 'series' ? parseSeriesInfo(name) : {};

        channels.push({
          id: crypto.randomUUID(),
          name,
          url: trimmed,
          logo: currentChannel.logo,
          group,
          tvgId: currentChannel.tvgId,
          tvgName: currentChannel.tvgName,
          contentType,
          // Use tvg tags first (they have priority), then parsed info from name
          seriesId: currentChannel.seriesId || seriesInfo.seriesId,
          seriesName: seriesInfo.seriesName,
          seasonNum: currentChannel.seasonNum || seriesInfo.seasonNum,
          episodeNum: currentChannel.episodeNum || seriesInfo.episodeNum,
        });
      }
      currentChannel = null;
    }
  }

  return { channels, errors };
}

function parseExtInf(line: string): Partial<Channel> {
  const channel: Partial<Channel> = {};

  // Extract attributes like tvg-id, tvg-name, tvg-logo, group-title
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
  const groupMatch = line.match(/group-title="([^"]*)"/i);

  if (tvgIdMatch) channel.tvgId = tvgIdMatch[1];
  if (tvgNameMatch) channel.tvgName = tvgNameMatch[1];
  if (tvgLogoMatch) channel.logo = tvgLogoMatch[1];
  if (groupMatch) channel.group = groupMatch[1];

  // Extract series-specific attributes
  const tvgSerieMatch = line.match(/tvg-serie="([^"]*)"/i);
  const tvgSeriesIdMatch = line.match(/tvg-series-id="([^"]*)"/i);
  const tvgSeasonMatch = line.match(/tvg-season="([^"]*)"/i);
  const tvgEpisodeMatch = line.match(/tvg-episode="([^"]*)"/i);
  const tvgTypeMatch = line.match(/tvg-type="([^"]*)"/i);

  if (tvgSeriesIdMatch) {
    channel.seriesId = tvgSeriesIdMatch[1];
  } else if (tvgSerieMatch) {
    // Use tvg-serie as seriesId if tvg-series-id is not present
    channel.seriesId = tvgSerieMatch[1];
  }

  if (tvgSeasonMatch) {
    const season = parseInt(tvgSeasonMatch[1], 10);
    if (!isNaN(season)) channel.seasonNum = season;
  }

  if (tvgEpisodeMatch) {
    const episode = parseInt(tvgEpisodeMatch[1], 10);
    if (!isNaN(episode)) channel.episodeNum = episode;
  }

  // Log series info for debugging
  if (channel.seriesId || channel.seasonNum || channel.episodeNum) {
    console.log('[M3U Parser] Series tags found:', {
      name: channel.name,
      seriesId: channel.seriesId,
      seasonNum: channel.seasonNum,
      episodeNum: channel.episodeNum,
    });
  }

  // Extract channel name (after the last comma)
  const nameMatch = line.match(/,([^,]+)$/);
  if (nameMatch) {
    channel.name = nameMatch[1].trim();
  }

  return channel;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'rtmp:';
  } catch {
    return false;
  }
}

// Xtream Codes API parser
export interface XtreamCredentials {
  url: string;
  username: string;
  password: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
}

export interface XtreamVOD {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
  rating?: string;
  plot?: string;
  releaseDate?: string;
  container_extension?: string;
}

export interface XtreamSeries {
  series_id: number;
  name: string;
  cover: string;
  category_id: string;
  rating?: string;
  plot?: string;
}

export interface XtreamSeriesInfo {
  series_id: number;
  name: string;
  cover: string;
  plot?: string;
  rating?: string;
  genre?: string;
  cast?: string;
  director?: string;
  releaseDate?: string;
  last_modified?: string;
  episodes: {
    [seasonNum: string]: XtreamEpisode[];
  };
}

export interface XtreamEpisode {
  id: number;
  title: string;
  container_extension?: string;
  custom_sid?: string;
  added?: string;
  season?: number;
  episode_num?: number;
  info?: {
    plot?: string;
    duration?: string;
    rating?: string;
    releaseDate?: string;
    director?: string;
    cast?: string;
  };
}

// Helper function to fetch from our API proxy
async function fetchFromXtreamProxy(
  url: string,
  username: string,
  password: string,
  action?: string,
  seriesId?: string
): Promise<any> {
  const params = new URLSearchParams({
    url,
    username,
    password,
  });

  if (action) params.append('action', action);
  if (seriesId) params.append('series_id', seriesId);

  const response = await fetch(`/api/proxy/xtream?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Server returned ${response.status}`);
  }

  return response.json();
}

export async function fetchXtreamChannels(
  creds: XtreamCredentials,
  onProgress?: (status: string) => void
): Promise<Channel[]> {
  const baseUrl = creds.url.replace(/\/$/, '');

  // Helper to create proxied URL for streams
  const createStreamUrl = (originalUrl: string) => {
    return `${STREAM_PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
  };

  const allChannels: Channel[] = [];

  try {
    // First, authenticate and check account status using proxy
    const authData = await fetchFromXtreamProxy(baseUrl, creds.username, creds.password);

    // Check for common error responses
    if (authData.user_info) {
      const userInfo = authData.user_info;

      if (userInfo.auth === 0) {
        throw new Error('Authentication failed: Invalid username or password');
      }

      if (userInfo.status === 'Expired') {
        throw new Error('Account expired. Please renew your subscription.');
      }

      if (userInfo.status === 'Banned') {
        throw new Error('Account has been banned.');
      }

      if (userInfo.status === 'Disabled') {
        throw new Error('Account is disabled.');
      }

      // Check max connections
      if (userInfo.max_connections && userInfo.active_cons >= userInfo.max_connections) {
        throw new Error(`Max connections reached (${userInfo.active_cons}/${userInfo.max_connections}). Close other streams and try again.`);
      }
    }

    // Check for error message in response
    if (authData.error || authData.message) {
      throw new Error(authData.error || authData.message);
    }

    // === LIVE TV ===
    onProgress?.('Fetching live channels...');
    const [liveCategories, liveStreams] = await Promise.all([
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_live_categories'),
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_live_streams'),
    ]);

    const liveCatMap = new Map(
      (liveCategories || []).map((c: XtreamCategory) => [c.category_id, c.category_name])
    );

    (liveStreams || []).forEach((stream: XtreamStream) => {
      const originalUrl = `${baseUrl}/live/${creds.username}/${creds.password}/${stream.stream_id}.m3u8`;
      allChannels.push({
        id: crypto.randomUUID(),
        name: stream.name,
        url: createStreamUrl(originalUrl),
        originalUrl, // Store original for direct connection attempt
        logo: stream.stream_icon,
        group: (liveCatMap.get(stream.category_id) as string | undefined) || 'Live TV',
        tvgId: String(stream.stream_id),
        contentType: 'live',
      });
    });

    onProgress?.(`Found ${allChannels.length} live channels. Fetching movies...`);

    // === MOVIES (VOD) ===
    const [vodCategories, vodStreams] = await Promise.all([
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_vod_categories'),
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_vod_streams'),
    ]);

    const vodCatMap = new Map(
      (vodCategories || []).map((c: XtreamCategory) => [c.category_id, c.category_name])
    );

    (vodStreams || []).forEach((vod: XtreamVOD) => {
      const ext = vod.container_extension || 'mp4';
      const originalUrl = `${baseUrl}/movie/${creds.username}/${creds.password}/${vod.stream_id}.${ext}`;
      allChannels.push({
        id: crypto.randomUUID(),
        name: vod.name,
        url: createStreamUrl(originalUrl),
        originalUrl, // Store original for direct connection attempt
        logo: vod.stream_icon,
        group: (vodCatMap.get(vod.category_id) as string | undefined) || 'Movies',
        tvgId: String(vod.stream_id),
        contentType: 'movie',
        rating: vod.rating,
        plot: vod.plot,
        year: vod.releaseDate?.substring(0, 4),
      });
    });

    onProgress?.(`Found ${allChannels.length} channels. Fetching series...`);

    // === SERIES ===
    const [seriesCategories, seriesList] = await Promise.all([
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_series_categories'),
      fetchFromXtreamProxy(baseUrl, creds.username, creds.password, 'get_series'),
    ]);

    const seriesCatMap = new Map(
      (seriesCategories || []).map((c: XtreamCategory) => [c.category_id, c.category_name])
    );

    (seriesList || []).forEach((series: XtreamSeries) => {
      // For series, we create a placeholder entry - episodes would need separate fetch
      allChannels.push({
        id: crypto.randomUUID(),
        name: series.name,
        url: '', // Will be filled when user selects the series
        logo: series.cover,
        group: (seriesCatMap.get(series.category_id) as string | undefined) || 'Series',
        tvgId: String(series.series_id),
        contentType: 'series',
        seriesId: String(series.series_id),
        rating: series.rating,
        plot: series.plot,
      });
    });

  } catch (error) {
    console.error('Error fetching Xtream data:', error);

    // Re-throw with better message
    if (error instanceof Error) {
      // Check for quota/storage errors
      if (error.message.includes('quota') || error.name === 'QuotaExceededError') {
        throw new Error('Browser storage is full. Try clearing site data or using a different browser.');
      }
      throw error;
    }

    throw new Error('Failed to connect to Xtream server. Check URL and credentials.');
  }

  if (allChannels.length === 0) {
    throw new Error('No channels found. The account may have no active subscriptions.');
  }

  return allChannels;
}

// Fetch series episodes from Xtream Codes API
export async function fetchXtreamSeriesEpisodes(
  creds: XtreamCredentials,
  seriesId: string,
  seriesName: string,
  onProgress?: (status: string) => void
): Promise<Channel[]> {
  const baseUrl = creds.url.replace(/\/$/, '');

  // Helper to create proxied URL for streams
  const createStreamUrl = (originalUrl: string) => {
    return `${STREAM_PROXY_URL}?url=${encodeURIComponent(originalUrl)}`;
  };

  const episodes: Channel[] = [];

  try {
    onProgress?.(`Fetching episodes for ${seriesName}...`);

    const seriesInfo = await fetchFromXtreamProxy(
      baseUrl,
      creds.username,
      creds.password,
      'get_series_info',
      seriesId
    );

    console.log('[Xtream] Series info response:', seriesInfo);
    console.log('[Xtream] Episodes key:', seriesInfo.episodes);
    console.log('[Xtream] Episodes keys:', Object.keys(seriesInfo.episodes || {}));

    // Process each season and its episodes
    for (const [seasonNum, seasonEpisodes] of Object.entries(seriesInfo.episodes || {})) {
      console.log(`[Xtream] Season ${seasonNum}:`, seasonEpisodes);
      for (const ep of seasonEpisodes as XtreamEpisode[]) {
        const ext = ep.container_extension || 'mp4';
        const episodeNum = ep.episode_num || 0;
        const season = ep.season || parseInt(seasonNum, 10);

        // Build episode title
        let title = `${seriesName}`;
        if (ep.title && ep.title !== seriesName) {
          title = ep.title;
        }

        episodes.push({
          id: crypto.randomUUID(),
          name: title,
          // Xtream API uses episode ID directly in the URL, not series/season/episode
          url: createStreamUrl(`${baseUrl}/series/${creds.username}/${creds.password}/${ep.id}.${ext}`),
          originalUrl: `${baseUrl}/series/${creds.username}/${creds.password}/${ep.id}.${ext}`, // Store original
          logo: seriesInfo.cover,
          group: `${seriesName} - Season ${season}`,
          tvgId: String(ep.id),
          contentType: 'series',
          seriesId: String(seriesId),
          seasonNum: season,
          episodeNum: episodeNum,
          plot: ep.info?.plot || seriesInfo.plot,
          duration: ep.info?.duration,
          rating: ep.info?.rating || seriesInfo.rating,
          year: ep.info?.releaseDate?.substring(0, 4) || seriesInfo.releaseDate?.substring(0, 4),
        });
      }
    }

    console.log(`[Xtream] Fetched ${episodes.length} episodes for series ${seriesName} (${seriesId})`);
    return episodes;
  } catch (error) {
    console.error(`Error fetching series episodes for ${seriesId}:`, error);
    throw error;
  }
}

// Web Worker message types for background parsing
export type ParserWorkerMessage =
  | { type: 'parse'; content: string }
  | { type: 'result'; channels: Channel[]; errors: string[] }
  | { type: 'error'; message: string };

// Create parser worker code as blob URL
export function createParserWorker(): Worker | null {
  if (typeof window === 'undefined') return null;

  const workerCode = `
    self.onmessage = function(e) {
      if (e.data.type === 'parse') {
        try {
          const result = parseM3U(e.data.content);
          self.postMessage({ type: 'result', ...result });
        } catch (err) {
          self.postMessage({ type: 'error', message: err.message });
        }
      }
    };

    ${parseM3U.toString()}
    ${parseExtInf.toString()}
    ${isValidUrl.toString()}
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}
