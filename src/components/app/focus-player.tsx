'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { calculateWordTimings } from '@/lib/word-timing';
import { formatTime } from '@/lib/format-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Quote } from 'lucide-react';
import type { TranscriptionSegment } from '@/lib/transcriber/types';

interface FocusPlayerProps {
  segments: TranscriptionSegment[];
  speakerColors: Record<string, string>;
}

export function FocusPlayer({ segments, speakerColors }: FocusPlayerProps) {
  const { currentTime, activeSegmentIndex, isPlaying } = useAppStore();
  const currentSegmentRef = useRef<HTMLDivElement | null>(null);

  // Fallback to first segment if activeSegmentIndex is -1 but audio is loaded
  const displayIndex = activeSegmentIndex === -1 ? 0 : activeSegmentIndex;
  const segment = segments[displayIndex];

  // Calculate word timings for current segment
  const wordTimings = useMemo(() => {
    if (!segment) return [];
    return calculateWordTimings(segment.text, segment.startTime, segment.endTime);
  }, [segment]);

  // Click handler to seek to a specific word
  const handleWordClick = (startTime: number) => {
    if (typeof (window as any).__autoScribeSeek === 'function') {
      (window as any).__autoScribeSeek(startTime);
    }
  };

  if (!segment) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed p-6">
        <Headphones className="w-10 h-10 mb-3 text-muted-foreground/50 animate-pulse" />
        <p className="text-sm font-medium">Select audio to begin playback</p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden bg-card/40 border border-emerald-500/10 shadow-lg backdrop-blur-md rounded-2xl min-h-[320px] flex items-center justify-center p-6 sm:p-10 transition-all duration-500">
      
      {/* Immersive pulsing background mesh that responds to isPlaying */}
      <div className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-none opacity-40 dark:opacity-30">
        <motion.div 
          animate={isPlaying ? {
            scale: [1, 1.15, 0.95, 1.05, 1],
            rotate: [0, 90, 180, 270, 360],
          } : { scale: 1, rotate: 0 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[50%] -left-[30%] w-[100%] h-[100%] bg-gradient-to-br from-emerald-400/25 via-emerald-500/5 to-transparent rounded-full blur-3xl"
        />
        <motion.div 
          animate={isPlaying ? {
            scale: [1, 0.9, 1.1, 0.95, 1],
            rotate: [360, 270, 180, 90, 0],
          } : { scale: 1, rotate: 0 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-[50%] -right-[30%] w-[100%] h-[100%] bg-gradient-to-br from-teal-400/20 via-sky-500/5 to-transparent rounded-full blur-3xl"
        />
      </div>

      {/* Quote Icon watermark */}
      <div className="absolute top-6 left-6 text-emerald-500/5 dark:text-emerald-400/5 z-0 pointer-events-none select-none">
        <Quote className="w-28 h-28 stroke-[3]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-6">
        
        {/* Active speaker with beautiful slide-down animation on change */}
        <div className="h-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={segment.speaker}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2"
            >
              <Badge className={`${speakerColors[segment.speaker] || 'bg-muted'} border-0 px-3 py-1 font-semibold text-xs shadow-sm shadow-emerald-500/5 rounded-full tracking-wide`}>
                🎙️ {segment.speaker}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded-full">
                ⏱️ {formatTime(segment.startTime)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Large Cinematic Subtitle view with slide-up fade segment transitions */}
        <div className="w-full flex items-center justify-center min-h-[140px]" ref={currentSegmentRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={displayIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="w-full text-center"
            >
              {wordTimings.length > 0 ? (
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-relaxed max-w-3xl mx-auto px-4 select-none">
                  {wordTimings.map((wordTiming, wordIdx) => {
                    const isCurrentWord = currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime;
                    const isWordPast = currentTime > wordTiming.endTime;
                    
                    return (
                      <span
                        key={wordIdx}
                        onClick={() => handleWordClick(wordTiming.startTime)}
                        className={`inline-block mx-1.5 my-1.5 cursor-pointer rounded-lg px-2 py-0.5 transition-all duration-150 relative ${
                          isCurrentWord
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-500/25 shadow-md shadow-emerald-500/10 font-black scale-105 backdrop-blur-sm'
                            : isWordPast
                            ? 'text-foreground font-semibold opacity-90'
                            : 'text-muted-foreground/45 dark:text-muted-foreground/35 font-normal'
                        }`}
                        title="Click to seek here"
                      >
                        {wordTiming.word}
                        {isCurrentWord && (
                          <motion.span 
                            layoutId="activeWordGlow"
                            className="absolute inset-0 bg-emerald-500/5 rounded-lg -z-10 blur-sm"
                            transition={{ duration: 0.15 }}
                          />
                        )}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold leading-relaxed max-w-3xl mx-auto px-4 text-muted-foreground/80 italic">
                  {segment.text}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Small subtitle context indicator */}
        <div className="text-[10px] text-muted-foreground/50 tracking-wider font-medium select-none pointer-events-none uppercase">
          Click any word to seek playback
        </div>

      </div>
    </Card>
  );
}
