'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getChannels, type Channel } from '@/lib/db';

export function useChannelsForEPG(limit: number = 20) {
  const activePlaylist = useStore((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const contentFilter = useStore((s) => s.contentFilter);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChannels = useCallback(async () => {
    if (!activePlaylist) {
      setChannels([]);
      return;
    }

    setLoading(true);
    try {
      const fetchedChannels = await getChannels({
        playlistId: activePlaylist.id,
        contentType: contentFilter === 'all' ? undefined : contentFilter,
        limit,
        offset: 0,
      });
      setChannels(fetchedChannels);
    } catch (error) {
      console.error('Error fetching channels for EPG:', error);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylist, contentFilter, limit]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return { channels, loading };
}
