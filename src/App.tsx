import { useState, useEffect } from 'react';
import { GameStage, SongItem, PlayerControls } from './types';
import { GameCanvas } from './components/GameCanvas';
import { IntroOverlay } from './components/IntroOverlay';
import { LevelBriefOverlay } from './components/LevelBriefOverlay';
import { HUD } from './components/HUD';
import { AlbumJukeboxModal } from './components/AlbumJukeboxModal';
import { CompletionOverlay } from './components/CompletionOverlay';
import { VictoryScreen } from './components/VictoryScreen';
import { audioEngine } from './services/audioEngine';

export default function App() {
  const [gameStage, setGameStage] = useState<GameStage>('INTRO_NARRATION');
  const [collectedIds, setCollectedIds] = useState<number[]>([]);
  const [activePreviewSong, setActivePreviewSong] = useState<SongItem | null>(null);
  const [isJukeboxOpen, setIsJukeboxOpen] = useState<boolean>(false);

  const [playerControls, setPlayerControls] = useState<PlayerControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    joystickVector: { x: 0, y: 0 },
  });

  // Handle global keyboard movement controls for WASD / Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStage !== 'LEVEL1_GAMEPLAY') return;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setPlayerControls((prev) => ({ ...prev, forward: true }));
          break;
        case 's':
        case 'arrowdown':
          setPlayerControls((prev) => ({ ...prev, backward: true }));
          break;
        case 'a':
        case 'arrowleft':
          setPlayerControls((prev) => ({ ...prev, left: true }));
          break;
        case 'd':
        case 'arrowright':
          setPlayerControls((prev) => ({ ...prev, right: true }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setPlayerControls((prev) => ({ ...prev, forward: false }));
          break;
        case 's':
        case 'arrowdown':
          setPlayerControls((prev) => ({ ...prev, backward: false }));
          break;
        case 'a':
        case 'arrowleft':
          setPlayerControls((prev) => ({ ...prev, left: false }));
          break;
        case 'd':
        case 'arrowright':
          setPlayerControls((prev) => ({ ...prev, right: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStage]);

  // Start background space pad when app starts
  useEffect(() => {
    const handleFirstUserClick = () => {
      audioEngine.startAmbientSpacePad();
      window.removeEventListener('click', handleFirstUserClick);
    };
    window.addEventListener('click', handleFirstUserClick);

    return () => {
      window.removeEventListener('click', handleFirstUserClick);
    };
  }, []);

  // Handler when BEGIN MISSION is clicked in intro
  const handleBeginMission = () => {
    audioEngine.startAmbientSpacePad();
    setGameStage('TRANSITION_TO_LEVEL1');

    // Smooth camera transition duration (~2.5s)
    setTimeout(() => {
      setGameStage('LEVEL1_BRIEF');
    }, 2500);
  };

  // Handler when player collects an album cover
  const handleCollectSong = (song: SongItem) => {
    setCollectedIds((prev) => {
      if (prev.includes(song.id)) return prev;
      return [...prev, song.id];
    });
    setActivePreviewSong(song);
  };

  // Handler when all 10 albums are collected and bridge is built
  const handleAllCollectedSequenceDone = () => {
    setGameStage('LEVEL1_COMPLETION');
  };

  // Handler when player clicks CONTINUE in Level 1 completion
  const handleContinueToFinished = () => {
    setGameStage('LEVEL1_FINISHED');
  };

  // Handler to restart Level 1 exploration
  const handleReplayLevel1 = () => {
    setCollectedIds([]);
    setActivePreviewSong(null);
    setGameStage('LEVEL1_GAMEPLAY');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas
        gameStage={gameStage}
        collectedIds={collectedIds}
        onCollectSong={handleCollectSong}
        onAllCollectedSequenceDone={handleAllCollectedSequenceDone}
        playerControls={playerControls}
      />

      {/* Intro Narration UI Overlay */}
      {gameStage === 'INTRO_NARRATION' && (
        <IntroOverlay onBeginMission={handleBeginMission} />
      )}

      {/* Level 1 Briefing Overlay */}
      {gameStage === 'LEVEL1_BRIEF' && (
        <LevelBriefOverlay onDismiss={() => setGameStage('LEVEL1_GAMEPLAY')} />
      )}

      {/* Main HUD during Level 1 Gameplay & Completion */}
      {(gameStage === 'LEVEL1_GAMEPLAY' || gameStage === 'LEVEL1_COMPLETION') && (
        <HUD
          collectedCount={collectedIds.length}
          totalCount={10}
          activePreviewSong={activePreviewSong}
          onOpenJukebox={() => setIsJukeboxOpen(true)}
          playerControls={playerControls}
          setPlayerControls={setPlayerControls}
        />
      )}

      {/* Level 1 Completion Sequence Banner */}
      {gameStage === 'LEVEL1_COMPLETION' && (
        <CompletionOverlay onContinue={handleContinueToFinished} />
      )}

      {/* Album Jukebox Modal */}
      {isJukeboxOpen && (
        <AlbumJukeboxModal
          collectedIds={collectedIds}
          onClose={() => setIsJukeboxOpen(false)}
          onPlayPreview={(song) => setActivePreviewSong(song)}
        />
      )}

      {/* Level 1 Victory & Summary Screen */}
      {gameStage === 'LEVEL1_FINISHED' && (
        <VictoryScreen onReplayLevel1={handleReplayLevel1} />
      )}
    </div>
  );
}
