'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getGroups } from '@/lib/db';

// Filter out series season groups (e.g., "Show Name - Season 1")
function filterAndSortGroups(groups: string[]): string[] {
  return groups
    .filter(group => {
      // Exclude groups that look like series seasons
      if (/ - Season \d+$/i.test(group)) return false;
      if (/ - Temporada \d+$/i.test(group)) return false;
      if (/S\d+E\d+/i.test(group)) return false;
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

export function useGroupsFromDB() {
  const activePlaylist = useStore((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const contentFilter = useStore((s) => s.contentFilter);

  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!activePlaylist) {
      setGroups([]);
      return;
    }

    setLoading(true);
    try {
      const contentType = contentFilter === 'all' ? undefined : contentFilter;
      const fetchedGroups = await getGroups(activePlaylist.id, contentType);
      // Filter out series seasons and sort alphabetically
      setGroups(filterAndSortGroups(fetchedGroups));
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylist, contentFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return groups;
}
