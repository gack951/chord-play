import { barsToChordEvents } from '../music/voicing';
import { midiToFrequency } from '../music/note';
import type { ParsedBar } from '../types/music';
import type { DrumPattern, PlaybackMode, RegisterName, SynthPreset } from '../types/app';
import type { DrumHit } from './drums';
import { getDrumHitsForBar } from './drums';

export interface EngineSettings {
  bpm: number;
  masterVolume: number;
  chordVolume: number;
  drumVolume: number;
  playbackMode: PlaybackMode;
  synthPreset: SynthPreset;
  bassRegister: RegisterName;
  chordRegister: RegisterName;
  drumPattern: DrumPattern;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private chordGain: GainNode | null = null;
  private drumGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  async ensureReady(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.masterGain = this.context.createGain();
      this.chordGain = this.context.createGain();
      this.drumGain = this.context.createGain();
      this.chordGain.connect(this.masterGain);
      this.drumGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  applySettings(settings: EngineSettings): void {
    if (!this.masterGain || !this.chordGain || !this.drumGain) {
      return;
    }

    this.masterGain.gain.value = settings.masterVolume;
    this.chordGain.gain.value = settings.chordVolume;
    this.drumGain.gain.value = settings.drumVolume;
  }

  scheduleBars(bars: ParsedBar[], settings: EngineSettings, beatStart: number, timeAtBeatStart: number, untilBeat: number): void {
    if (!this.context) {
      return;
    }

    const chordEvents = barsToChordEvents(
      bars,
      settings.playbackMode,
      settings.bassRegister,
      settings.chordRegister,
    );

    chordEvents
      .filter((event) => event.startBeat >= beatStart && event.startBeat < untilBeat)
      .forEach((event) => {
        const startTime = timeAtBeatStart + ((event.startBeat - beatStart) * 60) / settings.bpm;
        const durationSeconds = (event.durationBeats * 60) / settings.bpm;
        event.midi.forEach((midi, index) => {
          this.playSynthNote(midiToFrequency(midi), startTime, durationSeconds, settings.synthPreset, index === 0);
        });
      });

    const barStart = Math.floor(beatStart / 4) * 4;
    for (let beat = barStart; beat < untilBeat; beat += 4) {
      const hits = getDrumHitsForBar(settings.drumPattern, beat);
      hits
        .filter((hit) => hit.beat >= beatStart && hit.beat < untilBeat)
        .forEach((hit) => {
          const startTime = timeAtBeatStart + ((hit.beat - beatStart) * 60) / settings.bpm;
          this.playDrumHit(hit, startTime);
        });
    }
  }

  stopAll(): void {
    if (!this.context) {
      return;
    }

    const silenceTime = this.context.currentTime;
    this.masterGain?.gain.cancelScheduledValues(silenceTime);
    this.masterGain?.gain.setValueAtTime(this.masterGain.gain.value, silenceTime);
  }

  previewSynthNotes(midiNotes: number[], synthPreset: SynthPreset, durationSeconds = 1.2): void {
    if (!this.context) {
      return;
    }

    const startTime = this.context.currentTime + 0.01;
    midiNotes.forEach((midi, index) => {
      this.playSynthNote(midiToFrequency(midi), startTime, durationSeconds, synthPreset, index === 0);
    });
  }

  previewSingleNote(midi: number, synthPreset: SynthPreset, durationSeconds = 1.2): void {
    if (!this.context) {
      return;
    }

    const startTime = this.context.currentTime + 0.01;
    this.playSynthNote(midiToFrequency(midi), startTime, durationSeconds, synthPreset, false);
  }

  private playSynthNote(
    frequency: number,
    startTime: number,
    durationSeconds: number,
    synthPreset: SynthPreset,
    isBass: boolean,
  ): void {
    if (!this.context || !this.chordGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const peakGain = isBass ? 0.18 : 0.12;
    const noteEndTime = startTime + Math.max(durationSeconds, 0.01);
    const safeAttack = Math.min(Math.max(synthPreset.attack, 0.001), Math.max(noteEndTime - startTime - 0.002, 0.001));
    const safeRelease = Math.min(Math.max(synthPreset.release, 0.001), Math.max(noteEndTime - startTime - 0.001, 0.001));
    const attackEnd = startTime + safeAttack;
    const releaseStartTime = Math.max(attackEnd, noteEndTime - safeRelease);

    oscillator.type = synthPreset.waveform;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(synthPreset.filterCutoff, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, attackEnd);
    gainNode.gain.setValueAtTime(peakGain, releaseStartTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.chordGain);
    oscillator.start(startTime);
    oscillator.stop(noteEndTime + 0.02);
  }

  private playDrumHit(hit: DrumHit, startTime: number): void {
    if (!this.context || !this.drumGain || !this.noiseBuffer) {
      return;
    }

    if (hit.type === 'kick' || hit.type === 'click') {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = hit.type === 'click' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hit.type === 'click' ? 1600 : 110, startTime);
      osc.frequency.exponentialRampToValueAtTime(hit.type === 'click' ? 800 : 45, startTime + 0.08);
      gain.gain.setValueAtTime(hit.type === 'click' ? 0.18 : 0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);
      osc.connect(gain);
      gain.connect(this.drumGain);
      osc.start(startTime);
      osc.stop(startTime + 0.14);
      return;
    }

    const noise = this.context.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(hit.type === 'snare' ? 1200 : 4000, startTime);
    gain.gain.setValueAtTime(hit.type === 'snare' ? 0.14 : 0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + (hit.type === 'snare' ? 0.18 : 0.05));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);
    noise.start(startTime);
    noise.stop(startTime + 0.2);
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.context) {
      throw new Error('AudioContext is not ready');
    }

    const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.5, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
