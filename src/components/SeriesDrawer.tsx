'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clapperboard, Calendar, Clock, Film, Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useState, useEffect, useMemo } from 'react';
import { useChannelsFromDB } from '@/hooks/useChannelsFromDB';
import { getChannels, saveChannels, type Channel } from '@/lib/db';
import { fetchXtreamSeriesEpisodes } from '@/lib/m3uParser';

interface SeriesDrawerProps {
  seriesId: string;
  seriesName: string;
  onClose: () => void;
}

interface Season {
  seasonNum: number;
  episodes: Channel[];
}

export default function SeriesDrawer({ seriesId, seriesName, onClose }: SeriesDrawerProps) {
  const activePlaylist = useStore((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const setCurrentChannel = useStore((s) => s.setCurrentChannel);
  const currentChannel = useStore((s) => s.currentChannel);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  // Fetch all episodes for this series
  useEffect(() => {
    if (!activePlaylist) return;

    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        console.log('[SeriesDrawer] Fetching episodes for seriesId:', seriesId);
        console.log('[SeriesDrawer] Active playlist:', activePlaylist?.type, activePlaylist?.name);

        // First, try to get from IndexedDB
        setLoadingStatus('Checking local cache...');
        const cachedEpisodes = await getChannels({
          playlistId: activePlaylist.id,
          contentType: 'series',
        });

        console.log('[SeriesDrawer] Total cached series episodes:', cachedEpisodes.length);

        // Filter episodes for this series - match by seriesId or by seriesName
        // IMPORTANT: Only include REAL episodes (with URL and episodeNum), not series placeholders
        const seriesEpisodes = cachedEpisodes.filter(ep => {
          // Skip placeholders (no URL or no episodeNum)
          if (!ep.url || ep.url === '') return false;
          if (ep.episodeNum === undefined || ep.episodeNum === null) return false;

          // Direct seriesId match
          if (ep.seriesId === seriesId) return true;
          // Match by seriesName (for M3U parsed series)
          if (ep.seriesName && ep.seriesName.toLowerCase() === seriesName.toLowerCase()) return true;
          // Match by name containing the series name with S##E## pattern
          if (ep.name.toLowerCase().includes(seriesName.toLowerCase()) &&
            /s\d+e\d+/i.test(ep.name)) return true;
          return false;
        });
        console.log('[SeriesDrawer] Filtered episodes for this series:', seriesEpisodes.length);

        // If we have cached REAL episodes (not just placeholders), use them
        if (seriesEpisodes.length > 0) {
          console.log('[SeriesDrawer] Using cached episodes:', seriesEpisodes.length);
          processEpisodes(seriesEpisodes);
          setLoading(false);
          return;
        }

        // If no cached episodes AND playlist is Xtream, fetch from API
        console.log('[SeriesDrawer] Playlist credentials check:', {
          type: activePlaylist.type,
          hasXtreamUrl: !!activePlaylist.xtreamUrl,
          hasXtreamUser: !!activePlaylist.xtreamUser,
          hasXtreamPass: !!activePlaylist.xtreamPass,
        });

        if (activePlaylist.type === 'xtream' && activePlaylist.xtreamUrl && activePlaylist.xtreamUser && activePlaylist.xtreamPass) {
          console.log('[SeriesDrawer] Fetching from Xtream API for:', seriesName, 'seriesId:', seriesId);
          setLoadingStatus(`Fetching episodes for ${seriesName}...`);

          try {
            const fetchedEpisodes = await fetchXtreamSeriesEpisodes(
              {
                url: activePlaylist.xtreamUrl,
                username: activePlaylist.xtreamUser,
                password: activePlaylist.xtreamPass,
              },
              seriesId,
              seriesName,
              (status) => setLoadingStatus(status)
            );

            console.log('[SeriesDrawer] Fetched episodes from API:', fetchedEpisodes.length);

            // Save to IndexedDB
            setLoadingStatus('Saving to cache...');
            await saveChannels(activePlaylist.id, fetchedEpisodes);

            // Process the episodes
            processEpisodes(fetchedEpisodes);
          } catch (apiError) {
            console.error('[SeriesDrawer] Error fetching from Xtream API:', apiError);
            // If API fails, show empty state
            setSeasons([]);
          }
        } else {
          // No cached episodes and not Xtream - show empty state
          console.log('[SeriesDrawer] No episodes found and not Xtream playlist');
          console.log('[SeriesDrawer] Playlist type:', activePlaylist.type);
          console.log('[SeriesDrawer] Has xtreamUrl?', !!activePlaylist.xtreamUrl);
          setSeasons([]);
        }
      } catch (error) {
        console.error('Error fetching series episodes:', error);
        setSeasons([]);
      } finally {
        setLoading(false);
        setLoadingStatus(null);
      }
    };

    fetchEpisodes();
  }, [activePlaylist, seriesId, seriesName]);

  // Helper function to process episodes into seasons
  const processEpisodes = (episodes: Channel[]) => {
    const seasonMap = new Map<number, Channel[]>();
    episodes.forEach(ep => {
      const season = ep.seasonNum || 1;
      if (!seasonMap.has(season)) {
        seasonMap.set(season, []);
      }
      seasonMap.get(season)!.push(ep);
    });

    // Convert to array and sort episodes within each season
    const seasonArray: Season[] = Array.from(seasonMap.entries())
      .map(([seasonNum, episodes]) => ({
        seasonNum,
        episodes: episodes.sort((a, b) => (a.episodeNum || 0) - (b.episodeNum || 0)),
      }))
      .sort((a, b) => a.seasonNum - b.seasonNum);

    setSeasons(seasonArray);
    if (seasonArray.length > 0) {
      setSelectedSeason(seasonArray[0].seasonNum);
    }
  };

  const currentSeasonEpisodes = useMemo(() => {
    return seasons.find(s => s.seasonNum === selectedSeason)?.episodes || [];
  }, [seasons, selectedSeason]);

  const handleEpisodeClick = (episode: Channel) => {
    setCurrentChannel(episode);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{
          type: 'tween',
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl glass z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-blue/20 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-neon-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-xl font-semibold text-light truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {seriesName}
              </h2>
              <p className="text-sm text-mist">
                {seasons.length} season{seasons.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-mist" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-neon-blue/30 border-t-neon-blue animate-spin" />
              <p className="text-sm text-mist">{loadingStatus || 'Loading episodes...'}</p>
            </div>
          </div>
        ) : seasons.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Film className="w-16 h-16 mx-auto text-steel mb-4" />
              <p className="text-light mb-2">No episodes found</p>
              <p className="text-sm text-mist">This series has no available episodes</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Season tabs */}
            <div className="p-4 border-b border-white/5 overflow-x-auto">
              <div className="flex gap-2">
                {seasons.map((season) => (
                  <button
                    key={season.seasonNum}
                    onClick={() => setSelectedSeason(season.seasonNum)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      selectedSeason === season.seasonNum
                        ? 'bg-neon-blue/30 text-neon-blue'
                        : 'text-mist hover:text-light hover:bg-white/5'
                    }`}
                  >
                    Season {season.seasonNum}
                    <span className={`ml-2 text-xs ${
                      selectedSeason === season.seasonNum ? 'text-neon-blue' : 'text-steel'
                    }`}>
                      ({season.episodes.length})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Episodes list */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {currentSeasonEpisodes.map((episode, index) => {
                  const isCurrentEpisode = currentChannel?.id === episode.id;
                  return (
                    <motion.button
                      key={episode.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.15,
                        ease: 'easeOut',
                        delay: Math.min(index * 0.03, 0.15)
                      }}
                      onClick={() => handleEpisodeClick(episode)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                        isCurrentEpisode
                          ? 'bg-neon-blue/20 border border-neon-blue/40'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {/* Episode number badge */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                        isCurrentEpisode
                          ? 'bg-neon-blue/30'
                          : 'bg-shadow'
                      }`}>
                        <span className={`text-sm font-bold ${
                          isCurrentEpisode ? 'text-neon-blue' : 'text-mist'
                        }`}>
                          {episode.episodeNum || '?'}
                        </span>
                      </div>

                      {/* Episode info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm font-medium truncate ${
                            isCurrentEpisode ? 'text-neon-blue' : 'text-light'
                          }`}>
                            {episode.name}
                          </p>
                          {episode.year && (
                            <span className="text-xs text-steel whitespace-nowrap">
                              ({episode.year})
                            </span>
                          )}
                        </div>
                        {episode.plot && (
                          <p className="text-xs text-mist line-clamp-2">
                            {episode.plot}
                          </p>
                        )}
                        {episode.duration && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-steel" />
                            <span className="text-xs text-steel">{episode.duration}</span>
                          </div>
                        )}
                      </div>

                      {/* Play indicator */}
                      {isCurrentEpisode && (
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-neon-blue live-indicator" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
