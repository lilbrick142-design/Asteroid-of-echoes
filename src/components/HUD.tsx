import React, { useState } from 'react';
import { SongItem, PlayerControls } from '../types';
import { Music, Volume2, VolumeX, Compass, Sparkles, Disc, Move } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface HUDProps {
  collectedCount: number;
  totalCount: number;
  activePreviewSong: SongItem | null;
  onOpenJukebox: () => void;
  playerControls: PlayerControls;
  setPlayerControls: React.Dispatch<React.SetStateAction<PlayerControls>>;
}

export const HUD: React.FC<HUDProps> = ({
  collectedCount,
  totalCount,
  activePreviewSong,
  onOpenJukebox,
  setPlayerControls,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(true);

  const handleToggleSound = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none">
      {/* Top Header Row */}
      <div className="flex items-start justify-between w-full">
        {/* Level & Objective info */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-xl pointer-events-auto max-w-xs md:max-w-md">
          <div className="flex items-center space-x-2 text-cyan-400 mb-1">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Asteroid of Echoes
            </span>
          </div>

          <h2 className="text-sm font-medium text-slate-200 mb-2">
            Recover Drifting Musical Fragments
          </h2>

          {/* Collection Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="font-semibold text-cyan-300">Collected: {collectedCount} / {totalCount}</span>
              <span className="text-slate-400">{Math.round((collectedCount / totalCount) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full transition-all duration-500 rounded-full shadow-sm shadow-cyan-400"
                style={{ width: `${(collectedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Jukebox Modal Trigger */}
          <button
            onClick={onOpenJukebox}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs font-medium transition-all shadow-lg hover:border-cyan-500/50"
          >
            <Disc className="w-4 h-4 text-cyan-400 animate-spin-slow" />
            <span className="hidden sm:inline">Album Collection</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 transition-all shadow-lg hover:border-cyan-500/50"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      </div>

      {/* Center Controls Guide Banner */}
      {showControlsGuide && (
        <div className="self-center bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 rounded-full px-5 py-2 text-xs text-slate-300 flex items-center space-x-3 pointer-events-auto shadow-xl animate-bounce-slow">
          <Move className="w-4 h-4 text-cyan-400" />
          <span>Use <strong>WASD / Arrow Keys</strong> or <strong>Click Ground</strong> to explore</span>
          <button
            onClick={() => setShowControlsGuide(false)}
            className="text-slate-400 hover:text-white ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Bottom Row */}
      <div className="flex items-end justify-between w-full">
        {/* Touch Virtual D-Pad for Mobile / Touch screens */}
        <div className="pointer-events-auto grid grid-cols-3 gap-1 w-32 h-32 md:hidden bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
          <div />
          <button
            onPointerDown={() => setPlayerControls(prev => ({ ...prev, forward: true }))}
            onPointerUp={() => setPlayerControls(prev => ({ ...prev, forward: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ↑
          </button>
          <div />
          <button
            onPointerDown={() => setPlayerControls(prev => ({ ...prev, left: true }))}
            onPointerUp={() => setPlayerControls(prev => ({ ...prev, left: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ←
          </button>
          <button
            onPointerDown={() => setPlayerControls(prev => ({ ...prev, backward: true }))}
            onPointerUp={() => setPlayerControls(prev => ({ ...prev, backward: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ↓
          </button>
          <button
            onPointerDown={() => setPlayerControls(prev => ({ ...prev, right: true }))}
            onPointerUp={() => setPlayerControls(prev => ({ ...prev, right: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            →
          </button>
        </div>

        {/* Active Song Preview Card */}
        {activePreviewSong && (
          <div className="pointer-events-auto ml-auto bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center space-x-3.5 max-w-sm animate-fade-in">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden"
              style={{ backgroundColor: activePreviewSong.color }}
            >
              <Music className="w-6 h-6 text-white animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                <Sparkles className="w-3 h-3" />
                <span>Now Playing Fragment</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-100 truncate">
                {activePreviewSong.title}
              </h4>
              <p className="text-xs text-slate-400 truncate">
                {activePreviewSong.artist}
              </p>
            </div>

            {/* Equalizer animated bars */}
            <div className="flex items-end space-x-0.5 h-6">
              <div className="w-1 bg-cyan-400 rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
              <div className="w-1 bg-fuchsia-400 rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
              <div className="w-1 bg-yellow-400 rounded-full animate-bounce h-5/6" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
