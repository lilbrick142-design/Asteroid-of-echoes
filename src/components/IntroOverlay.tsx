import React, { useState } from 'react';
import { TypewriterText } from './TypewriterText';
import { Sparkles, Compass } from 'lucide-react';

interface IntroOverlayProps {
  onBeginMission: () => void;
}

const INTRO_LINES = [
  "Year: 2026.",
  "A strange signal has been detected from the Moon.",
  "Scientists searched for answers.",
  "But one final mission remains.",
  "...",
  "Oh hello, Astronomer Vanshikha.",
  "You must be here for the Moon Operation.",
  "Welcome, dear.",
  "The path to the Moon has been scattered among the stars.",
  "To reach it, you must recover the missing fragments.",
  "Each asteroid hides a piece of the journey.",
  "Recover them all.",
  "And the Moon may reveal its secret."
];

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ onBeginMission }) => {
  const [showBeginButton, setShowBeginButton] = useState(false);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12">
      {/* Top Header branding */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto opacity-80">
        <div className="flex items-center space-x-3 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/50">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-widest text-cyan-300 font-semibold">
            Moon Operation • Year 2026
          </span>
        </div>
      </div>

      {/* Main Dialogue Box at Bottom Center */}
      <div className="w-full max-w-2xl mx-auto mb-6 pointer-events-auto">
        <div className="relative bg-slate-900/80 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl shadow-cyan-950/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500" />
          
          <div className="flex items-center space-x-2 mb-3 text-cyan-400">
            <Compass className="w-4 h-4" />
            <span className="text-xs uppercase font-medium tracking-wider text-slate-300">
              Cosmic Signal Log
            </span>
          </div>

          <TypewriterText
            lines={INTRO_LINES}
            charSpeedMs={35}
            pauseBetweenLinesMs={1400}
            onAllComplete={() => setShowBeginButton(true)}
          />

          {/* BEGIN MISSION Glowing Button */}
          {showBeginButton && (
            <div className="mt-6 flex justify-center animate-fade-in">
              <button
                onClick={onBeginMission}
                id="begin-mission-button"
                className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white transition-all duration-300 ease-out bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/60 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <span className="relative z-10 flex items-center space-x-2">
                  <span>BEGIN MISSION</span>
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300 text-yellow-300" />
                </span>
                <span className="absolute inset-0 rounded-full bg-cyan-400 blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
