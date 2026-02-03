'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Link, Server, FileText, Loader2, CheckCircle, AlertCircle, Tv, Film, Clapperboard, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { parseM3U, fetchXtreamChannels } from '@/lib/m3uParser';
import { savePlaylist, resetDatabase } from '@/lib/db';

type ImportTab = 'm3u' | 'xtream' | 'file';
type ImportOption = 'all' | 'live' | 'live-movies' | 'live-series';

const importOptions: { id: ImportOption; label: string; desc: string }[] = [
  { id: 'live', label: 'Live TV Only', desc: 'Fastest, recommended for large lists' },
  { id: 'live-movies', label: 'Live TV + Movies', desc: 'No series' },
  { id: 'live-series', label: 'Live TV + Series', desc: 'No movies' },
  { id: 'all', label: 'Everything', desc: 'May be slow with large lists' },
];

export default function ImportModal() {
  const isOpen = useStore((s) => s.importModalOpen);
  const setIsOpen = useStore((s) => s.setImportModalOpen);
  const addPlaylist = useStore((s) => s.addPlaylist);
  const updatePlaylistChannels = useStore((s) => s.updatePlaylistChannels);
  const refreshPlaylists = useStore((s) => s.refreshPlaylists);
  const playlists = useStore((s) => s.playlists);
  const playlistToUpdate = useStore((s) => s.playlistToUpdate);
  const setPlaylistToUpdate = useStore((s) => s.setPlaylistToUpdate);

  // Check if we're in update mode
  const isUpdateMode = !!playlistToUpdate;
  const existingPlaylist = playlists.find(p => p.id === playlistToUpdate);

  const [activeTab, setActiveTab] = useState<ImportTab>('m3u');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showClearCacheOption, setShowClearCacheOption] = useState(false);
  const [importOption, setImportOption] = useState<ImportOption>('live');

  // Form states - initialize with existing playlist data if updating
  const [playlistName, setPlaylistName] = useState(existingPlaylist?.name || '');
  const [m3uUrl, setM3uUrl] = useState(existingPlaylist?.url || '');
  const [xtreamUrl, setXtreamUrl] = useState(existingPlaylist?.xtreamUrl || '');
  const [xtreamUser, setXtreamUser] = useState(existingPlaylist?.xtreamUser || '');
  const [xtreamPass, setXtreamPass] = useState(existingPlaylist?.xtreamPass || '');

  // Update form when playlistToUpdate changes
  useEffect(() => {
    if (playlistToUpdate && existingPlaylist) {
      setPlaylistName(existingPlaylist.name);
      if (existingPlaylist.type === 'm3u') {
        setActiveTab('m3u');
        setM3uUrl(existingPlaylist.url || '');
      } else if (existingPlaylist.type === 'xtream') {
        setActiveTab('xtream');
        setXtreamUrl(existingPlaylist.xtreamUrl || '');
        setXtreamUser(existingPlaylist.xtreamUser || '');
        setXtreamPass(existingPlaylist.xtreamPass || '');
      }
    }
  }, [playlistToUpdate, existingPlaylist]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setPlaylistName('');
    setM3uUrl('');
    setXtreamUrl('');
    setXtreamUser('');
    setXtreamPass('');
    setError(null);
    setSuccess(false);
    setLoading(false);
    setLoadingStatus('');
    setShowClearCacheOption(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setPlaylistToUpdate(null);
    resetForm();
  };

  const filterChannelsByOption = <T extends { contentType: string }>(channels: T[]): T[] => {
    switch (importOption) {
      case 'live':
        return channels.filter((c) => c.contentType === 'live');
      case 'live-movies':
        return channels.filter((c) => c.contentType === 'live' || c.contentType === 'movie');
      case 'live-series':
        return channels.filter((c) => c.contentType === 'live' || c.contentType === 'series');
      case 'all':
      default:
        return channels;
    }
  };

  const handleImportM3U = async () => {
    if (!m3uUrl) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStatus('Fetching playlist...');

    try {
      // Use API proxy to avoid CORS issues
      const response = await fetch('/api/proxy/m3u', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: m3uUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch playlist');
      }

      setLoadingStatus('Parsing channels...');
      const { content } = await response.json();
      const result = parseM3U(content);

      if (result.channels.length === 0) {
        throw new Error('No channels found in playlist');
      }

      // Filter channels based on import option
      const filteredChannels = filterChannelsByOption(result.channels);

      if (filteredChannels.length === 0) {
        throw new Error('No channels match the selected import option');
      }

      setLoadingStatus(`Saving ${filteredChannels.length} channels...`);

      if (isUpdateMode && existingPlaylist) {
        // UPDATE MODE: Preserve favorites
        const favoriteChannelIds = new Set(
          existingPlaylist.channels.filter(c => c.isFavorite).map(c => c.url)
        );

        // Mark new channels as favorites if they were favorited before
        const channelsWithFavorites = filteredChannels.map(channel => ({
          ...channel,
          isFavorite: favoriteChannelIds.has(channel.url),
        }));

        // Update the playlist (replace existing channels)
        await savePlaylist({
          ...existingPlaylist,
          channels: channelsWithFavorites,
          lastUpdated: Date.now(),
        }, { replace: true });

        // Update store
        updatePlaylistChannels(existingPlaylist.id, channelsWithFavorites);

        setSuccess(true);
        setLoadingStatus(`Updated ${channelsWithFavorites.length} channels!`);
      } else {
        // CREATE MODE: New playlist
        const playlist = {
          id: crypto.randomUUID(),
          name: playlistName || 'My Playlist',
          type: 'm3u' as const,
          url: m3uUrl,
          channels: filteredChannels,
          lastUpdated: Date.now(),
        };

        // Save to IndexedDB
        await savePlaylist(playlist);

        // Update store (without channels, just metadata)
        addPlaylist({
          name: playlist.name,
          type: playlist.type,
          url: playlist.url,
          channels: [], // Don't store in memory
        });
      }

      // Refresh playlists from DB
      await refreshPlaylists?.();

      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to import playlist';
      setError(errorMsg);

      // Check if it's a quota exceeded error
      if (
        errorMsg.includes('quota') ||
        errorMsg.includes('QuotaExceededError') ||
        (e instanceof Error && e.name === 'QuotaExceededError')
      ) {
        setShowClearCacheOption(true);
      }
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleImportXtream = async () => {
    if (!xtreamUrl || !xtreamUser || !xtreamPass) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStatus('Connecting to server...');

    try {
      const channels = await fetchXtreamChannels(
        {
          url: xtreamUrl,
          username: xtreamUser,
          password: xtreamPass,
        },
        (status) => setLoadingStatus(status) // Progress callback
      );

      if (channels.length === 0) {
        throw new Error('No channels found');
      }

      // Filter channels based on import option
      setLoadingStatus('Filtering channels...');
      const filteredChannels = filterChannelsByOption(channels);

      if (filteredChannels.length === 0) {
        throw new Error('No channels match the selected import option');
      }

      setLoadingStatus(`Saving ${filteredChannels.length} channels...`);

      if (isUpdateMode && existingPlaylist) {
        // UPDATE MODE: Preserve favorites
        const favoriteChannelIds = new Set(
          existingPlaylist.channels.filter(c => c.isFavorite).map(c => c.url)
        );

        // Mark new channels as favorites if they were favorited before
        const channelsWithFavorites = filteredChannels.map(channel => ({
          ...channel,
          isFavorite: favoriteChannelIds.has(channel.url),
        }));

        // Update the playlist (replace existing channels)
        await savePlaylist({
          ...existingPlaylist,
          channels: channelsWithFavorites,
          lastUpdated: Date.now(),
        }, { replace: true });

        // Update store
        updatePlaylistChannels(existingPlaylist.id, channelsWithFavorites);

        setSuccess(true);
        setLoadingStatus(`Updated ${channelsWithFavorites.length} channels!`);
      } else {
        // CREATE MODE: New playlist
        const playlist = {
          id: crypto.randomUUID(),
          name: playlistName || 'Xtream Playlist',
          type: 'xtream' as const,
          xtreamUrl,
          xtreamUser,
          xtreamPass,
          channels: filteredChannels,
          lastUpdated: Date.now(),
        };

        // Save to IndexedDB
        await savePlaylist(playlist);

        // Update store (without channels, just metadata)
        addPlaylist({
          name: playlist.name,
          type: playlist.type,
          xtreamUrl: playlist.xtreamUrl,
          xtreamUser: playlist.xtreamUser,
          xtreamPass: playlist.xtreamPass,
          channels: [], // Don't store in memory
        });
      }

      // Refresh playlists from DB
      await refreshPlaylists?.();

      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      let errorMsg = 'Failed to connect to Xtream server';
      if (e instanceof Error) {
        errorMsg = e.message;
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          errorMsg = 'Cannot connect to server. Check if the URL is correct and the server is online.';
        }
      }
      setError(errorMsg);

      // Check if it's a quota exceeded error
      if (
        errorMsg.includes('quota') ||
        errorMsg.includes('QuotaExceededError') ||
        (e instanceof Error && e.name === 'QuotaExceededError')
      ) {
        setShowClearCacheOption(true);
      }
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setLoadingStatus('Reading file...');

    try {
      const content = await file.text();
      setLoadingStatus('Parsing channels...');
      const result = parseM3U(content);

      if (result.channels.length === 0) {
        throw new Error('No channels found in file');
      }

      // Filter channels based on import option
      const filteredChannels = filterChannelsByOption(result.channels);

      if (filteredChannels.length === 0) {
        throw new Error('No channels match the selected import option');
      }

      setLoadingStatus(`Saving ${filteredChannels.length} channels...`);

      const playlist = {
        id: crypto.randomUUID(),
        name: playlistName || file.name.replace(/\.[^/.]+$/, ''),
        type: 'm3u' as const,
        channels: filteredChannels,
        lastUpdated: Date.now(),
      };

      // Save to IndexedDB
      await savePlaylist(playlist);

      // Refresh playlists from DB
      await refreshPlaylists?.();

      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setLoading(false);
      setLoadingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const tabs = [
    { id: 'm3u' as const, label: 'M3U URL', icon: Link },
    { id: 'xtream' as const, label: 'Xtream Codes', icon: Server },
    { id: 'file' as const, label: 'Local File', icon: FileText },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto"
          >
            <div className="glass rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div>
                  <h2
                    className="text-xl font-semibold text-light"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {isUpdateMode ? 'Update Playlist' : 'Import Playlist'}
                  </h2>
                  <p className="text-sm text-mist mt-1">
                    {isUpdateMode
                      ? 'Update your playlist - favorites will be preserved'
                      : 'Add a new IPTV playlist to your library'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-mist" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-2 mx-4 mt-4 bg-shadow rounded-xl">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-neon-purple/30 text-neon-purple'
                        : 'text-mist hover:text-light'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Playlist name (common) */}
                <div>
                  <label className="block text-sm text-mist mb-2">Playlist Name (optional)</label>
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="My Playlist"
                    className="w-full px-4 py-3 bg-shadow rounded-xl text-light placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
                  />
                </div>

                {/* M3U URL tab */}
                {activeTab === 'm3u' && (
                  <div>
                    <label className="block text-sm text-mist mb-2">M3U/M3U8 URL</label>
                    <input
                      type="url"
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      placeholder="https://example.com/playlist.m3u"
                      className="w-full px-4 py-3 bg-shadow rounded-xl text-light placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all font-mono text-sm"
                    />
                  </div>
                )}

                {/* Xtream tab */}
                {activeTab === 'xtream' && (
                  <>
                    <div>
                      <label className="block text-sm text-mist mb-2">Server URL</label>
                      <input
                        type="url"
                        value={xtreamUrl}
                        onChange={(e) => setXtreamUrl(e.target.value)}
                        placeholder="http://server.com:port"
                        className="w-full px-4 py-3 bg-shadow rounded-xl text-light placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all font-mono text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-mist mb-2">Username</label>
                        <input
                          type="text"
                          value={xtreamUser}
                          onChange={(e) => setXtreamUser(e.target.value)}
                          placeholder="username"
                          className="w-full px-4 py-3 bg-shadow rounded-xl text-light placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-mist mb-2">Password</label>
                        <input
                          type="password"
                          value={xtreamPass}
                          onChange={(e) => setXtreamPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 bg-shadow rounded-xl text-light placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* File upload tab */}
                {activeTab === 'file' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".m3u,.m3u8,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="w-full p-8 border-2 border-dashed border-steel/50 rounded-xl hover:border-neon-purple/50 transition-colors group disabled:opacity-50"
                    >
                      <Upload className="w-10 h-10 mx-auto text-mist group-hover:text-neon-purple transition-colors" />
                      <p className="text-light mt-3">Click to upload or drag and drop</p>
                      <p className="text-sm text-mist mt-1">M3U, M3U8, or TXT files</p>
                    </button>
                  </div>
                )}

                {/* Import options */}
                <div>
                  <label className="block text-sm text-mist mb-2">What to import</label>
                  <div className="grid grid-cols-2 gap-2">
                    {importOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setImportOption(option.id)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          importOption === option.id
                            ? 'bg-neon-purple/20 border border-neon-purple/40'
                            : 'bg-shadow hover:bg-smoke'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {option.id === 'live' && <Tv className="w-4 h-4 text-neon-green" />}
                          {option.id === 'live-movies' && <Film className="w-4 h-4 text-neon-blue" />}
                          {option.id === 'live-series' && <Clapperboard className="w-4 h-4 text-neon-cyan" />}
                          {option.id === 'all' && <span className="text-sm">📦</span>}
                          <span className="text-sm font-medium text-light">{option.label}</span>
                        </div>
                        <p className="text-xs text-mist mt-1">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loading status */}
                {loading && loadingStatus && (
                  <div className="flex items-center gap-2 p-3 bg-neon-purple/10 border border-neon-purple/30 rounded-xl">
                    <Loader2 className="w-5 h-5 text-neon-purple animate-spin flex-shrink-0" />
                    <span className="text-sm text-neon-purple">{loadingStatus}</span>
                  </div>
                )}

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">{error}</span>
                      </div>

                      {/* Clear cache option for quota errors */}
                      {showClearCacheOption && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-300 font-medium">Storage is full</p>
                            <p className="text-xs text-yellow-300/70">Clear all data to fix this issue</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm('Are you sure? This will delete all playlists and channels.')) {
                                try {
                                  await resetDatabase();
                                  // Reload page to reinitialize
                                  window.location.reload();
                                } catch (e) {
                                  console.error('Failed to reset database:', e);
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-yellow-500/30 hover:bg-yellow-500/40 text-yellow-300 rounded-lg text-sm font-medium transition-colors"
                          >
                            Clear All Data
                          </button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success message */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 p-3 bg-neon-green/20 border border-neon-green/30 rounded-xl"
                    >
                      <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                      <span className="text-sm text-neon-green">Playlist imported successfully!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {activeTab !== 'file' && (
                <div className="p-6 pt-0">
                  <button
                    onClick={activeTab === 'm3u' ? handleImportM3U : handleImportXtream}
                    disabled={loading || success}
                    className="w-full py-3.5 rounded-xl font-semibold text-light bg-gradient-to-r from-neon-purple to-neon-blue hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Importing...
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Done!
                      </>
                    ) : isUpdateMode ? (
                      'Update Playlist'
                    ) : (
                      'Import Playlist'
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
