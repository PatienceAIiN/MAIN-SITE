import React, { createContext, useContext, useMemo, useState } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

const AudioContext = createContext({ play: () => {}, current: null });

export const useGlobalAudio = () => useContext(AudioContext);

export const GlobalAudioProvider = ({ children }) => {
  const [current, setCurrent] = useState(null);

  const value = useMemo(
    () => ({
      current,
      play: (track) => setCurrent(track),
      close: () => setCurrent(null)
    }),
    [current]
  );

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
            <button
              type="button"
              onClick={() => setCurrent(null)}
              aria-label="Close player"
              className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a] hover:border-[#1a1a1a]"
            >
              Close
            </button>
          </div>
          <AudioPlayer
            src={current.src}
            autoPlay
            showJumpControls
            showFilledProgress
            showSkipControls={false}
            customAdditionalControls={[]}
            layout="horizontal-reverse"
            style={{ borderRadius: '0 0 16px 16px', boxShadow: 'none' }}
          />
        </div>
      ) : null}
    </AudioContext.Provider>
  );
};

export default GlobalAudioProvider;
