import React, { useEffect, useState } from 'react';
import { ActiveExperienceState, PlayerControls, VisualQualityLevel } from '../types';
import { Volume2, VolumeX, Disc, Move, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { qualitySettings } from '../services/qualitySettings';

interface HUDProps {
  collectedCount: number;
  totalCount: number;
  activeExperience: ActiveExperienceState;
  onOpenJukebox: () => void;
  playerControls: PlayerControls;
  setPlayerControls: React.Dispatch<React.SetStateAction<PlayerControls>>;
}

const QUALITY_ORDER: VisualQualityLevel[] = ['high', 'balanced', 'performance'];
const QUALITY_LABELS: Record<VisualQualityLevel, string> = {
  high: 'High',
  balanced: 'Balanced',
  performance: 'Perf',
};

export const HUD: React.FC<HUDProps> = ({
  collectedCount,
  totalCount,
  activeExperience,
  onOpenJukebox,
  setPlayerControls,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(true);
  const [qualityLevel, setQualityLevel] = useState<VisualQualityLevel>(qualitySettings.getLevel());

  useEffect(() => {
    return qualitySettings.subscribe((preset) => {
      setQualityLevel(preset.level);
    });
  }, []);

  const handleToggleSound = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleCycleQuality = () => {
    const idx = QUALITY_ORDER.indexOf(qualityLevel);
    const next = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
    qualitySettings.setQuality(next);
  };

  const isInExperience = activeExperience.status !== 'idle' && activeExperience.song !== null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none">
      {/* Top Bar */}
      <div className="flex items-start justify-between w-full gap-4">
        <div className="bg-slate-950/88 border border-slate-700/75 rounded-xl px-4 py-3 shadow-xl pointer-events-auto max-w-xs">
          <div className="flex items-center justify-between gap-4 text-xs text-slate-400 mb-1">
            <span className="font-medium text-slate-200">Asteroid of Echoes</span>
            <span className="font-mono tabular-nums text-cyan-300">
              {collectedCount} / {totalCount}
            </span>
          </div>

          <div className="w-48 sm:w-56 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${(collectedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleCycleQuality}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/88 hover:bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-xs font-medium transition-colors shadow-lg whitespace-nowrap shrink-0"
            title="Switch visual quality preset"
            aria-label={`Visual quality: ${QUALITY_LABELS[qualityLevel]}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 hidden sm:inline">Quality:</span>
            <span className="text-slate-100">{QUALITY_LABELS[qualityLevel]}</span>
          </button>

          <button
            onClick={onOpenJukebox}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/88 hover:bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 text-xs font-medium transition-colors shadow-lg whitespace-nowrap shrink-0"
          >
            <Disc className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Album Collection</span>
          </button>

          <button
            onClick={handleToggleSound}
            className="p-2.5 bg-slate-950/88 hover:bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 transition-colors shadow-lg"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      </div>

      {/* Subtle Controls Hint (hidden while inside a song experience to keep viewport pristine) */}
      {showControlsGuide && !isInExperience && (
        <div className="self-center bg-slate-950/88 border border-slate-700/75 rounded-lg px-4 py-2 text-xs text-slate-300 flex items-center gap-2.5 pointer-events-auto shadow-lg">
          <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Use WASD / Arrow Keys or click the asteroid surface to explore</span>
          <button
            onClick={() => setShowControlsGuide(false)}
            className="text-slate-400 hover:text-white ml-1 text-sm font-semibold px-1"
            aria-label="Dismiss movement hint"
          >
            ×
          </button>
        </div>
      )}

      {/* Touch Virtual D-Pad for Mobile / Touch screens */}
      <div className="flex items-end justify-start w-full">
        <div className="pointer-events-auto grid grid-cols-3 gap-1 w-32 h-32 md:hidden bg-slate-950/80 p-2 rounded-2xl border border-slate-800">
          <div />
          <button
            onPointerDown={() => setPlayerControls((prev) => ({ ...prev, forward: true }))}
            onPointerUp={() => setPlayerControls((prev) => ({ ...prev, forward: false }))}
            onPointerLeave={() => setPlayerControls((prev) => ({ ...prev, forward: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ↑
          </button>
          <div />
          <button
            onPointerDown={() => setPlayerControls((prev) => ({ ...prev, left: true }))}
            onPointerUp={() => setPlayerControls((prev) => ({ ...prev, left: false }))}
            onPointerLeave={() => setPlayerControls((prev) => ({ ...prev, left: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ←
          </button>
          <button
            onPointerDown={() => setPlayerControls((prev) => ({ ...prev, backward: true }))}
            onPointerUp={() => setPlayerControls((prev) => ({ ...prev, backward: false }))}
            onPointerLeave={() => setPlayerControls((prev) => ({ ...prev, backward: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            ↓
          </button>
          <button
            onPointerDown={() => setPlayerControls((prev) => ({ ...prev, right: true }))}
            onPointerUp={() => setPlayerControls((prev) => ({ ...prev, right: false }))}
            onPointerLeave={() => setPlayerControls((prev) => ({ ...prev, right: false }))}
            className="bg-slate-800 active:bg-cyan-600 text-white rounded-lg flex items-center justify-center font-bold text-lg"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};
