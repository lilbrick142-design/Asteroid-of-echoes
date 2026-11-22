import React from 'react';
import { SongItem } from '../types';
import { SONGS_DATA } from '../data/songs';
import { Play, Music, Lock, X, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface AlbumJukeboxModalProps {
  collectedIds: number[];
  onClose: () => void;
  onPlayPreview: (song: SongItem) => void;
}

export const AlbumJukeboxModal: React.FC<AlbumJukeboxModalProps> = ({
  collectedIds,
  onClose,
  onPlayPreview,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Drifting Musical Fragments
              </h3>
              <p className="text-xs text-slate-400">
                Collected {collectedIds.length} of {SONGS_DATA.length} fragments across Asteroid 1
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Album Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {SONGS_DATA.map((song) => {
            const isCollected = collectedIds.includes(song.id);

            return (
              <div
                key={song.id}
                className={`relative rounded-2xl p-4 border transition-all duration-300 flex flex-col justify-between ${
                  isCollected
                    ? 'bg-slate-800/80 border-cyan-500/40 shadow-lg shadow-cyan-950/30 hover:border-cyan-400'
                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                {/* Artwork box */}
                <div
                  className="w-full aspect-square rounded-xl flex flex-col items-center justify-center relative overflow-hidden mb-3 border border-slate-700/50 shadow-inner"
                  style={{
                    background: isCollected
                      ? `linear-gradient(135deg, ${song.color}, ${song.secondaryColor})`
                      : '#1e293b',
                  }}
                >
                  {isCollected ? (
                    <>
                      <Music className="w-10 h-10 text-white/90 drop-shadow-md mb-2" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm">
                        {song.genre}
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <Lock className="w-8 h-8 mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">
                        Unrecovered
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-100 truncate">
                    {song.id}. {song.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mb-1">
                    {song.artist}
                  </p>
                  <p className="text-[11px] text-slate-400/80 line-clamp-2 leading-relaxed">
                    {song.description}
                  </p>
                </div>

                {/* Action button */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] uppercase text-cyan-400 font-semibold flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>5–10s Preview</span>
                  </span>

                  {isCollected ? (
                    <button
                      onClick={() => {
                        audioEngine.playSongPreview(song);
                        onPlayPreview(song);
                      }}
                      className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-full flex items-center space-x-1 shadow transition-all"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-600 font-medium">Locked</span>
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
