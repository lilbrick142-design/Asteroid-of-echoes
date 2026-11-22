import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface CompletionOverlayProps {
  onContinue: () => void;
}

export const CompletionOverlay: React.FC<CompletionOverlayProps> = ({ onContinue }) => {
  return (
    <div className="absolute inset-0 z-20 pointer-events-auto flex flex-col items-center justify-end p-6 md:p-12 animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400" />

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 border border-cyan-400/50 mb-4 text-cyan-300">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="text-xs font-medium tracking-wider text-cyan-300 mb-1">
          Level 1 Complete
        </div>

        <h2 className="font-display text-3xl font-semibold text-slate-100 mb-3">
          Asteroid of Echoes
        </h2>

        <div className="space-y-1.5 text-slate-200 text-sm md:text-base mb-6">
          <p className="text-cyan-300 font-medium">"Perfect."</p>
          <p>"All seven musical memories have been recovered."</p>
          <p className="text-slate-400 text-sm">"A route to the next asteroid has been detected."</p>
        </div>

        <button
          onClick={onContinue}
          id="continue-mission-button"
          className="inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-full shadow-lg transition-colors"
        >
          <span>Continue</span>
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
