'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Pause, Play } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface MiniPlayerProps {
  visible: boolean;
  onExpand: () => void;
}

export default function MiniPlayer({ visible, onExpand }: MiniPlayerProps) {
  const currentChannel = useStore((s) => s.currentChannel);
  const player = useStore((s) => s.player);
  const setCurrentChannel = useStore((s) => s.setCurrentChannel);
  const updatePlayer = useStore((s) => s.updatePlayer);

  if (!currentChannel) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="glass rounded-2xl overflow-hidden shadow-2xl neon-glow-subtle w-80">
            {/* Mini video preview (placeholder) */}
            <div className="aspect-video bg-black relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-neon-purple/20 flex items-center justify-center">
                  {player.isPlaying ? (
                    <div className="flex gap-1">
                      <div className="w-1 h-8 bg-neon-purple rounded-full animate-pulse" />
                      <div className="w-1 h-8 bg-neon-purple rounded-full animate-pulse delay-100" />
                      <div className="w-1 h-8 bg-neon-purple rounded-full animate-pulse delay-200" />
                    </div>
                  ) : (
                    <Pause className="w-8 h-8 text-neon-purple" />
                  )}
                </div>
              </div>

              {/* Live badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20">
                <div className="w-2 h-2 rounded-full bg-red-500 live-indicator" />
                <span className="text-[10px] text-red-400 font-semibold">LIVE</span>
              </div>

              {/* Expand button */}
              <button
                onClick={onExpand}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Info bar */}
            <div className="p-3 flex items-center gap-3">
              {currentChannel.logo && (
                <img
                  src={currentChannel.logo}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-light truncate">{currentChannel.name}</p>
                {currentChannel.group && (
                  <p className="text-xs text-mist truncate">{currentChannel.group}</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    // Toggle play state - would need ref to video
                    updatePlayer({ isPlaying: !player.isPlaying });
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {player.isPlaying ? (
                    <Pause className="w-4 h-4 text-light" />
                  ) : (
                    <Play className="w-4 h-4 text-light" />
                  )}
                </button>
                <button
                  onClick={() => setCurrentChannel(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-mist" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
