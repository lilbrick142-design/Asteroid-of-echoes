import { useState, useEffect } from 'react';
import {
  ActiveExperienceState,
  GameStage,
  PlayerControls,
  SongItem,
} from './types';
import { TOTAL_SONGS_COUNT } from './data/songs';
import { GameCanvas } from './components/GameCanvas';
import { IntroOverlay } from './components/IntroOverlay';
import { LevelBriefOverlay } from './components/LevelBriefOverlay';
import { HUD } from './components/HUD';
import { ExperienceHUD } from './components/ExperienceHUD';
import { AlbumJukeboxModal } from './components/AlbumJukeboxModal';
import { CompletionOverlay } from './components/CompletionOverlay';
import { VictoryScreen } from './components/VictoryScreen';
import { audioEngine } from './services/audioEngine';
import { songExperienceManager } from './services/SongExperienceManager';

export default function App() {
  const [gameStage, setGameStage] = useState<GameStage>('INTRO_NARRATION');
  const [collectedIds, setCollectedIds] = useState<number[]>([]);
  const [activeExperience, setActiveExperience] = useState<ActiveExperienceState>(() =>
    songExperienceManager.getState()
  );
  const [isJukeboxOpen, setIsJukeboxOpen] = useState<boolean>(false);

  const [playerControls, setPlayerControls] = useState<PlayerControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    joystickVector: { x: 0, y: 0 },
  });

  // Subscribe to SongExperienceManager state changes
  useEffect(() => {
    return songExperienceManager.subscribe((nextState) => {
      setActiveExperience(nextState);
    });
  }, []);

  // Global keyboard movement controls (WASD / Arrow keys)
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

  // Unlock audio & start ambient space pad on first valid user gesture
  useEffect(() => {
    const handleUserGesture = () => {
      audioEngine.unlockAudio();
      audioEngine.startAmbientSpacePad();
      if (audioEngine.isAudioUnlocked()) {
        window.removeEventListener('pointerdown', handleUserGesture);
        window.removeEventListener('keydown', handleUserGesture);
      }
    };
    window.addEventListener('pointerdown', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  const handleBeginMission = () => {
    audioEngine.unlockAudio();
    audioEngine.startAmbientSpacePad();
    setGameStage('TRANSITION_TO_LEVEL1');
    setTimeout(() => {
      setGameStage('LEVEL1_BRIEF');
    }, 2500);
  };

  // Triggered when player collects a floating album cover
  const handleCollectSong = (song: SongItem) => {
    if (!songExperienceManager.canCollectAlbum()) return;

    setCollectedIds((prev) => {
      if (prev.includes(song.id)) return prev;
      return [...prev, song.id];
    });
    songExperienceManager.startExperience(song);
  };

  // Triggered when user launches a collected song world from the Album Collection modal
  const handleRevisitExperience = (song: SongItem) => {
    if (!songExperienceManager.canCollectAlbum()) return;
    songExperienceManager.startExperience(song);
  };

  const handleAllCollectedSequenceDone = () => {
    setGameStage('LEVEL1_COMPLETION');
  };

  const handleContinueToFinished = () => {
    setGameStage('LEVEL1_FINISHED');
  };

  const handleReplayLevel1 = () => {
    songExperienceManager.forceReset();
    setCollectedIds([]);
    setIsJukeboxOpen(false);
    setGameStage('LEVEL1_GAMEPLAY');
  };

  const handleLaunchExperienceFromSummary = (song: SongItem) => {
    songExperienceManager.forceReset();
    setGameStage('LEVEL1_GAMEPLAY');
    setTimeout(() => {
      songExperienceManager.startExperience(song);
    }, 80);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas
        gameStage={gameStage}
        collectedIds={collectedIds}
        activeExperience={activeExperience}
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
        <>
          <HUD
            collectedCount={collectedIds.length}
            totalCount={TOTAL_SONGS_COUNT}
            activeExperience={activeExperience}
            onOpenJukebox={() => setIsJukeboxOpen(true)}
            playerControls={playerControls}
            setPlayerControls={setPlayerControls}
          />
          <ExperienceHUD experience={activeExperience} />
        </>
      )}

      {/* Level 1 Completion Banner */}
      {gameStage === 'LEVEL1_COMPLETION' && (
        <CompletionOverlay onContinue={handleContinueToFinished} />
      )}

      {/* Album Collection Modal */}
      {isJukeboxOpen && (
        <AlbumJukeboxModal
          collectedIds={collectedIds}
          activeSongId={activeExperience.song?.id ?? null}
          onClose={() => setIsJukeboxOpen(false)}
          onExperienceSong={handleRevisitExperience}
        />
      )}

      {/* Level 1 Summary / Victory Screen */}
      {gameStage === 'LEVEL1_FINISHED' && (
        <VictoryScreen
          onReplayLevel1={handleReplayLevel1}
          onLaunchExperienceFromSummary={handleLaunchExperienceFromSummary}
        />
      )}
    </div>
  );
}
