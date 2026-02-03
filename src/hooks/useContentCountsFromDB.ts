'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getContentCounts } from '@/lib/db';

export function useContentCountsFromDB() {
  const activePlaylist = useStore((s) => s.playlists.find((p) => p.id === s.activePlaylistId));

  const [counts, setCounts] = useState({ live: 0, movie: 0, series: 0 });

  const fetchCounts = useCallback(async () => {
    if (!activePlaylist) {
      setCounts({ live: 0, movie: 0, series: 0 });
      return;
    }

    try {
      const fetchedCounts = await getContentCounts(activePlaylist.id);
      setCounts(fetchedCounts);
    } catch (error) {
      console.error('Error fetching content counts:', error);
      setCounts({ live: 0, movie: 0, series: 0 });
    }
  }, [activePlaylist]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return counts;
}
