import React, { useState, useEffect } from 'react';
import { Sparkles, Music } from 'lucide-react';
import { TOTAL_SONGS_COUNT } from '../data/songs';

interface LevelBriefOverlayProps {
  onDismiss: () => void;
}

export const LevelBriefOverlay: React.FC<LevelBriefOverlayProps> = ({ onDismiss }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 1100);
    const timer2 = setTimeout(() => setStep(2), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto bg-slate-950/65 flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-lg w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400" />

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 border border-slate-700 mb-4 text-cyan-300">
          <Music className="w-5 h-5" />
        </div>

        <div className="text-xs font-medium tracking-wider text-cyan-300 mb-3">
          Level 1 · Asteroid of Echoes
        </div>

        <div className="space-y-3 min-h-[6rem] flex flex-col justify-center">
          <p
            className={`font-display text-2xl font-medium text-slate-100 transition-all duration-500 ${
              step >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            "Oh hello, Astronomer Vanshikha."
          </p>

          <p
            className={`text-sm text-slate-300 transition-all duration-500 leading-relaxed ${
              step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            "Before the Moon Operation can continue, we need to recover {TOTAL_SONGS_COUNT} drifting musical memories hidden across this asteroid."
          </p>

          <p
            className={`text-base font-semibold text-cyan-300 transition-all duration-500 ${
              step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            "Find all seven."
          </p>
        </div>

        <div className="mt-7">
          <button
            onClick={onDismiss}
            className="px-6 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-full shadow-lg transition-colors text-sm inline-flex items-center gap-2 mx-auto"
          >
            <span>Start Exploring</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
