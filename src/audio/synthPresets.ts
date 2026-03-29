import type { SynthPreset } from '../types/app';

export const DEFAULT_SYNTH_PRESET_ID = 'preset-debug-hold';

export const DEFAULT_SYNTH_PRESET: SynthPreset = {
  id: DEFAULT_SYNTH_PRESET_ID,
  name: 'debug-hold',
  waveform: 'triangle',
  filterCutoff: 3200,
  attack: 0.01,
  release: 0.005,
};

export function createDefaultSynthPreset(seed?: Partial<SynthPreset>): SynthPreset {
  return {
    ...DEFAULT_SYNTH_PRESET,
    ...seed,
  };
}

export function normalizeSynthPresetName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'New Preset';
}
