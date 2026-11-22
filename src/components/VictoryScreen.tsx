import React, { useEffect, useState } from 'react';
import { SongItem } from '../types';
import { SONGS_DATA, TOTAL_SONGS_COUNT } from '../data/songs';
import {
  Sparkles,
  Music,
  Play,
  Square,
  RotateCcw,
  Compass,
  Award,
  ArrowRight,
  Disc,
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface VictoryScreenProps {
  onReplayLevel1: () => void;
  onLaunchExperienceFromSummary: (song: SongItem) => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  onReplayLevel1,
  onLaunchExperienceFromSummary,
}) => {
  const [selectedSong, setSelectedSong] = useState<SongItem>(SONGS_DATA[0]);
  const [playingSongId, setPlayingSongId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      audioEngine.stopExperienceAudio(0.15);
    };
  }, []);

  const handlePlaySong = (song: SongItem) => {
    setSelectedSong(song);
    setPlayingSongId(song.id);
    audioEngine.playSongPreview(song, () => setPlayingSongId(null));
  };

  const handleStopSong = () => {
    audioEngine.stopExperienceAudio(0.25);
    setPlayingSongId(null);
  };

  const isSelectedPlaying = playingSongId === selectedSong.id;

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/95 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-start animate-fade-in text-slate-100">
      <div className="max-w-4xl w-full my-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-cyan-300 text-xs font-medium tracking-wider">
            <Award className="w-4 h-4 text-amber-300" />
            <span>Mission Complete · Level 1</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-slate-100">
            Asteroid of Echoes Recovered
          </h1>

          <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            All {TOTAL_SONGS_COUNT} drifting musical memories have been cataloged inside Astronomer Vanshikha's collection container. The stone route toward the Moon is open.
          </p>
        </div>

        {/* Music & 3D Memory Jukebox Deck */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-cyan-300">
              <Music className="w-5 h-5" />
              <h3 className="font-semibold text-slate-100 text-sm md:text-base">
                Recovered Musical Worlds ({TOTAL_SONGS_COUNT} / {TOTAL_SONGS_COUNT})
              </h3>
            </div>
            <span className="text-xs text-slate-400">Select any song to listen or revisit its 3D world</span>
          </div>

          {selectedSong && (
            <div className="bg-slate-950/85 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: selectedSong.color }}
                >
                  <Disc className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-cyan-300 font-medium">
                    {selectedSong.experienceTitle}
                  </div>
                  <h4 className="font-display text-xl font-semibold text-slate-100 truncate">
                    {selectedSong.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedSong.artist} · {selectedSong.experienceSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSelectedPlaying ? (
                  <button
                    onClick={handleStopSong}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Audio</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlaySong(selectedSong)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Listen</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    handleStopSong();
                    onLaunchExperienceFromSummary(selectedSong);
                  }}
                  className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Enter 3D World</span>
                </button>
              </div>
            </div>
          )}

          {/* 7-Song Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {SONGS_DATA.map((song) => {
              const isSelected = selectedSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between min-h-[6.5rem] ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      0{song.id}
                    </span>
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: song.color }}
                    />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{song.artist}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Phase & Replay Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                <Compass className="w-4 h-4" />
                <span>Next Station Phase</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-100">
                Level 2: The Crystal Citadel
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The floating stone bridge leads into deep space toward the lunar crystal core.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-cyan-300 text-xs font-medium">
              <span>Bridge Route Established</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Revisit Asteroid 1</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-100">
                Explore Level 1 Again
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reset all seven album fragments on the asteroid surface and experience each musical world anew.
              </p>
            </div>

            <button
              onClick={() => {
                handleStopSong();
                onReplayLevel1();
              }}
              className="mt-4 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-cyan-300" />
              <span>Replay Level 1</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
