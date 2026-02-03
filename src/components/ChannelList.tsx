'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Grid3X3, List, Search, ChevronDown, X, Tv, Film, Clapperboard, Loader2 } from 'lucide-react';
import {
  useStore,
  useActivePlaylist,
  type Channel,
  type ContentType,
} from '@/store/useStore';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useChannelsFromDB } from '@/hooks/useChannelsFromDB';
import { useGroupsFromDB } from '@/hooks/useGroupsFromDB';
import { useContentCountsFromDB } from '@/hooks/useContentCountsFromDB';

const contentTabs: { id: ContentType | 'all'; label: string; shortLabel: string; icon: typeof Tv }[] = [
  { id: 'live', label: 'Live TV', shortLabel: 'Live', icon: Tv },
  { id: 'movie', label: 'Movies', shortLabel: 'Movies', icon: Film },
  { id: 'series', label: 'Series', shortLabel: 'Series', icon: Clapperboard },
];

// Format large numbers (1000 -> 1k, 15000 -> 15k, etc.)
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(count);
}

export default function ChannelList() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const selectedGroup = useStore((s) => s.selectedGroup);
  const setSelectedGroup = useStore((s) => s.setSelectedGroup);
  const contentFilter = useStore((s) => s.contentFilter);
  const setContentFilter = useStore((s) => s.setContentFilter);
  const setCurrentChannel = useStore((s) => s.setCurrentChannel);
  const currentChannel = useStore((s) => s.currentChannel);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const activePlaylist = useActivePlaylist();
  const groups = useGroupsFromDB();
  const contentCounts = useContentCountsFromDB();

  const { channels, loading, hasMore, loadMore } = useChannelsFromDB({ pageSize: 100 });

  const [groupsOpen, setGroupsOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleChannelClick = useCallback((channel: Channel) => {
    // If it's a series with a seriesId, open the series drawer instead of playing directly
    if (channel.contentType === 'series' && channel.seriesId) {
      const setSeriesDrawerOpen = useStore.getState().setSeriesDrawerOpen;
      setSeriesDrawerOpen(true, {
        seriesId: channel.seriesId,
        seriesName: channel.seriesName || channel.name,
      });
    } else {
      setCurrentChannel(channel);
    }
  }, [setCurrentChannel]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (activePlaylist) {
      toggleFavorite(activePlaylist.id, channel.id);
    }
  }, [activePlaylist, toggleFavorite]);

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (!hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = target;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when we're 85% through the content
    if (scrollPercentage > 0.85) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  // Reset scroll when filters change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, selectedGroup, contentFilter]);

  if (!activePlaylist) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-smoke flex items-center justify-center">
            <Grid3X3 className="w-8 h-8 text-mist" />
          </div>
          <p className="text-mist">No playlist loaded</p>
          <p className="text-sm text-steel mt-1">Import a playlist to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Content Type Tabs */}
      <div className="flex gap-1.5 p-1.5 mx-3 mt-3 bg-shadow rounded-xl">
        {contentTabs.map((tab) => {
          const count = tab.id === 'all' ? 0 : contentCounts[tab.id] || 0;
          const isActive = contentFilter === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setContentFilter(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-b from-neon-purple/40 to-neon-purple/20 text-white shadow-lg shadow-neon-purple/20'
                  : 'text-mist hover:text-light hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-neon-purple' : ''}`} />
              <div className="flex items-center gap-1">
                <span>{tab.shortLabel}</span>
                {count > 0 && (
                  <span className={`text-[10px] opacity-60`}>
                    {formatCount(count)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="p-4 space-y-3 border-b border-white/5">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-10 pr-10 py-2.5 bg-shadow rounded-xl text-light placeholder:text-steel text-sm focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-3 h-3 text-mist" />
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2">
          {/* Group filter dropdown */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setGroupsOpen(!groupsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-shadow rounded-lg text-sm text-light hover:bg-smoke transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {selectedGroup === 'favorites' ? (
                  <>
                    <Heart className="w-3.5 h-3.5 text-neon-pink fill-neon-pink flex-shrink-0" />
                    <span className="truncate">Favorites</span>
                  </>
                ) : selectedGroup ? (
                  <span className="truncate">{selectedGroup}</span>
                ) : (
                  <span className="text-mist truncate">Category</span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-mist flex-shrink-0 ml-1 transition-transform duration-200 ${groupsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {groupsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute z-20 top-full left-0 right-0 mt-1 glass rounded-xl p-1.5 max-h-72 overflow-y-auto"
                >
                  {/* Quick actions */}
                  <div className="flex gap-1 mb-1.5">
                    <button
                      onClick={() => {
                        setSelectedGroup(null);
                        setGroupsOpen(false);
                      }}
                      className={`flex-1 text-center px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        !selectedGroup
                          ? 'bg-neon-purple/30 text-neon-purple'
                          : 'bg-white/5 text-mist hover:text-light hover:bg-white/10'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGroup('favorites');
                        setGroupsOpen(false);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        selectedGroup === 'favorites'
                          ? 'bg-neon-pink/30 text-neon-pink'
                          : 'bg-white/5 text-mist hover:text-light hover:bg-white/10'
                      }`}
                    >
                      <Heart className="w-3 h-3" />
                      Favorites
                    </button>
                  </div>

                  {groups.length > 0 && (
                    <>
                      <div className="h-px bg-white/10 my-1.5" />
                      <div className="space-y-0.5">
                        {groups.map((group) => (
                          <button
                            key={group}
                            onClick={() => {
                              setSelectedGroup(group);
                              setGroupsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                              selectedGroup === group
                                ? 'bg-neon-purple/30 text-neon-purple'
                                : 'text-light hover:bg-white/10'
                            }`}
                          >
                            {group}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-shadow rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-neon-purple/30 text-neon-purple' : 'text-mist hover:text-light'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-neon-purple/30 text-neon-purple' : 'text-mist hover:text-light'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-mist">
            <span className="text-light font-medium">{formatCount(channels.length)}</span>
            {' '}{contentFilter === 'series' ? 'series' : contentFilter === 'movie' ? 'movies' : 'channels'}
            {searchQuery && (
              <span className="text-steel"> for "{searchQuery}"</span>
            )}
          </span>
          {loading && channels.length > 0 && (
            <span className="flex items-center gap-1.5 text-neon-purple">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading</span>
            </span>
          )}
        </div>
      </div>

      {/* Channel list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {channels.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-mist">No channels found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {channels.map((channel, index) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  ease: 'easeOut',
                  delay: Math.min(index * 0.02, 0.1) // Stagger effect, max 100ms delay
                }}
                onClick={() => handleChannelClick(channel)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleChannelClick(channel)}
                className={`channel-card relative p-3 rounded-xl text-left cursor-pointer ${
                  currentChannel?.id === channel.id
                    ? 'gradient-border'
                    : 'glass-light hover:border-neon-purple/30'
                }`}
              >
                {/* Favorite button */}
                <button
                  onClick={(e) => handleToggleFavorite(e, channel)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      channel.isFavorite ? 'fill-neon-pink text-neon-pink' : 'text-white/60'
                    }`}
                  />
                </button>

                {/* Logo */}
                <div className="aspect-video mb-2 rounded-lg overflow-hidden bg-shadow flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`text-2xl ${channel.logo ? 'hidden' : ''}`}>
                    📺
                  </div>
                </div>

                {/* Name */}
                <p className="text-sm font-medium text-light truncate">{channel.name}</p>
                {channel.group && (
                  <p className="text-xs text-mist truncate mt-0.5">{channel.group}</p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {channels.map((channel, index) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.15,
                  ease: 'easeOut',
                  delay: Math.min(index * 0.015, 0.08)
                }}
                onClick={() => handleChannelClick(channel)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleChannelClick(channel)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left cursor-pointer transition-all ${
                  currentChannel?.id === channel.id
                    ? 'bg-neon-purple/20 border border-neon-purple/40'
                    : 'hover:bg-white/5'
                }`}
              >
                {/* Logo */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-shadow flex-shrink-0 flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={`text-xl ${channel.logo ? 'hidden' : ''}`}>📺</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-light truncate">{channel.name}</p>
                  {channel.group && (
                    <p className="text-xs text-mist truncate">{channel.group}</p>
                  )}
                </div>

                {/* Favorite */}
                <button
                  onClick={(e) => handleToggleFavorite(e, channel)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      channel.isFavorite ? 'fill-neon-pink text-neon-pink' : 'text-mist'
                    }`}
                  />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Loading indicator at bottom */}
        {loading && channels.length > 0 && (
          <div className="py-6 flex justify-center">
            <div className="flex items-center gap-2 text-mist text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading more channels...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
