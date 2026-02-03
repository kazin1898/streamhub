'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Settings,
  Radio,
  Loader2,
  AlertCircle,
  Gauge,
  Subtitles,
} from 'lucide-react';
import { useStore, type Channel, type ContentType, type LatencyMode } from '@/store/useStore';

interface VideoPlayerProps {
  channel: Channel | null;
  className?: string;
}

export default function VideoPlayer({ channel, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showLatencyMenu, setShowLatencyMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentLatency, setCurrentLatency] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const player = useStore((s) => s.player);
  const updatePlayer = useStore((s) => s.updatePlayer);

  // Check if content is VOD (movie or series)
  const isVOD = channel?.contentType === 'movie' || channel?.contentType === 'series';

  // HLS Configuration based on latency mode
  const getHlsConfig = (mode: LatencyMode): Partial<Hls['config']> => {
    const baseConfig: Partial<Hls['config']> = {
      enableWorker: true,
      startLevel: -1,
      capLevelToPlayerSize: true,
      startFragPrefetch: true,
      abrEwmaDefaultEstimate: 500000,
      abrMaxWithRealBitrate: true,
    };

    switch (mode) {
      case 'low':
        // LOW LATENCY: 6-15s delay, may stutter on bad connection
        return {
          ...baseConfig,
          lowLatencyMode: true,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 2,
          maxBufferLength: 4,
          maxMaxBufferLength: 6,
          maxBufferHole: 0.1,
          backBufferLength: 2,
          maxLiveSyncPlaybackRate: 1.1,
          fragLoadingTimeOut: 8000,
          manifestLoadingTimeOut: 8000,
          levelLoadingTimeOut: 8000,
          abrBandWidthFactor: 0.8,
          abrBandWidthUpFactor: 0.5,
        };

      case 'balanced':
        // BALANCED: 15-25s delay, good balance
        return {
          ...baseConfig,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: 15,
          maxMaxBufferLength: 20,
          maxBufferHole: 0.3,
          backBufferLength: 10,
          maxLiveSyncPlaybackRate: 1.05,
          fragLoadingTimeOut: 10000,
          manifestLoadingTimeOut: 10000,
          levelLoadingTimeOut: 10000,
          abrBandWidthFactor: 0.9,
          abrBandWidthUpFactor: 0.6,
        };

      case 'smooth':
        // SMOOTH: 25-40s delay, no stuttering
        return {
          ...baseConfig,
          lowLatencyMode: false,
          liveSyncDurationCount: 5,
          liveMaxLatencyDurationCount: 8,
          maxBufferLength: 30,
          maxMaxBufferLength: 40,
          maxBufferHole: 0.5,
          backBufferLength: 30,
          maxLiveSyncPlaybackRate: 1.0,
          fragLoadingTimeOut: 15000,
          manifestLoadingTimeOut: 15000,
          levelLoadingTimeOut: 15000,
          abrBandWidthFactor: 0.95,
          abrBandWidthUpFactor: 0.7,
        };
    }
  };

  // Initialize HLS
  useEffect(() => {
    if (!channel?.url || !videoRef.current) return;

    setError(null);
    updatePlayer({ buffering: true });

    const video = videoRef.current;

    // Safety timeout - if buffering takes too long and video is actually playing
    const bufferCheckInterval = setInterval(() => {
      if (video && !video.paused && video.readyState >= 3 && video.currentTime > 0) {
        updatePlayer({ buffering: false });
      }
    }, 500);

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if URL is HLS
    const isHls = channel.url.includes('.m3u8') || channel.url.includes('m3u8');

    if (isHls && Hls.isSupported()) {
      const hlsConfig = getHlsConfig(player.latencyMode);
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const qualities = data.levels.map((level) => ({
          height: level.height || 0,
          width: level.width || 0,
          bitrate: level.bitrate || 0,
        }));
        updatePlayer({ availableQualities: qualities, buffering: false });
        video.play().catch(() => {});
      });

      // Update quality info when level is loaded (more accurate data)
      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        const level = hls.levels[data.level];
        if (level) {
          const currentQualities = [...(hls.levels || [])].map((l) => ({
            height: l.height || 0,
            width: l.width || 0,
            bitrate: l.bitrate || 0,
          }));
          if (currentQualities.some(q => q.height > 0 || q.bitrate > 0)) {
            updatePlayer({ availableQualities: currentQualities });
          }
        }
      });

      // Track latency and auto-sync if too high
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (hls.latency !== undefined && hls.latency !== null) {
          const latencyMs = Math.round(hls.latency * 1000);
          setCurrentLatency(latencyMs);
          updatePlayer({ latency: latencyMs });

          // Auto-sync if latency exceeds 15 seconds
          if (hls.latency > 15 && hls.liveSyncPosition) {
            console.log(`[HLS] High latency detected (${hls.latency.toFixed(1)}s), syncing to live...`);
            video.currentTime = hls.liveSyncPosition;
          }
        }
      });

      // Reset buffering when fragment starts playing
      hls.on(Hls.Events.FRAG_CHANGED, () => {
        updatePlayer({ buffering: false });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        updatePlayer({ currentQuality: data.level });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error - trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error - trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error - unable to play stream');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = channel.url;
      video.play().catch(() => {});
    } else {
      // Try direct playback
      video.src = channel.url;
      video.play().catch(() => {
        setError('Unable to play this stream format');
      });
    }

    return () => {
      clearInterval(bufferCheckInterval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel?.url, player.latencyMode]);

  // Sync play state periodically (fix for icon not updating)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Immediate sync
    setIsVideoPlaying(!video.paused);

    const syncInterval = setInterval(() => {
      if (video) {
        const playing = !video.paused;
        setIsVideoPlaying(playing);
      }
    }, 100); // More frequent checks

    return () => clearInterval(syncInterval);
  }, [channel?.url]); // Re-run when channel changes

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Sync initial state
    setIsVideoPlaying(!video.paused);

    const handlePlay = () => {
      setIsVideoPlaying(true);
      updatePlayer({ isPlaying: true });
    };
    const handlePause = () => {
      setIsVideoPlaying(false);
      updatePlayer({ isPlaying: false });
    };
    const handleWaiting = () => updatePlayer({ buffering: true });
    const handlePlaying = () => {
      setIsVideoPlaying(true);
      updatePlayer({ buffering: false, isPlaying: true });
    };
    const handleCanPlay = () => updatePlayer({ buffering: false });
    const handleLoadedData = () => updatePlayer({ buffering: false });
    const handleLoadedMetadata = () => {
      if (isVOD) {
        setDuration(video.duration || 0);
      }
    };
    const handleTimeUpdate = () => {
      // Sync play state with actual video state
      const playing = !video.paused;
      setIsVideoPlaying(playing);

      // Update current time and duration for VOD
      if (isVOD) {
        setCurrentTime(video.currentTime);
        if (video.duration && !isNaN(video.duration)) {
          setDuration(video.duration);
        }
      }

      // If time is updating, video is definitely playing - not buffering
      if (playing && video.readyState >= 3) {
        updatePlayer({ buffering: false, isPlaying: true });
      }
    };
    const handleVolumeChange = () => {
      updatePlayer({ volume: video.volume, isMuted: video.muted });
    };
    const handleStalled = () => updatePlayer({ buffering: true });

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('stalled', handleStalled);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('stalled', handleStalled);
    };
  }, [updatePlayer, isVOD]);

  // Apply volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = player.volume;
      videoRef.current.muted = player.isMuted;
    }
  }, [player.volume, player.isMuted]);

  // Controls visibility
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isVideoPlaying) setShowControls(false);
    }, 3000);
  }, [isVideoPlaying]);

  // Player controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (video) {
      // Use actual video state, not store state
      if (video.paused) {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
    }
  };

  const toggleMute = () => {
    updatePlayer({ isMuted: !player.isMuted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    updatePlayer({ volume: value, isMuted: value === 0 });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      updatePlayer({ isFullscreen: false });
    } else {
      await containerRef.current.requestFullscreen();
      updatePlayer({ isFullscreen: true });
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        updatePlayer({ isPiP: false });
      } else {
        await videoRef.current.requestPictureInPicture();
        updatePlayer({ isPiP: true });
      }
    } catch (e) {
      console.error('PiP error:', e);
    }
  };

  const setQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      updatePlayer({ currentQuality: level });
    }
    setShowQualityMenu(false);
  };

  // Format quality label - use height if available, otherwise bitrate
  const formatQuality = (q: { height: number; bitrate: number }, index?: number) => {
    if (q.height > 0) {
      return `${q.height}p`;
    }
    if (q.bitrate > 0) {
      // Convert to Mbps or Kbps
      if (q.bitrate >= 1000000) {
        return `${(q.bitrate / 1000000).toFixed(1)} Mbps`;
      }
      return `${Math.round(q.bitrate / 1000)} Kbps`;
    }
    // Fallback to numbered quality
    return index !== undefined ? `Quality ${index + 1}` : 'Default';
  };

  const getCurrentQualityLabel = () => {
    if (player.currentQuality === -1) return 'Auto';
    const q = player.availableQualities?.[player.currentQuality];
    if (!q) return 'Auto';
    return formatQuality(q, player.currentQuality);
  };

  // Latency mode labels
  const latencyModes: { id: LatencyMode; label: string; desc: string }[] = [
    { id: 'low', label: 'Low Latency', desc: '6-15s delay' },
    { id: 'balanced', label: 'Balanced', desc: '15-25s delay' },
    { id: 'smooth', label: 'Smooth', desc: '25-40s, no stutter' },
  ];

  const currentModeLabel = latencyModes.find(m => m.id === player.latencyMode)?.label || 'Balanced';

  // Sync to live - jump to the most recent point
  const syncToLive = () => {
    const video = videoRef.current;
    const hls = hlsRef.current;

    if (video && hls) {
      console.log('[HLS] Manual sync to live triggered');

      // Method 1: Use HLS.js liveSyncPosition (preferred)
      if (hls.liveSyncPosition && hls.liveSyncPosition > 0) {
        console.log(`[HLS] Syncing to liveSyncPosition: ${hls.liveSyncPosition.toFixed(2)}s`);
        video.currentTime = hls.liveSyncPosition;
      }
      // Method 2: Jump to end of buffer minus small margin
      else if (video.buffered.length > 0) {
        const liveEdge = video.buffered.end(video.buffered.length - 1) - 1;
        console.log(`[HLS] Syncing to buffer edge: ${liveEdge.toFixed(2)}s`);
        video.currentTime = liveEdge;
      }

      // Force play and update latency display
      video.play().catch(console.error);

      // Update latency after a short delay
      setTimeout(() => {
        if (hls.latency !== undefined) {
          const newLatency = Math.round(hls.latency * 1000);
          setCurrentLatency(newLatency);
          updatePlayer({ latency: newLatency });
        }
      }, 500);
    }
  };

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle seek on timeline
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video && isVOD) {
      const newTime = parseFloat(e.target.value);
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Skip forward/backward
  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (video && isVOD) {
      video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    }
  };

  if (!channel) {
    return (
      <div className={`video-container flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 flex items-center justify-center">
            <Radio className="w-12 h-12 text-neon-purple" />
          </div>
          <h3 className="text-xl font-semibold text-light mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Select a Channel
          </h3>
          <p className="text-mist">Choose a channel from the sidebar to start watching</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`video-container relative group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isVideoPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        playsInline
        onClick={togglePlay}
      />

      {/* Buffering indicator */}
      <AnimatePresence>
        {player.buffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50"
          >
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-neon-purple animate-spin mx-auto mb-2" />
              <span className="text-sm text-mist">Loading...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/70"
          >
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <span className="text-sm text-light">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-end"
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {channel.logo && (
                  <img
                    src={channel.logo}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div>
                  <h3 className="text-light font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    {channel.name}
                  </h3>
                  {channel.group && (
                    <span className="text-xs text-mist">{channel.group}</span>
                  )}
                </div>
              </div>

              {/* Live indicator & Latency */}
              <div className="flex items-center gap-2">
                {currentLatency > 0 && (
                  <button
                    onClick={syncToLive}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 hover:bg-neon-cyan/30 transition-colors group"
                    title="Click to sync to live"
                  >
                    <span className="text-xs text-mist group-hover:text-neon-cyan font-mono transition-colors">
                      {currentLatency > 1000
                        ? `${(currentLatency / 1000).toFixed(1)}s`
                        : `${currentLatency}ms`}
                    </span>
                    <span className="text-[10px] text-mist group-hover:text-neon-cyan uppercase tracking-wider transition-colors">
                      delay
                    </span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500 live-indicator" />
                  <span className="text-xs text-red-400 font-semibold">LIVE</span>
                </div>
              </div>
            </div>

            {/* Bottom controls */}
            <div className="relative p-4 space-y-3">
              {/* Timeline for VOD */}
              {isVOD && duration > 0 && isFinite(duration) && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-mist font-mono w-12 text-right">
                    {formatTime(currentTime)}
                  </span>

                  <div className="flex-1 relative group/timeline">
                    {/* Timeline background */}
                    <div className="h-1.5 bg-steel rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-neon-purple to-neon-blue transition-all duration-100"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>

                    {/* Seekable input */}
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {/* Hover preview */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/timeline:opacity-100 transition-opacity pointer-events-none">
                      <div className="px-2 py-1 rounded bg-black/80 text-xs text-light font-mono whitespace-nowrap">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-mist font-mono w-12">
                    -{formatTime(duration - currentTime)}
                  </span>

                  {/* Skip buttons */}
                  <button
                    onClick={() => skip(-10)}
                    className="px-2 py-1 rounded text-xs text-mist hover:text-light hover:bg-white/10 transition-colors font-mono"
                    title="Back 10s"
                  >
                    -10s
                  </button>
                  <button
                    onClick={() => skip(10)}
                    className="px-2 py-1 rounded text-xs text-mist hover:text-light hover:bg-white/10 transition-colors font-mono"
                    title="Forward 10s"
                  >
                    +10s
                  </button>
                </div>
              )}

              {/* Control buttons */}
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-neon-purple/20 hover:bg-neon-purple/40 flex items-center justify-center transition-colors"
                >
                  {isVideoPlaying ? (
                    <Pause className="w-6 h-6 text-light" />
                  ) : (
                    <Play className="w-6 h-6 text-light ml-1" />
                  )}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 group/volume">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {player.isMuted || player.volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-light" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-light" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={player.isMuted ? 0 : player.volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover/volume:w-24 transition-all duration-300 opacity-0 group-hover/volume:opacity-100"
                  />
                </div>

                <div className="flex-1" />

                {/* Quality selector */}
                {player.availableQualities && player.availableQualities.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowQualityMenu(!showQualityMenu);
                        setShowLatencyMenu(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-light" />
                      <span className="text-sm text-light">
                        {getCurrentQualityLabel()}
                      </span>
                    </button>

                    <AnimatePresence>
                      {showQualityMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 glass rounded-xl p-2 min-w-[160px]"
                        >
                          <button
                            onClick={() => setQuality(-1)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              player.currentQuality === -1
                                ? 'bg-neon-purple/30 text-neon-purple'
                                : 'text-light hover:bg-white/10'
                            }`}
                          >
                            Auto
                          </button>
                          {player.availableQualities.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => setQuality(idx)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                player.currentQuality === idx
                                  ? 'bg-neon-purple/30 text-neon-purple'
                                  : 'text-light hover:bg-white/10'
                              }`}
                            >
                              {formatQuality(q, idx)}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Subtitle selector - only for VOD */}
                {isVOD && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSubtitleMenu(!showSubtitleMenu);
                        setShowQualityMenu(false);
                        setShowLatencyMenu(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Subtitles"
                    >
                      <Subtitles className="w-4 h-4 text-light" />
                      <span className="text-sm text-light hidden sm:inline">
                        CC
                      </span>
                    </button>

                    <AnimatePresence>
                      {showSubtitleMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 glass rounded-xl p-2 min-w-[200px]"
                        >
                          <div className="text-xs text-mist px-3 py-2 border-b border-white/10 mb-2">
                            Subtitles
                          </div>
                          <button
                            onClick={() => {
                              const video = videoRef.current;
                              if (video) {
                                for (let i = 0; i < video.textTracks.length; i++) {
                                  video.textTracks[i].mode = 'hidden';
                                }
                              }
                              setShowSubtitleMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors text-light hover:bg-white/10"
                          >
                            Off
                          </button>
                          <button
                            onClick={() => {
                              const video = videoRef.current;
                              if (video && video.textTracks.length > 0) {
                                video.textTracks[0].mode = 'showing';
                              }
                              setShowSubtitleMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors text-light hover:bg-white/10"
                          >
                            Auto (if available)
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Latency Mode selector - only for live content */}
                {!isVOD && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowLatencyMenu(!showLatencyMenu);
                        setShowQualityMenu(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Latency Mode"
                    >
                      <Gauge className="w-4 h-4 text-light" />
                      <span className="text-sm text-light hidden sm:inline">
                        {currentModeLabel}
                      </span>
                    </button>

                    <AnimatePresence>
                      {showLatencyMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 glass rounded-xl p-2 min-w-[180px]"
                        >
                          {latencyModes.map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => {
                                updatePlayer({ latencyMode: mode.id });
                                setShowLatencyMenu(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                player.latencyMode === mode.id
                                  ? 'bg-neon-cyan/30 text-neon-cyan'
                                  : 'text-light hover:bg-white/10'
                              }`}
                            >
                              <div className="text-sm font-medium">{mode.label}</div>
                              <div className="text-xs text-mist">{mode.desc}</div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* PiP */}
                <button
                  onClick={togglePiP}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Picture in Picture"
                >
                  <PictureInPicture2 className="w-5 h-5 text-light" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {player.isFullscreen ? (
                    <Minimize className="w-5 h-5 text-light" />
                  ) : (
                    <Maximize className="w-5 h-5 text-light" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
