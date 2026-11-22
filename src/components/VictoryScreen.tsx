import React, { useState } from 'react';
import { SongItem } from '../types';
import { SONGS_DATA } from '../data/songs';
import { Sparkles, Music, Play, RotateCcw, Compass, Award, ArrowRight, Disc } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface VictoryScreenProps {
  onReplayLevel1: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ onReplayLevel1 }) => {
  const [selectedSong, setSelectedSong] = useState<SongItem>(SONGS_DATA[0]);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlaySong = (song: SongItem) => {
    setSelectedSong(song);
    audioEngine.playSongPreview(song, () => setIsPlaying(false));
    setIsPlaying(true);
  };

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-xl overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-start animate-fade-in text-slate-100">
      <div className="max-w-4xl w-full my-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-widest shadow-lg">
            <Award className="w-4 h-4 text-yellow-400" />
            <span>Mission Objective Complete • Level 1</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
            Asteroid of Echoes Recovered
          </h1>

          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            All 10 drifting musical fragments have been safely cataloged inside Astronomer Vanshikha's collection container. The stone route to the Moon is opening.
          </p>
        </div>

        {/* Music Jukebox Deck */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2 text-cyan-400">
              <Music className="w-5 h-5" />
              <h3 className="font-bold text-slate-100">
                Recovered Fragment Jukebox (10 / 10)
              </h3>
            </div>
            <span className="text-xs text-slate-400">Click any track to play 5–10s preview</span>
          </div>

          {/* Active Player Banner */}
          {selectedSong && (
            <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 font-bold"
                  style={{ backgroundColor: selectedSong.color }}
                >
                  <Disc className="w-8 h-8 animate-spin-slow" />
                </div>
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-cyan-400">
                    {selectedSong.genre}
                  </div>
                  <h4 className="text-lg font-bold text-slate-100">
                    {selectedSong.title}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {selectedSong.artist} ({selectedSong.year})
                  </p>
                </div>
              </div>

              <button
                onClick={() => handlePlaySong(selectedSong)}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-full flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isPlaying ? 'Replay Preview' : 'Play Preview'}</span>
              </button>
            </div>
          )}

          {/* Song list grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
            {SONGS_DATA.map((song) => {
              const isSelected = selectedSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  onClick={() => handlePlaySong(song)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 ring-2 ring-cyan-500/30'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">
                      #{song.id}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: song.color }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {song.artist}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teaser for Level 2 & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-yellow-400 text-xs font-bold uppercase tracking-wider">
                <Compass className="w-4 h-4" />
                <span>Next Station Phase</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">
                Level 2: The Crystal Citadel
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The floating stone bridge leads into deep space toward the glowing lunar crystal core. Prepare for the next phase of the Moon Operation!
              </p>
            </div>

            <div className="mt-4 flex items-center space-x-2 text-cyan-400 text-xs font-semibold">
              <span>Bridge Route Established</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-1 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Revisit Asteroid 1</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">
                Explore Level 1 Again
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Re-enter the peaceful, cozy Asteroid of Echoes and wander the starry surface freely.
              </p>
            </div>

            <button
              onClick={onReplayLevel1}
              className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-cyan-500/50 font-bold text-xs rounded-full flex items-center space-x-2 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>Replay Level 1</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
