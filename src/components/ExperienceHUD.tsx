import React, { useState } from 'react';
import { ActiveExperienceState } from '../types';
import { Pause, Play, LogOut, ChevronDown, ChevronUp, Image as ImageIcon, X } from 'lucide-react';
import { songExperienceManager } from '../services/SongExperienceManager';

interface ExperienceHUDProps {
  experience: ActiveExperienceState;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ExperienceHUD: React.FC<ExperienceHUDProps> = ({ experience }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const song = experience.song;
  if (!song || experience.status === 'idle') return null;

  const isPaused = experience.status === 'paused';
  const isExiting = experience.status === 'exiting';
  const pct = Math.round(experience.progress * 100);
  const selectedMemory = experience.selectedMemory;
  const nearbyMemory = experience.nearbyMemory;

  return (
    <>
      {/* Nearby Memory Frame Interaction Prompt (Come Over and Love Me) */}
      {nearbyMemory && !selectedMemory && !isExiting && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-fade-in">
          <button
            onClick={() => songExperienceManager.setSelectedMemory(nearbyMemory)}
            className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-950/90 border border-amber-200/35 text-slate-100 text-xs font-medium shadow-xl hover:border-amber-200/70 transition-colors whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-200" />
            <span>{nearbyMemory.caption}</span>
            <span className="text-slate-400">·</span>
            <span className="text-amber-200">View Frame (E)</span>
          </button>
        </div>
      )}

      {/* Cinematic Memory Close-Up Overlay */}
      {selectedMemory && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-slate-950/72 flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="relative max-w-3xl w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-xl md:text-2xl font-semibold text-slate-100 truncate">
                  {selectedMemory.caption}
                </h3>
                {selectedMemory.date && (
                  <p className="text-xs text-slate-400 mt-0.5">{selectedMemory.date}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setImageLoadFailed(false);
                  songExperienceManager.setSelectedMemory(null);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Return to Gallery</span>
              </button>
            </div>

            {/* Aspect-ratio preserved photograph container */}
            <div className="w-full flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800 p-4 min-h-[260px] max-h-[65vh] overflow-hidden">
              {selectedMemory.src && !selectedMemory.isPlaceholder && !imageLoadFailed ? (
                <img
                  src={selectedMemory.src}
                  alt={selectedMemory.caption}
                  referrerPolicy="no-referrer"
                  onError={() => setImageLoadFailed(true)}
                  className="max-h-[58vh] max-w-full w-auto h-auto object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center px-6 py-10 max-w-md space-y-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-200/80">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="font-display text-xl text-slate-100">{selectedMemory.caption}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Placeholder frame. Add your photograph to{' '}
                    <span className="font-mono text-slate-300">public/images/memories/</span> and list it in{' '}
                    <span className="font-mono text-slate-300">manifest.json</span>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[min(780px,94vw)] flex flex-col items-center">
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="mb-1.5 px-3 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Player</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!isCollapsed && (
          <div className="w-full bg-slate-950/92 border border-slate-700/80 rounded-2xl px-4 py-3.5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Song & Experience Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-3 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: song.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-200 truncate">{song.experienceTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{song.artist}</span>
                  </div>
                  <h4 className="font-display text-lg font-semibold text-slate-100 leading-tight truncate">
                    {song.title}
                  </h4>
                </div>
              </div>

              {/* Playback & Return Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => songExperienceManager.togglePause()}
                  disabled={isExiting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => songExperienceManager.exitExperience()}
                  disabled={isExiting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-white disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Return to Asteroid</span>
                </button>
              </div>
            </div>

            {/* Interactive Progress Bar + Time */}
            <div className="mt-3 flex items-center gap-3">
              <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {formatTime(experience.elapsedSec)}
              </span>
              <div
                role="slider"
                aria-label="Song progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(experience.durationSec)}
                aria-valuenow={Math.round(experience.elapsedSec)}
                tabIndex={0}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  songExperienceManager.seekExperience(ratio * experience.durationSec);
                }}
                className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
              >
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: song.color,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {formatTime(experience.durationSec)}
              </span>
            </div>

            {experience.audioError && (
              <p className="mt-1.5 text-[11px] text-amber-300">
                {experience.audioError}
              </p>
            )}

            {experience.usingFallbackAudio && !experience.audioError && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Playing ambient musical score · Add <span className="font-mono text-slate-300">{song.audioPath}</span> for original audio
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
