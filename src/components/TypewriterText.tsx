import React, { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  lines: string[];
  charSpeedMs?: number;
  pauseBetweenLinesMs?: number;
  onLineComplete?: (lineIndex: number) => void;
  onAllComplete?: () => void;
  className?: string;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  lines,
  charSpeedMs = 38,
  pauseBetweenLinesMs = 1200,
  onLineComplete,
  onAllComplete,
  className = '',
}) => {
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isLineFinished, setIsLineFinished] = useState(false);
  const [isAllFinished, setIsAllFinished] = useState(false);

  const charIdxRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (lines.length === 0) return;

    const currentLine = lines[currentLineIdx];
    charIdxRef.current = 0;
    setDisplayedText('');
    setIsLineFinished(false);

    const typeNextChar = () => {
      if (charIdxRef.current < currentLine.length) {
        charIdxRef.current++;
        setDisplayedText(currentLine.slice(0, charIdxRef.current));
        timerRef.current = window.setTimeout(typeNextChar, charSpeedMs);
      } else {
        setIsLineFinished(true);
        if (onLineComplete) onLineComplete(currentLineIdx);

        // Pause briefly between lines
        if (currentLineIdx < lines.length - 1) {
          timerRef.current = window.setTimeout(() => {
            setCurrentLineIdx((prev) => prev + 1);
          }, pauseBetweenLinesMs);
        } else {
          setIsAllFinished(true);
          if (onAllComplete) onAllComplete();
        }
      }
    };

    timerRef.current = window.setTimeout(typeNextChar, 100);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentLineIdx, lines]);

  // Click to instantly complete current line or advance
  const handleAdvance = () => {
    if (isAllFinished) return;

    if (!isLineFinished) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const currentLine = lines[currentLineIdx];
      setDisplayedText(currentLine);
      setIsLineFinished(true);
      if (onLineComplete) onLineComplete(currentLineIdx);

      if (currentLineIdx < lines.length - 1) {
        timerRef.current = window.setTimeout(() => {
          setCurrentLineIdx((prev) => prev + 1);
        }, pauseBetweenLinesMs);
      } else {
        setIsAllFinished(true);
        if (onAllComplete) onAllComplete();
      }
    } else if (currentLineIdx < lines.length - 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrentLineIdx((prev) => prev + 1);
    }
  };

  return (
    <div
      onClick={handleAdvance}
      className={`cursor-pointer transition-all duration-300 ${className}`}
      title="Click to advance narration text"
    >
      <p className="min-h-[3rem] font-sans text-lg md:text-xl text-slate-100 leading-relaxed font-normal tracking-wide drop-shadow-md">
        {displayedText}
        {!isLineFinished && <span className="inline-block w-1.5 h-5 ml-1 bg-cyan-400 align-middle" />}
      </p>
      <div className="mt-2 text-xs text-slate-400 opacity-60 flex items-center justify-end space-x-1">
        <span>Line {currentLineIdx + 1} of {lines.length}</span>
        <span>• Click to advance</span>
      </div>
    </div>
  );
};
