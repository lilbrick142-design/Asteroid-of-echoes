import React from 'react';
import { Sparkles, Compass, CheckCircle2 } from 'lucide-react';

interface CompletionOverlayProps {
  onContinue: () => void;
}

export const CompletionOverlay: React.FC<CompletionOverlayProps> = ({ onContinue }) => {
  return (
    <div className="absolute inset-0 z-20 pointer-events-auto flex flex-col items-center justify-end p-6 md:p-12 animate-fade-in">
      {/* Banner Box */}
      <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-xl border border-cyan-500/50 rounded-3xl p-8 shadow-2xl shadow-cyan-950/60 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 animate-pulse" />

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-950 border border-cyan-400 mb-4 text-cyan-300 shadow-lg shadow-cyan-500/30">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <div className="text-xs uppercase font-bold tracking-widest text-cyan-400 mb-1">
          Level 1 Complete
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-3">
          Asteroid of Echoes
        </h2>

        <div className="space-y-2 text-slate-200 text-base md:text-lg font-medium mb-6">
          <p className="text-cyan-300 font-semibold">"Perfect."</p>
          <p>"All musical fragments recovered."</p>
          <p className="text-slate-300 text-sm md:text-base">"A route to the next asteroid has been detected."</p>
        </div>

        {/* CONTINUE Glowing Button */}
        <button
          onClick={onContinue}
          id="continue-mission-button"
          className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-slate-950 transition-all duration-300 ease-out bg-gradient-to-r from-cyan-400 to-yellow-300 rounded-full shadow-lg shadow-cyan-500/40 hover:shadow-cyan-400/70 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          <span className="relative z-10 flex items-center space-x-2">
            <span>CONTINUE</span>
            <Sparkles className="w-5 h-5 text-slate-900 group-hover:rotate-45 transition-transform" />
          </span>
          <span className="absolute inset-0 rounded-full bg-cyan-300 blur-md opacity-50 group-hover:opacity-90 transition-opacity" />
        </button>
      </div>
    </div>
  );
};
