import React, { useRef, useState } from 'react';
import { useGlobalAudio } from './GlobalAudioPlayer';

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const MediaPlayer = ({ type, title, src }) => {
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const globalAudio = useGlobalAudio();

  if (type === 'audio') {
    const isCurrent = globalAudio.current?.src === src;
    return (
      <div className="rounded-[20px] border border-[#e5e5e5] bg-[#f4f4f4] p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">Podcast</span>
          {isCurrent ? (
            <span className="rounded-full bg-[#1a1a1a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">Playing</span>
          ) : null}
        </div>
        <p className="mb-4 text-base font-medium text-[#1a1a1a]">{title}</p>
        <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-[14px] border border-[#d1d1d1] bg-gradient-to-br from-[#1a1a1a] to-[#3a3a3a]">
          <span className="text-5xl">🎧</span>
        </div>
        <button
          type="button"
          onClick={() => globalAudio.play({ title, src })}
          className="mt-4 w-full rounded-full bg-[#1a1a1a] px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-black"
        >
          {isCurrent ? 'Restart in Player' : 'Play in Site Player'}
        </button>
        <p className="mt-2 text-[11px] text-[#666666]">
          Plays in a dock at the bottom of the site — keeps going while you browse.
        </p>
      </div>
    );
  }

  if (type === 'youtube') {
    return (
      <div className="rounded-[20px] border border-[#e5e5e5] bg-[#f4f4f4] p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">Video</span>
        </div>
        <p className="mb-4 text-base font-medium text-[#1a1a1a]">{title}</p>
        <div className="overflow-hidden rounded-[14px] border border-[#d1d1d1] bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${src}?rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const skip = (delta) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + delta));
  };

  const onSeek = (event) => {
    const el = mediaRef.current;
    if (!el || !el.duration) return;
    const newTime = (Number(event.target.value) / 100) * el.duration;
    el.currentTime = newTime;
    setProgress(Number(event.target.value));
  };

  const onVolume = (event) => {
    const el = mediaRef.current;
    const v = Number(event.target.value);
    setVolume(v);
    if (el) el.volume = v;
  };

  const onTimeUpdate = () => {
    const el = mediaRef.current;
    if (!el || !el.duration) return;
    setProgress((el.currentTime / el.duration) * 100);
  };

  const onLoaded = () => {
    const el = mediaRef.current;
    if (el) setDuration(el.duration || 0);
  };

  const enterFullscreen = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (type === 'video' && el.requestFullscreen) {
      el.requestFullscreen();
    } else {
      setIsExpanded((v) => !v);
    }
  };

  const currentTimeText = formatTime(((progress / 100) * duration) || 0);
  const durationText = formatTime(duration);

  return (
    <div className={`rounded-[20px] border border-[#e5e5e5] bg-[#f4f4f4] p-5 ${isExpanded ? 'md:col-span-2' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
          {type === 'audio' ? 'Podcast' : 'Video'}
        </span>
        <button
          type="button"
          onClick={enterFullscreen}
          aria-label="Enlarge"
          className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
        >
          {type === 'video' ? 'Fullscreen' : isExpanded ? 'Shrink' : 'Enlarge'}
        </button>
      </div>
      <p className="mb-4 text-base font-medium text-[#1a1a1a]">{title}</p>

      <div className="overflow-hidden rounded-[14px] border border-[#d1d1d1] bg-black">
        {type === 'video' ? (
          <video
            ref={mediaRef}
            src={src}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoaded}
            onEnded={() => setIsPlaying(false)}
            className={`w-full ${isExpanded ? 'max-h-[70vh]' : 'aspect-video'} bg-black`}
            preload="metadata"
          />
        ) : (
          <div className="flex h-[120px] items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#3a3a3a]">
            <audio
              ref={mediaRef}
              src={src}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoaded}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />
            <span className="text-5xl">🎧</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => skip(-10)}
          aria-label="Back 10 seconds"
          className="rounded-full border border-[#d1d1d1] bg-white px-3 py-2 text-xs font-bold text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
        >
          ⏪ 10s
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="rounded-full bg-[#1a1a1a] px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-black"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => skip(10)}
          aria-label="Forward 10 seconds"
          className="rounded-full border border-[#d1d1d1] bg-white px-3 py-2 text-xs font-bold text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
        >
          10s ⏩
        </button>
        <span className="ml-2 text-xs font-medium text-[#666666] tabular-nums">
          {currentTimeText} / {durationText}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={onSeek}
        aria-label="Seek"
        className="mt-3 w-full accent-[#1a1a1a]"
      />

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-medium text-[#666666]">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={onVolume}
          aria-label="Volume"
          className="w-32 accent-[#1a1a1a]"
        />
      </div>
    </div>
  );
};

export default MediaPlayer;
