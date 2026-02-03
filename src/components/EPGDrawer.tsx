'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore, useActivePlaylist, type Channel } from '@/store/useStore';
import { useState, useMemo } from 'react';
import { useChannelsForEPG } from '@/hooks/useChannelsForEPG';

export default function EPGDrawer() {
  const isOpen = useStore((s) => s.epgOpen);
  const setIsOpen = useStore((s) => s.setEpgOpen);
  const epgData = useStore((s) => s.epgData);
  const currentChannel = useStore((s) => s.currentChannel);
  const setCurrentChannel = useStore((s) => s.setCurrentChannel);
  const activePlaylist = useActivePlaylist();
  const { channels: epgChannels } = useChannelsForEPG(20);

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Generate demo EPG data for display purposes
  const demoPrograms = useMemo(() => {
    if (!activePlaylist || epgChannels.length === 0) return [];

    const now = new Date();
    const programs: Array<{
      channelId: string;
      channelName: string;
      channelLogo?: string;
      schedule: Array<{
        start: Date;
        end: Date;
        title: string;
        isLive: boolean;
      }>;
    }> = [];

    // Use channels from IndexedDB
    const channels = epgChannels;

    const showTitles = [
      'Morning News', 'Sports Today', 'Movie: Action Hour', 'Documentary',
      'Talk Show', 'Cooking with Chef', 'Kids Zone', 'Music Hits',
      'Crime Drama', 'Comedy Hour', 'Nature World', 'Tech Review',
      'Travel Guide', 'Health & Fitness', 'Business News', 'Late Night Show'
    ];

    channels.forEach((channel) => {
      const schedule: typeof programs[0]['schedule'] = [];
      let currentTime = new Date(selectedDate);
      currentTime.setHours(0, 0, 0, 0);

      while (currentTime.getHours() < 24 || schedule.length < 12) {
        const duration = Math.floor(Math.random() * 60) + 30; // 30-90 min shows
        const start = new Date(currentTime);
        const end = new Date(currentTime.getTime() + duration * 60000);

        const isLive = now >= start && now < end;

        schedule.push({
          start,
          end,
          title: showTitles[Math.floor(Math.random() * showTitles.length)],
          isLive,
        });

        currentTime = end;
        if (schedule.length >= 12) break;
      }

      programs.push({
        channelId: channel.id,
        channelName: channel.name,
        channelLogo: channel.logo,
        schedule,
      });
    });

    return programs;
  }, [activePlaylist, selectedDate]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-4xl glass z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-neon-cyan" />
                </div>
                <div>
                  <h2
                    className="text-xl font-semibold text-light"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Program Guide
                  </h2>
                  <p className="text-sm text-mist">Electronic Program Guide (EPG)</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-mist" />
              </button>
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-mist" />
              </button>

              <div className="text-center">
                <p className="text-lg font-semibold text-light" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatDate(selectedDate)}
                </p>
                <p className="text-xs text-mist">
                  {selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <button
                onClick={() => navigateDate(1)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-mist" />
              </button>
            </div>

            {/* EPG Grid */}
            <div className="flex-1 overflow-hidden">
              {!activePlaylist || epgChannels.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Calendar className="w-16 h-16 mx-auto text-steel mb-4" />
                    <p className="text-light mb-2">No channels available</p>
                    <p className="text-sm text-mist">Import a playlist to view the program guide</p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-auto">
                  {/* Time header */}
                  <div className="sticky top-0 z-10 flex bg-abyss border-b border-white/5">
                    <div className="w-48 flex-shrink-0 p-3 bg-shadow" />
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="flex-shrink-0 w-32 p-3 text-xs text-mist border-l border-white/5 bg-abyss"
                      >
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Current time indicator */}
                  {selectedDate.toDateString() === now.toDateString() && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-neon-green z-20"
                      style={{
                        left: `calc(192px + ${currentHour * 128}px)`,
                        boxShadow: '0 0 10px var(--color-neon-green)',
                      }}
                    />
                  )}

                  {/* Channel rows */}
                  {demoPrograms.map((program) => (
                    <div
                      key={program.channelId}
                      className="flex border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {/* Channel info */}
                      <button
                        onClick={() => {
                          const channel = epgChannels.find(
                            (c) => c.id === program.channelId
                          );
                          if (channel) {
                            setCurrentChannel(channel);
                            setIsOpen(false);
                          }
                        }}
                        className="w-48 flex-shrink-0 flex items-center gap-3 p-3 bg-shadow/50 text-left hover:bg-neon-purple/20 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-shadow flex items-center justify-center flex-shrink-0">
                          {program.channelLogo ? (
                            <img
                              src={program.channelLogo}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          ) : (
                            <span>📺</span>
                          )}
                        </div>
                        <span className="text-sm text-light truncate">{program.channelName}</span>
                      </button>

                      {/* Schedule */}
                      <div className="flex relative">
                        {program.schedule.map((show, idx) => {
                          const startHour = show.start.getHours() + show.start.getMinutes() / 60;
                          const duration = (show.end.getTime() - show.start.getTime()) / (1000 * 60 * 60);
                          const width = duration * 128; // 128px per hour

                          return (
                            <div
                              key={idx}
                              className={`flex-shrink-0 p-2 border-l border-white/5 ${
                                show.isLive
                                  ? 'bg-neon-green/20 border-l-2 border-l-neon-green'
                                  : 'hover:bg-white/5'
                              }`}
                              style={{ width: `${width}px`, minWidth: '64px' }}
                            >
                              <div className="flex items-start gap-1">
                                {show.isLive && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-neon-green/30 text-neon-green rounded">
                                    LIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-light truncate mt-1" title={show.title}>
                                {show.title}
                              </p>
                              <p className="text-[10px] text-mist mt-0.5">
                                {show.start.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="p-4 border-t border-white/5 text-center">
              <p className="text-xs text-mist">
                EPG data is for demonstration purposes. Connect to an EPG source for real program data.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
