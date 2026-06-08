import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

const AudioContext = createContext({ play: () => {}, current: null });

export const useGlobalAudio = () => useContext(AudioContext);

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

export const GlobalAudioProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);
  const [speed, setSpeed] = useState(1);
  const playerRef = useRef(null);

  const value = useMemo(
    () => ({
      current,
      play: (track) => setCurrent(track),
      close: () => setCurrent(null)
    }),
    [current]
  );

  useEffect(() => {
    const audio = playerRef.current?.audio?.current;
    if (audio) audio.playbackRate = speed;
  }, [speed, current]);

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      {current ? (
        <div className="fixed bottom-4 left-1/2 z-[300] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#e5e5e5] bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-4 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">Now Playing</p>
              <p className="truncate text-sm font-medium text-[#1a1a1a]">{current.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleSpeed}
                aria-label={`Playback speed ${speed}x`}
                title="Change playback speed"
                className="min-w-[44px] rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-[11px] font-bold tracking-[0.05em] text-[#1a1a1a] hover:border-[#1a1a1a]"
              >
                {speed}x
              </button>
              <button
                type="button"
                onClick={() => setCurrent(null)}
                aria-label="Close player"
                className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a] hover:border-[#1a1a1a]"
              >
                Close
              </button>
            </div>
          </div>
          <AudioPlayer
            ref={playerRef}
            src={current.src}
            autoPlay
            showJumpControls
            showFilledProgress
            showSkipControls={false}
            customAdditionalControls={[]}
            layout="horizontal-reverse"
            onPlay={() => {
              const audio = playerRef.current?.audio?.current;
              if (audio) audio.playbackRate = speed;
            }}
            style={{ borderRadius: '0 0 16px 16px', boxShadow: 'none' }}
          />
        </div>
      ) : null}
    </AudioContext.Provider>
  );
};

export default GlobalAudioProvider;
