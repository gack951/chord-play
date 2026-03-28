import type { ParsedBar } from '../types/music';
import type { EngineSettings } from './engine';
import { AudioEngine } from './engine';
import { Transport } from './transport';

export class Scheduler {
  private timerId: number | null = null;
  private readonly lookaheadSeconds = 0.12;
  private readonly intervalMs = 25;
  private scheduledThroughBeat = 0;
  private completionNotified = false;

  constructor(
    private readonly transport: Transport,
    private readonly engine: AudioEngine,
    private getBars: () => ParsedBar[],
    private getSettings: () => EngineSettings,
    private readonly onComplete?: () => void,
  ) {}

  start(): void {
    this.stop();
    this.scheduledThroughBeat = 0;
    this.completionNotified = false;
    this.tick();
    this.timerId = window.setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.scheduledThroughBeat = 0;
    this.engine.stopAll();
  }

  resetWindow(): void {
    this.scheduledThroughBeat = 0;
    this.completionNotified = false;
  }

  private tick(): void {
    const now = this.engine.currentTime;
    const snapshot = this.transport.getSnapshot(now);
    if (snapshot.state !== 'playing') {
      return;
    }

    const beatsPerSecond = snapshot.bpm / 60;
    const beatNow = snapshot.currentBeat;
    const untilBeat = beatNow + this.lookaheadSeconds * beatsPerSecond;
    const startBeat = Math.max(this.scheduledThroughBeat, beatNow);

    if (untilBeat <= startBeat) {
      return;
    }

    const bars = this.getBars();
    const totalBeats = bars.length * 4;
    if (totalBeats > 0 && beatNow >= totalBeats) {
      if (!this.completionNotified) {
        this.completionNotified = true;
        this.onComplete?.();
      }
      return;
    }

    const settings = this.getSettings();
    const boundedUntilBeat = totalBeats > 0 ? Math.min(untilBeat, totalBeats) : untilBeat;

    if (boundedUntilBeat <= startBeat) {
      return;
    }

    const timeAtBeatStart = now + ((startBeat - beatNow) * 60) / snapshot.bpm;
    this.engine.scheduleBars(bars, settings, startBeat, timeAtBeatStart, boundedUntilBeat);
    this.scheduledThroughBeat = boundedUntilBeat;
  }
}
