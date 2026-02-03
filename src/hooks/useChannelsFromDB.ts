'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { getChannels, getContentCounts, type Channel } from '@/lib/db';

interface UseChannelsFromDBOptions {
  pageSize?: number;
}

interface UseChannelsFromDBResult {
  channels: Channel[];
  loading: boolean;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  refresh: () => void;
}

// Helper to sort channels alphabetically
function sortAlphabetically(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  );
}

// Helper to group series episodes into unique series
function groupSeriesEpisodes(episodes: Channel[]): Channel[] {
  const seriesMap = new Map<string, Channel>();

  for (const channel of episodes) {
    // Use seriesId, or generate one from seriesName, or fall back to channel name
    const seriesKey = channel.seriesId || channel.seriesName || channel.name;

    if (!seriesMap.has(seriesKey)) {
      // Use the first episode as the representative, but update the name to show series name
      const seriesName = channel.seriesName || channel.name.replace(/\s*S\d+E\d+.*$/i, '').trim();
      seriesMap.set(seriesKey, {
        ...channel,
        name: seriesName,
        seriesId: seriesKey,
        seriesName: seriesName,
      });
    }
  }

  // Return sorted alphabetically
  return sortAlphabetically(Array.from(seriesMap.values()));
}

export function useChannelsFromDB(options: UseChannelsFromDBOptions = {}): UseChannelsFromDBResult {
  const { pageSize = 50 } = options;

  const activePlaylist = useStore((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const searchQuery = useStore((s) => s.searchQuery);
  const selectedGroup = useStore((s) => s.selectedGroup);
  const contentFilter = useStore((s) => s.contentFilter);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Track current page and latest fetch params
  const pageRef = useRef(0);
  const latestParamsRef = useRef({
    playlistId: '',
    searchQuery: '',
    selectedGroup: '',
    contentFilter: '',
  });
  const loadingRef = useRef(false);

  // Cache for all sorted channels (to enable proper pagination with alphabetical order)
  const sortedChannelsRef = useRef<Channel[]>([]);
  const channelsFetchedRef = useRef(false);

  // Refresh when filters or playlist changes
  const refresh = useCallback(() => {
    setChannels([]);
    setHasMore(true);
    pageRef.current = 0;
    sortedChannelsRef.current = [];
    channelsFetchedRef.current = false;
  }, []);

  // Load more channels
  const loadMore = useCallback(async () => {
    if (!activePlaylist || loadingRef.current || !hasMore) return;

    const params = {
      playlistId: activePlaylist.id,
      searchQuery,
      selectedGroup: selectedGroup || '',
      contentFilter,
    };

    // Check if params changed - if so, refresh
    const latestParams = latestParamsRef.current;
    if (
      params.playlistId !== latestParams.playlistId ||
      params.searchQuery !== latestParams.searchQuery ||
      params.selectedGroup !== latestParams.selectedGroup ||
      params.contentFilter !== latestParams.contentFilter
    ) {
      latestParamsRef.current = params;
      refresh();
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      const offset = pageRef.current * pageSize;

      // Only fetch all channels once per filter combination
      if (!channelsFetchedRef.current) {
        let allChannels: Channel[];

        if (contentFilter === 'series') {
          // For series, fetch all and group
          const allSeriesEpisodes = await getChannels({
            playlistId: activePlaylist.id,
            searchQuery: searchQuery || undefined,
            group: selectedGroup === 'favorites' ? undefined : selectedGroup || undefined,
            isFavorite: selectedGroup === 'favorites' ? true : undefined,
            contentType: 'series',
            limit: 50000,
            offset: 0,
          });

          // Group episodes into unique series (already sorted)
          sortedChannelsRef.current = groupSeriesEpisodes(allSeriesEpisodes);
        } else {
          // For live/movies, fetch all and sort
          allChannels = await getChannels({
            playlistId: activePlaylist.id,
            searchQuery: searchQuery || undefined,
            group: selectedGroup === 'favorites' ? undefined : selectedGroup || undefined,
            isFavorite: selectedGroup === 'favorites' ? true : undefined,
            contentType: contentFilter === 'all' ? undefined : contentFilter,
            limit: 50000,
            offset: 0,
          });

          // Sort alphabetically
          sortedChannelsRef.current = sortAlphabetically(allChannels);
        }

        channelsFetchedRef.current = true;
      }

      // Paginate from the sorted/grouped channels
      const newChannels = sortedChannelsRef.current.slice(offset, offset + pageSize);

      // Update total count and hasMore
      const total = sortedChannelsRef.current.length;
      setTotalCount(total);
      setHasMore(offset + newChannels.length < total);

      setChannels((prev) => [...prev, ...newChannels]);
      pageRef.current += 1;

    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activePlaylist, searchQuery, selectedGroup, contentFilter, pageSize, hasMore, refresh]);

  // Initial load and refresh on filter changes
  useEffect(() => {
    if (!activePlaylist) {
      setChannels([]);
      setHasMore(false);
      setTotalCount(0);
      return;
    }

    const params = {
      playlistId: activePlaylist.id,
      searchQuery,
      selectedGroup: selectedGroup || '',
      contentFilter,
    };

    // Check if params changed
    const latestParams = latestParamsRef.current;
    if (
      params.playlistId !== latestParams.playlistId ||
      params.searchQuery !== latestParams.searchQuery ||
      params.selectedGroup !== latestParams.selectedGroup ||
      params.contentFilter !== latestParams.contentFilter
    ) {
      latestParamsRef.current = params;
      setChannels([]);
      setHasMore(true);
      pageRef.current = 0;
      sortedChannelsRef.current = [];
      channelsFetchedRef.current = false;
    }
  }, [activePlaylist, searchQuery, selectedGroup, contentFilter]);

  // Auto-load first page
  useEffect(() => {
    if (activePlaylist && channels.length === 0 && hasMore && !loadingRef.current) {
      loadMore();
    }
  }, [activePlaylist, channels.length, hasMore, loadMore]);

  return {
    channels,
    loading,
    hasMore,
    totalCount,
    loadMore,
    refresh,
  };
}
