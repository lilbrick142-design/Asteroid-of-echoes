import React from 'react';
import { SongItem } from '../types';
import { SONGS_DATA } from '../data/songs';
import { Play, Music, Lock, X } from 'lucide-react';

interface AlbumJukeboxModalProps {
  collectedIds: number[];
  activeSongId: number | null;
  onClose: () => void;
  onExperienceSong: (song: SongItem) => void;
}

export const AlbumJukeboxModal: React.FC<AlbumJukeboxModalProps> = ({
  collectedIds,
  activeSongId,
  onClose,
  onExperienceSong,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 md:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-semibold text-slate-100">
                Recovered Musical Worlds
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                {collectedIds.length} of {SONGS_DATA.length} memories recovered
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close collection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Album Grid */}
        <div className="p-5 md:p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SONGS_DATA.map((song) => {
            const isCollected = collectedIds.includes(song.id);
            const isPlayingThis = activeSongId === song.id;

            return (
              <div
                key={song.id}
                className={`rounded-xl p-4 border transition-colors flex flex-col justify-between ${
                  isCollected
                    ? 'bg-slate-800/85 border-slate-700 hover:border-slate-500'
                    : 'bg-slate-900/50 border-slate-800/80 opacity-65'
                }`}
              >
                <div
                  className="w-full aspect-[4/3] rounded-lg flex flex-col items-center justify-center relative overflow-hidden mb-3 border border-slate-700/50"
                  style={{
                    background: isCollected
                      ? `linear-gradient(135deg, ${song.color}, ${song.secondaryColor})`
                      : '#141927',
                  }}
                >
                  {isCollected ? (
                    <div className="text-center px-3">
                      <Music className="w-8 h-8 text-white/90 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-white/95">{song.experienceTitle}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <Lock className="w-6 h-6 mb-1" />
                      <span className="text-[11px] font-medium">Unrecovered</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-100 truncate">
                    {song.id}. {song.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mb-1.5">{song.artist}</p>
                  <p className="text-xs text-slate-400/90 line-clamp-2 leading-relaxed">
                    {isCollected ? song.description : song.experienceSubtitle}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 truncate">
                    {song.experienceTitle}
                  </span>

                  {isCollected ? (
                    <button
                      onClick={() => {
                        onExperienceSong(song);
                        onClose();
                      }}
                      disabled={activeSongId !== null && !isPlayingThis}
                      className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isPlayingThis ? 'Active' : 'Enter World'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Locked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
