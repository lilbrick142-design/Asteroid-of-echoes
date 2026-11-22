import React, { useState, useEffect } from 'react';
import { Sparkles, Music } from 'lucide-react';

interface LevelBriefOverlayProps {
  onDismiss: () => void;
}

export const LevelBriefOverlay: React.FC<LevelBriefOverlayProps> = ({ onDismiss }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 1200);
    const timer2 = setTimeout(() => setStep(2), 2600);
    const timer3 = setTimeout(() => setStep(3), 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-20 pointer-events-auto bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-lg w-full bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 animate-pulse" />

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-500/50 mb-4 text-cyan-300">
          <Music className="w-6 h-6 animate-bounce" />
        </div>

        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-2">
          Mission Brief • Level 1: Asteroid of Echoes
        </div>

        <div className="space-y-3 min-h-[6rem] flex flex-col justify-center">
          <p className={`text-xl font-medium text-slate-100 transition-all duration-500 ${step >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            "Oh hello Astronomer Vanshikha."
          </p>

          <p className={`text-base text-slate-300 transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            "Before the Moon Operation can continue, we need to recover ten drifting musical fragments."
          </p>

          <p className={`text-lg font-semibold text-cyan-300 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            "Find all ten."
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={onDismiss}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-full shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all text-sm flex items-center space-x-2 mx-auto"
          >
            <span>START EXPLORING</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
