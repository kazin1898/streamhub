import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Channel, Playlist } from '@/store/useStore';

// Re-export Channel type for convenience
export type { Channel };

interface IPTVDatabase extends DBSchema {
  playlists: {
    key: string;
    value: Omit<Playlist, 'channels'> & { channelCount: number };
  };
  channels: {
    key: string;
    value: Channel & { playlistId: string };
    indexes: {
      'by-playlist': string;
      'by-playlist-type': [string, string];
      'by-playlist-group': [string, string];
    };
  };
}

let db: IDBPDatabase<IPTVDatabase> | null = null;

export async function getDB(): Promise<IDBPDatabase<IPTVDatabase>> {
  if (db) return db;

  db = await openDB<IPTVDatabase>('iptv-player-db', 1, {
    upgrade(database) {
      // Playlists store
      if (!database.objectStoreNames.contains('playlists')) {
        database.createObjectStore('playlists', { keyPath: 'id' });
      }

      // Channels store with indexes for efficient querying
      if (!database.objectStoreNames.contains('channels')) {
        const channelStore = database.createObjectStore('channels', { keyPath: 'id' });
        channelStore.createIndex('by-playlist', 'playlistId');
        channelStore.createIndex('by-playlist-type', ['playlistId', 'contentType']);
        channelStore.createIndex('by-playlist-group', ['playlistId', 'group']);
      }
    },
  });

  return db;
}

// Save a playlist with its channels
export async function savePlaylist(playlist: Playlist, options: { replace?: boolean } = {}): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['playlists', 'channels'], 'readwrite');

  // If replace is true, delete all existing channels for this playlist first
  if (options.replace) {
    const channelStore = tx.objectStore('channels');
    const index = channelStore.index('by-playlist');
    let cursor = await index.openCursor(playlist.id);

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }

  // Save playlist metadata (without channels array)
  const { channels, ...playlistMeta } = playlist;
  await tx.objectStore('playlists').put({
    ...playlistMeta,
    channelCount: channels.length,
  });

  // Save channels in batches to avoid blocking
  const channelStore = tx.objectStore('channels');
  const BATCH_SIZE = 1000;

  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((channel) =>
        channelStore.put({ ...channel, playlistId: playlist.id })
      )
    );
  }

  await tx.done;
}

// Save channels for an existing playlist (used for fetching series episodes)
export async function saveChannels(
  playlistId: string,
  channels: Channel[]
): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['playlists', 'channels'], 'readwrite');

  // Get current playlist to update channel count
  const playlist = await tx.objectStore('playlists').get(playlistId);

  // Save channels in batches
  const channelStore = tx.objectStore('channels');
  const BATCH_SIZE = 1000;

  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((channel) =>
        channelStore.put({ ...channel, playlistId })
      )
    );
  }

  // Update playlist channel count
  if (playlist) {
    const existingChannels = await channelStore.index('by-playlist').getAll(playlistId);
    await tx.objectStore('playlists').put({
      ...playlist,
      channelCount: existingChannels.length,
    });
  }

  await tx.done;
}

// Get all playlists (metadata only)
export async function getPlaylists(): Promise<Array<Omit<Playlist, 'channels'> & { channelCount: number }>> {
  const database = await getDB();
  return database.getAll('playlists');
}

// Get channels for a playlist with pagination and filtering
export async function getChannels(
  options: {
    playlistId: string;
    searchQuery?: string;
    group?: string;
    isFavorite?: boolean;
    contentType?: string;
    offset?: number;
    limit?: number;
  }
): Promise<Channel[]> {
  const database = await getDB();
  const { playlistId, searchQuery, group, isFavorite, contentType, offset = 0, limit = 100 } = options;

  let allChannels: Channel[] = [];

  if (contentType && contentType !== 'all') {
    // Use index for content type filtering
    const index = database.transaction('channels').store.index('by-playlist-type');
    const range = IDBKeyRange.only([playlistId, contentType]);
    allChannels = await index.getAll(range);
  } else {
    // Get all channels for playlist
    const index = database.transaction('channels').store.index('by-playlist');
    allChannels = await index.getAll(playlistId);
  }

  // Apply group filter
  if (group && group !== 'all') {
    allChannels = allChannels.filter((c) => c.group === group);
  }

  // Apply favorite filter
  if (isFavorite !== undefined) {
    allChannels = allChannels.filter((c) => c.isFavorite === isFavorite);
  }

  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    allChannels = allChannels.filter((c) => c.name.toLowerCase().includes(q));
  }

  // Apply pagination
  const paginatedChannels = allChannels.slice(offset, offset + limit);

  return paginatedChannels;
}

// Get unique groups for a playlist and content type
export async function getGroups(
  playlistId: string,
  contentType?: string
): Promise<string[]> {
  const database = await getDB();
  let channels: Channel[];

  if (contentType && contentType !== 'all') {
    const index = database.transaction('channels').store.index('by-playlist-type');
    channels = await index.getAll(IDBKeyRange.only([playlistId, contentType]));
  } else {
    const index = database.transaction('channels').store.index('by-playlist');
    channels = await index.getAll(playlistId);
  }

  const groups = new Set<string>();
  channels.forEach((c) => {
    if (c.group) groups.add(c.group);
  });

  return Array.from(groups).sort();
}

// Get content counts for a playlist
export async function getContentCounts(
  playlistId: string
): Promise<{ live: number; movie: number; series: number }> {
  const database = await getDB();
  const index = database.transaction('channels').store.index('by-playlist');
  const channels = await index.getAll(playlistId);

  const counts = { live: 0, movie: 0, series: 0 };
  channels.forEach((c) => {
    if (c.contentType in counts) {
      counts[c.contentType as keyof typeof counts]++;
    }
  });

  return counts;
}

// Toggle favorite
export async function toggleChannelFavorite(channelId: string): Promise<boolean> {
  const database = await getDB();
  const tx = database.transaction('channels', 'readwrite');
  const channel = await tx.store.get(channelId);

  if (channel) {
    channel.isFavorite = !channel.isFavorite;
    await tx.store.put(channel);
    await tx.done;
    return channel.isFavorite;
  }

  return false;
}

// Delete a playlist and its channels
export async function deletePlaylist(playlistId: string): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['playlists', 'channels'], 'readwrite');

  // Delete playlist
  await tx.objectStore('playlists').delete(playlistId);

  // Delete all channels for this playlist
  const channelStore = tx.objectStore('channels');
  const index = channelStore.index('by-playlist');
  let cursor = await index.openCursor(playlistId);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(['playlists', 'channels'], 'readwrite');
  await tx.objectStore('playlists').clear();
  await tx.objectStore('channels').clear();
  await tx.done;
}

// Delete and recreate the entire database (useful when quota is exceeded)
export async function resetDatabase(): Promise<void> {
  // Close existing connection
  if (db) {
    db.close();
    db = null;
  }

  // Delete the database
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('iptv-player-db');
    request.onsuccess = () => resolve(void 0);
    request.onerror = () => reject(request.error);
  });

  console.log('[DB] Database deleted successfully');
}

// Get a single channel by ID
export async function getChannel(channelId: string): Promise<Channel | undefined> {
  const database = await getDB();
  return database.get('channels', channelId);
}
