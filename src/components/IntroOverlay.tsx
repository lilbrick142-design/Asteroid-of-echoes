import React, { useState } from 'react';
import { TypewriterText } from './TypewriterText';
import { Sparkles, Compass } from 'lucide-react';

interface IntroOverlayProps {
  onBeginMission: () => void;
}

const INTRO_LINES = [
  'Year: 2026.',
  'A strange signal has been detected from the Moon.',
  'Scientists searched for answers.',
  'But one final mission remains.',
  '...',
  'Oh hello, Astronomer Vanshikha.',
  'You must be here for the Moon Operation.',
  'Welcome, dear.',
  'The path to the Moon has been scattered among the stars.',
  'To reach it, you must recover the missing fragments.',
  'Each asteroid hides a piece of the journey.',
  'Recover them all.',
  'And the Moon may reveal its secret.',
];

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ onBeginMission }) => {
  const [showBeginButton, setShowBeginButton] = useState(false);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12">
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-700/60">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs tracking-wider text-cyan-300 font-medium">
            Moon Operation · 2026
          </span>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto mb-6 pointer-events-auto">
        <div className="relative bg-slate-900/92 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-rose-400" />

          <div className="flex items-center gap-2 mb-3 text-cyan-400">
            <Compass className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wider text-slate-300">
              Cosmic Signal Log
            </span>
          </div>

          <TypewriterText
            lines={INTRO_LINES}
            charSpeedMs={32}
            pauseBetweenLinesMs={1250}
            onAllComplete={() => setShowBeginButton(true)}
          />

          {showBeginButton && (
            <div className="mt-6 flex justify-center animate-fade-in">
              <button
                onClick={onBeginMission}
                id="begin-mission-button"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold text-slate-950 transition-colors bg-cyan-400 hover:bg-cyan-300 rounded-full shadow-lg"
              >
                <span>Begin Mission</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
