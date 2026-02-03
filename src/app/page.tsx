'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, type LatencyMode } from '@/store/useStore';
import VideoPlayer from '@/components/VideoPlayer';
import Sidebar from '@/components/Sidebar';
import ImportModal from '@/components/ImportModal';
import EPGDrawer from '@/components/EPGDrawer';
import SeriesDrawer from '@/components/SeriesDrawer';
import MiniPlayer from '@/components/MiniPlayer';

const latencyModeInfo: Record<LatencyMode, { label: string; color: string }> = {
  low: { label: 'Low Latency', color: 'text-neon-green' },
  balanced: { label: 'Balanced', color: 'text-neon-cyan' },
  smooth: { label: 'Smooth', color: 'text-neon-purple' },
};

export default function Home() {
  const currentChannel = useStore((s) => s.currentChannel);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const latencyMode = useStore((s) => s.player.latencyMode);
  const seriesDrawerOpen = useStore((s) => s.seriesDrawerOpen);
  const seriesInfo = useStore((s) => s.seriesInfo);
  const setSeriesDrawerOpen = useStore((s) => s.setSeriesDrawerOpen);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);

  const modeInfo = latencyModeInfo[latencyMode] || latencyModeInfo.balanced;

  return (
    <main className="h-screen flex overflow-hidden">
      {/* Noise overlay for texture */}
      <div className="noise-overlay" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="h-16 flex items-center justify-between px-6 border-b border-white/5 glass"
        >
          <div className="flex items-center gap-4">
            {currentChannel ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-green live-indicator" />
                  <span className="text-xs text-neon-green font-semibold">LIVE</span>
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold text-light"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {currentChannel.name}
                  </h2>
                </div>
              </>
            ) : (
              <h2
                className="text-lg font-semibold text-light"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                StreamHub
              </h2>
            )}
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-xs ${modeInfo.color}`}>
              <div className={`w-2 h-2 rounded-full ${
                latencyMode === 'low' ? 'bg-neon-green' :
                latencyMode === 'balanced' ? 'bg-neon-cyan' :
                'bg-neon-purple'
              }`} />
              <span>{modeInfo.label} Mode</span>
            </div>
          </div>
        </motion.header>

        {/* Player area */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full h-full max-w-7xl"
          >
            <VideoPlayer
              channel={currentChannel}
              className="w-full h-full rounded-2xl neon-glow-subtle"
            />
          </motion.div>
        </div>

        {/* Bottom info bar */}
        {currentChannel && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="px-6 pb-6"
          >
            <div className="glass rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {currentChannel.logo && (
                  <img
                    src={currentChannel.logo}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div>
                  <p className="font-medium text-light">{currentChannel.name}</p>
                  <p className="text-sm text-mist">{currentChannel.group || 'Live TV'}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-mist text-xs">Format</p>
                  <p className="text-light font-mono">HLS</p>
                </div>
                <div className="text-center">
                  <p className="text-mist text-xs">Buffer</p>
                  <p className="text-neon-green font-mono">Optimal</p>
                </div>
                <div className="text-center">
                  <p className="text-mist text-xs">Mode</p>
                  <p className={`font-mono ${modeInfo.color}`}>{modeInfo.label}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals & Drawers */}
      <ImportModal />
      <EPGDrawer />
      <AnimatePresence>
        {seriesDrawerOpen && seriesInfo && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setSeriesDrawerOpen(false)}
            />
            {/* Series Drawer */}
            <SeriesDrawer
              seriesId={seriesInfo.seriesId}
              seriesName={seriesInfo.seriesName}
              onClose={() => setSeriesDrawerOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Mini player (when sidebar is closed and channel is playing) */}
      <MiniPlayer
        visible={miniPlayerVisible && !sidebarOpen && !!currentChannel}
        onExpand={() => setMiniPlayerVisible(false)}
      />
    </main>
  );
}
