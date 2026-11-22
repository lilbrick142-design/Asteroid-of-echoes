import { VisualQualityLevel } from '../types';

export interface QualityPreset {
  level: VisualQualityLevel;
  label: string;
  maxPixelRatio: number;
  enableBloom: boolean;
  enableShadows: boolean;
  particleDensity: number;
  asciiCellWidth: number;
  asciiCellHeight: number;
}

const PRESETS: Record<VisualQualityLevel, QualityPreset> = {
  high: {
    level: 'high',
    label: 'High',
    maxPixelRatio: 2,
    enableBloom: true,
    enableShadows: true,
    particleDensity: 1.0,
    asciiCellWidth: 7,
    asciiCellHeight: 11,
  },
  balanced: {
    level: 'balanced',
    label: 'Balanced',
    maxPixelRatio: 1.5,
    enableBloom: true,
    enableShadows: true,
    particleDensity: 0.72,
    asciiCellWidth: 9,
    asciiCellHeight: 14,
  },
  performance: {
    level: 'performance',
    label: 'Performance',
    maxPixelRatio: 1.0,
    enableBloom: false,
    enableShadows: false,
    particleDensity: 0.45,
    asciiCellWidth: 12,
    asciiCellHeight: 18,
  },
};

type QualityListener = (preset: QualityPreset) => void;

class QualitySettingsService {
  private currentLevel: VisualQualityLevel = 'high';
  private listeners = new Set<QualityListener>();

  public initFromRenderer(isSoftwareGl: boolean) {
    if (isSoftwareGl && this.currentLevel !== 'performance') {
      this.setQuality('performance');
    }
  }

  public getPreset(): QualityPreset {
    return PRESETS[this.currentLevel];
  }

  public getLevel(): VisualQualityLevel {
    return this.currentLevel;
  }

  public setQuality(level: VisualQualityLevel) {
    if (this.currentLevel === level) return;
    this.currentLevel = level;
    const preset = PRESETS[level];
    this.listeners.forEach((cb) => cb(preset));
  }

  public subscribe(listener: QualityListener): () => void {
    this.listeners.add(listener);
    listener(PRESETS[this.currentLevel]);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const qualitySettings = new QualitySettingsService();
