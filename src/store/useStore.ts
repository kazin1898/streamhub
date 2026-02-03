import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPlaylists as getDBPlaylists, getContentCounts as getDBContentCounts } from '@/lib/db';

export type ContentType = 'live' | 'movie' | 'series';

export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  isFavorite?: boolean;
  contentType: ContentType;
  // VOD specific
  year?: string;
  rating?: string;
  duration?: string;
  plot?: string;
  // Series specific
  seriesId?: string;
  seriesName?: string;
  seasonNum?: number;
  episodeNum?: number;
}

export interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url?: string;
  // Xtream specific
  xtreamUrl?: string;
  xtreamUser?: string;
  xtreamPass?: string;
  channels: Channel[];
  lastUpdated: number;
}

export interface EPGProgram {
  start: Date;
  end: Date;
  title: string;
  description?: string;
  channelId: string;
}

export interface HistoryItem {
  channelId: string;
  channelName: string;
  playlistId: string;
  timestamp: number;
  logo?: string;
}

export type LatencyMode = 'low' | 'balanced' | 'smooth';

interface PlayerState {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  currentQuality: number;
  availableQualities: { height: number; width?: number; bitrate: number }[];
  buffering: boolean;
  latency: number;
  latencyMode: LatencyMode;
}

interface AppState {
  // Playlists
  playlists: Playlist[];
  activePlaylistId: string | null;

  // Current playback
  currentChannel: Channel | null;

  // UI State
  sidebarOpen: boolean;
  epgOpen: boolean;
  settingsOpen: boolean;
  importModalOpen: boolean;
  playlistToUpdate: string | null;
  seriesDrawerOpen: boolean;
  seriesInfo: { seriesId: string; seriesName: string } | null;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  selectedGroup: string | null;
  contentFilter: ContentType | 'all';

  // Player
  player: PlayerState;

  // History & Favorites
  history: HistoryItem[];

  // EPG
  epgData: Map<string, EPGProgram[]>;

  // Actions
  addPlaylist: (playlist: Omit<Playlist, 'id' | 'lastUpdated'>) => void;
  removePlaylist: (id: string) => void;
  setActivePlaylist: (id: string | null) => void;
  updatePlaylistChannels: (id: string, channels: Channel[]) => void;

  setCurrentChannel: (channel: Channel | null) => void;
  toggleFavorite: (playlistId: string, channelId: string) => void;

  addToHistory: (item: Omit<HistoryItem, 'timestamp'>) => void;
  clearHistory: () => void;

  setSidebarOpen: (open: boolean) => void;
  setEpgOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
  setPlaylistToUpdate: (id: string | null) => void;
  setSeriesDrawerOpen: (open: boolean, seriesInfo?: { seriesId: string; seriesName: string } | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;
  setSelectedGroup: (group: string | null) => void;
  setContentFilter: (filter: ContentType | 'all') => void;

  updatePlayer: (state: Partial<PlayerState>) => void;

  setEpgData: (channelId: string, programs: EPGProgram[]) => void;

  // IndexedDB sync
  refreshPlaylists: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      playlists: [],
      activePlaylistId: null,
      currentChannel: null,

      sidebarOpen: true,
      epgOpen: false,
      settingsOpen: false,
      importModalOpen: false,
      playlistToUpdate: null,
      seriesDrawerOpen: false,
      seriesInfo: null,
      viewMode: 'grid',
      searchQuery: '',
      selectedGroup: null,
      contentFilter: 'live',

      player: {
        isPlaying: false,
        volume: 1,
        isMuted: false,
        isFullscreen: false,
        isPiP: false,
        currentQuality: -1, // auto
        availableQualities: [],
        buffering: false,
        latency: 0,
        latencyMode: 'balanced',
      },

      history: [],
      epgData: new Map(),

      // Actions
      addPlaylist: (playlist) => {
        const id = crypto.randomUUID();
        set((state) => ({
          playlists: [...state.playlists, { ...playlist, id, lastUpdated: Date.now() }],
          activePlaylistId: state.activePlaylistId || id,
        }));
      },

      removePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
          activePlaylistId: state.activePlaylistId === id
            ? state.playlists[0]?.id || null
            : state.activePlaylistId,
        }));
      },

      setActivePlaylist: (id) => set({ activePlaylistId: id }),

      updatePlaylistChannels: (id, channels) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, channels, lastUpdated: Date.now() } : p
          ),
        }));
      },

      setCurrentChannel: (channel) => {
        set({ currentChannel: channel });
        if (channel) {
          const state = get();
          state.addToHistory({
            channelId: channel.id,
            channelName: channel.name,
            playlistId: state.activePlaylistId || '',
            logo: channel.logo,
          });
        }
      },

      toggleFavorite: (playlistId, channelId) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  channels: p.channels.map((c) =>
                    c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c
                  ),
                }
              : p
          ),
        }));
      },

      addToHistory: (item) => {
        set((state) => {
          const filtered = state.history.filter((h) => h.channelId !== item.channelId);
          return {
            history: [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 50),
          };
        });
      },

      clearHistory: () => set({ history: [] }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setEpgOpen: (open) => set({ epgOpen: open }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setImportModalOpen: (open) => set({ importModalOpen: open }),
      setPlaylistToUpdate: (id) => set({ playlistToUpdate: id }),
      setSeriesDrawerOpen: (open, seriesInfo = null) => set({ seriesDrawerOpen: open, seriesInfo }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedGroup: (group) => set({ selectedGroup: group }),
      setContentFilter: (filter) => set({ contentFilter: filter, selectedGroup: null }),

      updatePlayer: (playerState) =>
        set((state) => ({ player: { ...state.player, ...playerState } })),

      setEpgData: (channelId, programs) => {
        set((state) => {
          const newMap = new Map(state.epgData);
          newMap.set(channelId, programs);
          return { epgData: newMap };
        });
      },

      refreshPlaylists: async () => {
        try {
          const dbPlaylists = await getDBPlaylists();
          const playlists = dbPlaylists.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            url: p.url,
            xtreamUrl: p.xtreamUrl,
            xtreamUser: p.xtreamUser,
            xtreamPass: p.xtreamPass,
            channels: [], // Don't load channels into memory
            lastUpdated: p.lastUpdated,
          })) as Playlist[];

          set({
            playlists,
            activePlaylistId: playlists.length > 0 ? playlists[0].id : null,
          });
        } catch (error) {
          console.error('Failed to refresh playlists from IndexedDB:', error);
        }
      },
    }),
    {
      name: 'iptv-player-storage',
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        viewMode: state.viewMode,
        history: state.history,
        player: {
          volume: state.player.volume,
          isMuted: state.player.isMuted,
          latencyMode: state.player.latencyMode,
          // Don't persist these - they should reset on reload
          availableQualities: [],
        },
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        return {
          ...currentState,
          ...persisted,
          player: {
            ...currentState.player,
            volume: persisted.player?.volume ?? currentState.player.volume,
            isMuted: persisted.player?.isMuted ?? currentState.player.isMuted,
            latencyMode: persisted.player?.latencyMode ?? currentState.player.latencyMode,
            // Always use fresh state for these
            availableQualities: [],
            buffering: false,
            isPlaying: false,
            currentQuality: -1,
            latency: 0,
          },
        };
      },
    }
  )
);

// Derived selectors
export const useActivePlaylist = () => {
  const playlists = useStore((s) => s.playlists);
  const activeId = useStore((s) => s.activePlaylistId);
  return playlists.find((p) => p.id === activeId) || null;
};

export const useFilteredChannels = () => {
  const playlist = useActivePlaylist();
  const search = useStore((s) => s.searchQuery);
  const group = useStore((s) => s.selectedGroup);
  const contentFilter = useStore((s) => s.contentFilter);

  if (!playlist) return [];

  let channels = playlist.channels;

  // Filter by content type first
  if (contentFilter !== 'all') {
    channels = channels.filter((c) => c.contentType === contentFilter);
  }

  if (search) {
    const q = search.toLowerCase();
    channels = channels.filter((c) => c.name.toLowerCase().includes(q));
  }

  if (group && group !== 'all' && group !== 'favorites') {
    channels = channels.filter((c) => c.group === group);
  }

  if (group === 'favorites') {
    channels = channels.filter((c) => c.isFavorite);
  }

  return channels;
};

export const useChannelGroups = () => {
  const playlist = useActivePlaylist();
  const contentFilter = useStore((s) => s.contentFilter);

  if (!playlist) return [];

  const groups = new Set<string>();
  playlist.channels
    .filter((c) => contentFilter === 'all' || c.contentType === contentFilter)
    .forEach((c) => {
      if (c.group) groups.add(c.group);
    });

  return Array.from(groups).sort();
};

// Get content type counts
export const useContentCounts = () => {
  const playlist = useActivePlaylist();
  if (!playlist) return { live: 0, movie: 0, series: 0 };

  const counts = { live: 0, movie: 0, series: 0 };
  playlist.channels.forEach((c) => {
    if (c.contentType in counts) {
      counts[c.contentType]++;
    }
  });

  return counts;
};
