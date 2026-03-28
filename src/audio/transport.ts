export type TransportState = 'stopped' | 'playing' | 'paused';

export interface TransportSnapshot {
  state: TransportState;
  bpm: number;
  currentBeat: number;
  currentBar: number;
}

export class Transport {
  private bpm: number;
  private state: TransportState = 'stopped';
  private anchorTime = 0;
  private anchorBeat = 0;
  private pausedBeat = 0;

  constructor(initialBpm: number) {
    this.bpm = initialBpm;
  }

  setBpm(bpm: number, now: number): void {
    const currentBeat = this.getCurrentBeat(now);
    this.bpm = bpm;
    if (this.state === 'playing') {
      this.anchorBeat = currentBeat;
      this.anchorTime = now;
    } else if (this.state === 'paused') {
      this.pausedBeat = currentBeat;
    }
  }

  play(now: number): void {
    this.state = 'playing';
    this.anchorTime = now;
    this.anchorBeat = 0;
    this.pausedBeat = 0;
  }

  stop(): void {
    this.state = 'stopped';
    this.anchorTime = 0;
    this.anchorBeat = 0;
    this.pausedBeat = 0;
  }

  pause(now: number): void {
    if (this.state !== 'playing') {
      return;
    }

    this.pausedBeat = this.getCurrentBeat(now);
    this.state = 'paused';
  }

  resume(now: number): void {
    if (this.state !== 'paused') {
      return;
    }

    this.anchorBeat = this.pausedBeat;
    this.anchorTime = now;
    this.state = 'playing';
  }

  cueToBeat(beat: number): void {
    const safeBeat = Math.max(0, beat);
    this.state = 'paused';
    this.pausedBeat = safeBeat;
    this.anchorBeat = safeBeat;
    this.anchorTime = 0;
  }

  cueToBar(bar: number): void {
    const safeBar = Math.max(1, Math.floor(bar));
    this.cueToBeat((safeBar - 1) * 4);
  }

  syncToNearestBar(now: number): void {
    const currentBeat = this.getCurrentBeat(now);
    const snappedBeat = Math.round(currentBeat / 4) * 4;

    this.anchorBeat = snappedBeat;
    this.anchorTime = now;
    if (this.state === 'paused') {
      this.pausedBeat = snappedBeat;
    }
  }

  getCurrentBeat(now: number): number {
    if (this.state === 'stopped') {
      return 0;
    }

    if (this.state === 'paused') {
      return this.pausedBeat;
    }

    return this.anchorBeat + ((now - this.anchorTime) * this.bpm) / 60;
  }

  getSnapshot(now: number): TransportSnapshot {
    const currentBeat = this.getCurrentBeat(now);
    return {
      state: this.state,
      bpm: this.bpm,
      currentBeat,
      currentBar: Math.floor(currentBeat / 4) + 1,
    };
  }
}
