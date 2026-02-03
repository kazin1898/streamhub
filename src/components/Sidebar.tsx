'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Plus,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { useStore, useActivePlaylist } from '@/store/useStore';
import { useState } from 'react';
import ChannelList from './ChannelList';

export default function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setImportModalOpen = useStore((s) => s.setImportModalOpen);
  const setEpgOpen = useStore((s) => s.setEpgOpen);
  const playlists = useStore((s) => s.playlists);
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const setActivePlaylist = useStore((s) => s.setActivePlaylist);
  const removePlaylist = useStore((s) => s.removePlaylist);
  const history = useStore((s) => s.history);
  const setCurrentChannel = useStore((s) => s.setCurrentChannel);

  const activePlaylist = useActivePlaylist();

  const [showHistory, setShowHistory] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState<string | null>(null);
  const [playlistToUpdate, setPlaylistToUpdate] = useState<string | null>(null);

  return (
    <>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{
              type: 'tween',
              duration: 0.25,
              ease: [0.25, 0.1, 0.25, 1] // cubic-bezier for smooth feel
            }}
            className="w-80 h-full glass flex flex-col border-r border-white/5"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center neon-glow-subtle">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1
                      className="text-lg font-bold text-light neon-text"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      StreamHub
                    </h1>
                    <p className="text-xs text-mist">IPTV Player</p>
                  </div>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-mist" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add Playlist
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2.5 rounded-xl transition-colors ${
                    showHistory ? 'bg-neon-purple/30 text-neon-purple' : 'bg-shadow text-mist hover:text-light'
                  }`}
                  title="History"
                >
                  <History className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setEpgOpen(true)}
                  className="p-2.5 rounded-xl bg-shadow text-mist hover:text-light transition-colors"
                  title="EPG Guide"
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Playlists selector */}
            {playlists.length > 0 && !showHistory && (
              <div className="p-4 border-b border-white/5">
                <label className="block text-xs text-mist mb-2 uppercase tracking-wider">
                  Active Playlist
                </label>
                <div className="space-y-1">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={`relative group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors ${
                        activePlaylistId === playlist.id
                          ? 'bg-neon-purple/20 border border-neon-purple/40'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => setActivePlaylist(playlist.id)}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          playlist.type === 'xtream'
                            ? 'bg-neon-cyan/20 text-neon-cyan'
                            : 'bg-neon-blue/20 text-neon-blue'
                        }`}
                      >
                        {playlist.type === 'xtream' ? '⚡' : '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-light truncate">{playlist.name}</p>
                        <p className="text-xs text-mist">
                          {playlist.channels.length} channels
                        </p>
                      </div>

                      {/* Menu button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylistMenuOpen(playlistMenuOpen === playlist.id ? null : playlist.id);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4 text-mist" />
                      </button>

                      {/* Dropdown menu */}
                      <AnimatePresence>
                        {playlistMenuOpen === playlist.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.12, ease: 'easeOut' }}
                            className="absolute right-0 top-full mt-1 z-20 glass rounded-xl p-2 min-w-[160px]"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlaylistToUpdate(playlist.id);
                                setPlaylistMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neon-blue hover:bg-neon-blue/20 text-sm transition-colors mb-1"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Update
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removePlaylist(playlist.id);
                                setPlaylistMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/20 text-sm transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History view */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-light" style={{ fontFamily: 'var(--font-display)' }}>
                    Watch History
                  </h3>
                  {history.length > 0 && (
                    <button
                      onClick={() => useStore.getState().clearHistory()}
                      className="text-xs text-mist hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-10 h-10 mx-auto text-steel mb-2" />
                    <p className="text-mist text-sm">No history yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <button
                        key={item.channelId + item.timestamp}
                        onClick={() => {
                          const playlist = playlists.find((p) => p.id === item.playlistId);
                          const channel = playlist?.channels.find((c) => c.id === item.channelId);
                          if (channel) {
                            setActivePlaylist(item.playlistId);
                            setCurrentChannel(channel);
                            setShowHistory(false);
                          }
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-shadow flex items-center justify-center flex-shrink-0">
                          {item.logo ? (
                            <img src={item.logo} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span>📺</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-light truncate">{item.channelName}</p>
                          <p className="text-xs text-mist">
                            {formatTimeAgo(item.timestamp)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Channel list */
              <ChannelList />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Toggle button when closed */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{
              type: 'tween',
              duration: 0.2,
              ease: 'easeOut',
              delay: 0.1 // Small delay to let sidebar finish closing
            }}
            onClick={() => setSidebarOpen(true)}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-40 p-3 glass rounded-xl hover:bg-white/10 transition-colors neon-glow-subtle"
          >
            <ChevronRight className="w-5 h-5 text-neon-purple" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Update Playlist Confirmation Modal */}
      <AnimatePresence>
        {playlistToUpdate && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setPlaylistToUpdate(null)}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/20 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-neon-blue" />
                </div>
                <div>
                  <h3
                    className="text-lg font-semibold text-light"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Update Playlist?
                  </h3>
                  <p className="text-xs text-mist">
                    {playlists.find(p => p.id === playlistToUpdate)?.name}
                  </p>
                </div>
              </div>

              <p className="text-sm text-mist mb-6">
                This will re-import the playlist from the source. Your favorites will be preserved, but new channels/episodes will be added.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setPlaylistToUpdate(null)}
                  className="flex-1 py-2.5 rounded-xl bg-shadow text-light font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const playlist = playlists.find(p => p.id === playlistToUpdate);
                    if (!playlist) return;

                    // Import playlist using the store's updatePlaylist function
                    if (playlist.type === 'm3u' && playlist.url) {
                      // Trigger M3U import - will reuse existing ImportModal logic
                      useStore.getState().setImportModalOpen(true);
                      // Pass the playlist ID to signal it's an update
                      useStore.getState().setPlaylistToUpdate(playlist.id);
                    } else if (playlist.type === 'xtream') {
                      useStore.getState().setImportModalOpen(true);
                      useStore.getState().setPlaylistToUpdate(playlist.id);
                    }

                    setPlaylistToUpdate(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
